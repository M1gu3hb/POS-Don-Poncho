import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { consultar } from '../puente/consultar.ts';
import { hojaDelCorte } from '../caja/corte/documento.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { abrirMesa } from './mesas.ts';
import { enviarPedido } from './pedido.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrar,
  mesaDe,
  ordenPersistida,
  PRECIO_CERVEZA,
  pedirLaCuenta,
  sembrarSalon,
  sumaDeLosPagos,
  type Salon,
} from './pruebas/salon-real.ts';
import { dividirCuentaComando } from './division.ts';

/**
 * DP-14.1-5 · LA BARBACOA POR KILO, de la mesa al corte, contra Postgres.
 *
 * $795 el kilo. Cada peso de la tabla de aceptación se pide en su propia mesa junto con una
 * cerveza, se divide la cuenta —la barbacoa ENTERA a una parte, la cerveza a la otra— y se cobra
 * parte por parte. Una mesa más lleva los cinco pesos juntos y se cobra entera. Lo que se afirma
 * se LEE de la base: líneas (cantidad y centavos), partes, pagos, y lo que el corte y el puente
 * (la base del Cierre del día y del CSV de Registros) cuentan después.
 */

const PRECIO_KILO = 79_500n;
const CERVEZA = PRECIO_CERVEZA;
const FONDO = 50_000;

const PESOS: readonly (readonly [string, bigint])[] = [
  ['0.25', 19_875n],
  ['0.5', 39_750n],
  ['0.75', 59_625n],
  ['1', 79_500n],
  ['1.5', 119_250n],
];
const TODOS_LOS_PESOS = PESOS.reduce((suma, [, importe]) => suma + importe, 0n);

let salon: Salon;
let barbacoaId = '';
let cervezaId = '';
let sesion = '';
const ambito = () => ambitoDeCaja(salon);

async function sembrarBarbacoa(): Promise<string> {
  const fila = await obtenerDb()
    .insertInto('productos')
    .values({
      organizacion_id: salon.negocio.organizacionId,
      nombre: 'Barbacoa de horno',
      precio_venta_centavos: PRECIO_KILO,
      costo_unitario_centavos: 30_000n,
      tipo_venta: 'variable_medida',
      unidad_venta: 'kg',
      unidad_variable: 'kg',
      precio_por_unidad_variable_centavos: PRECIO_KILO,
      estrategia_consumo: 'ninguno',
      area_preparacion: 'cocina',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return fila.id;
}

/** Abre la mesa y manda su pedido: cada elemento es una línea (producto y cantidad en texto). */
async function pedir(indice: number, lineas: readonly (readonly [string, string])[]) {
  const { ordenId } = exigirOk(
    await comando(abrirMesa, {
      entrada: { mesaId: mesaDe(salon, indice), personas: 2 },
      ambito: ambito(),
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  );
  exigirOk(
    await comando(enviarPedido, {
      entrada: {
        ordenId,
        lineas: lineas.map(([productoId, cantidad]) => ({ productoId, cantidad })),
      },
      ambito: ambito(),
      idempotencyKey: clave(),
    }),
    'restaurante.enviar_pedido',
  );
  return ordenId;
}

async function lineasDe(ordenId: string) {
  return obtenerDb()
    .selectFrom('orden_lineas')
    .select(['id', 'producto_nombre', 'cantidad', 'cantidad_variable', 'total_centavos'])
    .where('orden_id', '=', ordenId)
    .where('anulada_en', 'is', null)
    .execute();
}

const partes: { ordenes: string[]; madre: string; peso: string; importe: bigint }[] = [];
let mesaEntera = '';

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Barbacoa por kilo', mesas: 8, terminales: 1 });
  [sesion = ''] = await abrirLasCajas(salon, FONDO);
  barbacoaId = await sembrarBarbacoa();
  cervezaId = salon.platillos.cerveza;

  for (const [i, [peso, importe]] of PESOS.entries()) {
    const madre = await pedir(i, [
      [barbacoaId, peso],
      [cervezaId, '1'],
    ]);
    await pedirLaCuenta(salon, madre);
    const lineas = await lineasDe(madre);
    const barbacoa = lineas.find((l) => l.producto_nombre === 'Barbacoa de horno');
    const cerveza = lineas.find((l) => l.producto_nombre !== 'Barbacoa de horno');
    if (barbacoa === undefined || cerveza === undefined) throw new Error('Faltan líneas.');
    const division = exigirOk(
      await comando(dividirCuentaComando, {
        entrada: {
          ordenId: madre,
          particiones: [
            { tomas: [{ lineaId: barbacoa.id, cantidad: 1 }] },
            { tomas: [{ lineaId: cerveza.id, cantidad: 1 }] },
          ],
        },
        ambito: ambito(),
        idempotencyKey: clave(),
      }),
      'restaurante.dividir_cuenta',
    );
    partes.push({ ordenes: division.hijas.map((h) => h.ordenId), madre, peso, importe });
    for (const hija of division.hijas) {
      exigirOk(
        await cobrar(ambito(), hija.ordenId, Number(hija.totalCentavos), [
          { metodo: 'efectivo', montoCentavos: Number(hija.totalCentavos) },
        ]),
        'venta.cobrar (parte)',
      );
    }
  }

  mesaEntera = await pedir(
    5,
    PESOS.map(([peso]) => [barbacoaId, peso] as const),
  );
  await pedirLaCuenta(salon, mesaEntera);
  exigirOk(
    await cobrar(ambito(), mesaEntera, Number(TODOS_LOS_PESOS), [
      { metodo: 'efectivo', montoCentavos: Number(TODOS_LOS_PESOS) },
    ]),
    'venta.cobrar (mesa entera)',
  );
});

describe.each(PESOS)('DP-14.5 · la cuenta con %s kg, dividida en la base real', (peso, importe) => {
  it('la barbacoa llega COMPLETA a una parte, con su peso y su importe exactos', async () => {
    const caso = partes.find((p) => p.peso === peso);
    if (caso === undefined) throw new Error('Sin caso.');
    const [conBarbacoa, conCerveza] = caso.ordenes;
    const suyas = await lineasDe(conBarbacoa ?? '');
    expect(suyas).toHaveLength(1);
    expect(Number(suyas[0]?.cantidad)).toBe(Number(peso));
    expect(Number(suyas[0]?.cantidad_variable)).toBe(Number(peso));
    expect(suyas[0]?.total_centavos).toBe(importe);
    expect(await lineasDe(caso.madre), 'la madre no se queda con consumo').toHaveLength(0);
    expect(await lineasDe(conCerveza ?? '')).toHaveLength(1);
  });

  it('las partes suman la madre al centavo y se cobraron por lo que valen', async () => {
    const caso = partes.find((p) => p.peso === peso);
    if (caso === undefined) throw new Error('Sin caso.');
    const madre = await ordenPersistida(caso.madre);
    expect(madre.total_centavos).toBe(importe + CERVEZA);
    const hijas = await Promise.all(caso.ordenes.map((id) => ordenPersistida(id)));
    expect(hijas.map((h) => h.total_centavos)).toEqual([importe, CERVEZA]);
    expect(hijas.every((h) => h.estado === 'pagada')).toBe(true);
    expect(await sumaDeLosPagos(caso.ordenes)).toBe(importe + CERVEZA);
  });
});

describe('DP-14.4 · la mesa con los cinco pesos, cobrada entera', () => {
  it('suma $3,180.00 exactos: 198.75 + 397.50 + 596.25 + 795.00 + 1,192.50', async () => {
    expect(TODOS_LOS_PESOS).toBe(318_000n);
    const orden = await ordenPersistida(mesaEntera);
    expect(orden.total_centavos).toBe(TODOS_LOS_PESOS);
    const lineas = await lineasDe(mesaEntera);
    expect(lineas.map((l) => l.total_centavos).sort()).toEqual(
      PESOS.map(([, importe]) => importe).sort(),
    );
    expect(await sumaDeLosPagos([mesaEntera])).toBe(TODOS_LOS_PESOS);
  });
});

describe('DP-14.4 · el corte y el puente (Cierre del día, CSV) cuentan lo mismo', () => {
  const ESPERADO = TODOS_LOS_PESOS + (TODOS_LOS_PESOS + 5n * CERVEZA);

  it('el corte de caja suma todo lo cobrado, sin centavos sueltos', async () => {
    const hoja = exigirOk(
      await comando(hojaDelCorte, {
        entrada: { sesionCajaId: sesion },
        ambito: ambito(),
        idempotencyKey: clave(),
      }),
      'caja.hoja_del_corte',
    );
    expect(hoja.resumen).toMatchObject({ tickets: 11 });
    const barbacoa = hoja.productos.find((p) => p.nombre === 'Barbacoa de horno');
    // 2 × (0.25 + 0.5 + 0.75 + 1 + 1.5) = 8 kg, y 2 × $3,180.00.
    expect(barbacoa).toMatchObject({
      lineas: 10,
      cantidad: '8',
      unidad: 'kg',
      totalCentavos: String(2n * TODOS_LOS_PESOS),
    });
    expect(hoja.resumen.totalCentavos).toBe(String(ESPERADO));
  });

  it('el puente sirve cada línea con su cantidad fraccionaria y su importe en pesos exactos', async () => {
    const filas = await consultar(ambito(), { entidad: 'DetalleVenta', operacion: 'list' });
    const barbacoas = filas.filter((f) => f['producto_nombre'] === 'Barbacoa de horno');
    expect(barbacoas).toHaveLength(PESOS.length * 2);
    const totales = barbacoas.map((f) => Number(f['total'])).sort((a, b) => a - b);
    const esperados = [...PESOS, ...PESOS].map(([, c]) => Number(c) / 100).sort((a, b) => a - b);
    expect(totales).toEqual(esperados);
    for (const f of barbacoas) {
      expect(f['tipo_venta_snapshot']).toBe('variable_medida');
      expect(Number(f['cantidad_variable_snapshot'])).toBeGreaterThan(0);
    }
  });

  it('las ventas del puente suman al centavo lo que se cobró', async () => {
    const ventas = await consultar(ambito(), { entidad: 'Venta', operacion: 'list' });
    const total = ventas
      .filter((v) => v['estado'] === 'pagada' && typeof v['total'] === 'number')
      .reduce((suma, v) => suma + Math.round(Number(v['total']) * 100), 0);
    expect(BigInt(total)).toBe(ESPERADO);
  });
});
