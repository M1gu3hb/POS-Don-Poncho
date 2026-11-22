import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { agregarALaUnionComando } from './agregar-a-la-union.ts';
import { avisosDeListo } from './avisos-de-listo.ts';
import { moverPlatillos } from './mover-platillos.ts';
import { entregarPedidos } from './preparacion.ts';
import { imprimirPrecuenta } from './precuenta.ts';
import {
  PRECIO_ARRACHERA,
  PRECIO_CERVEZA,
  PRECIO_GUACAMOLE,
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  mesaPersistida,
  ordenPersistida,
  pagosDe,
  pedirLaCuenta,
  pedirMas,
  sentarYPedir,
  type Salon,
} from './pruebas/salon-real.ts';
import { LADO, mesa, posicion, salonEnFila, unir } from './pruebas/union-en-el-plano.ts';
import { separarMesasComando } from './union-de-mesas.ts';

/**
 * DP-25 · P6 · EL FLUJO REAL DE «SE PEGAN MESAS POCO A POCO», contra Postgres (DP-D226).
 *
 * Llega gente y se pega una mesa, luego otra y otra, y TODA la cuenta va a la mesa principal. Cinco
 * mesas, cada una con cuatro platillos en los cuatro estados (nuevo, en preparación, listo,
 * entregado). La 1 y la 2 se unen; la 3 y la 4 se agregan con «Unir mesas» (la 4 diciendo que ella
 * es la principal: manda la de siempre); la 5, con «Agregar mesas». Se afirma:
 *
 *   · una sola cuenta viva —la de la 1— con los veinte renglones y el total exacto;
 *   · cada renglón dice de qué mesa vino (los de la propia 1, ninguna);
 *   · cada platillo conserva su estado, y cocina dice la mesa PRINCIPAL;
 *   · el aviso de «listo» es del mesero de la principal;
 *   · la precuenta sale una vez, con la mesa de cada renglón, y se cobra una sola vez;
 *   · al final se separa y cada mesa vuelve libre a su lugar.
 */

const POR_MESA = PRECIO_ARRACHERA + PRECIO_GUACAMOLE + 2n * PRECIO_CERVEZA;
const MESAS = 5;
const TOTAL_DEL_GRUPO = POR_MESA * BigInt(MESAS);
const ESTADOS = ['pendiente', 'en_preparacion', 'listo', 'entregado'] as const;

const cocina = (salon: Salon) => ({ ...ambitoDeCaja(salon), rol: 'cocina' as const });

async function itemsDe(ordenId: string) {
  return obtenerDb()
    .selectFrom('comanda_items as i')
    .innerJoin('comandas as c', 'c.id', 'i.comanda_id')
    .select(['i.id', 'i.estado', 'c.id as comandaId', 'c.mesa_id as mesaDeLaComanda'])
    .where('c.orden_id', '=', ordenId)
    .orderBy('i.orden_visual')
    .orderBy('i.id')
    .execute();
}

function mover(
  salon: Salon,
  ids: string[],
  estado: 'en_preparacion' | 'listo',
  desde: 'nuevo' | 'en_preparacion' = 'nuevo',
) {
  return comando(moverPlatillos, {
    entrada: { platilloIds: ids, desde, estado },
    ambito: cocina(salon),
    idempotencyKey: clave(),
  });
}

/** Cuatro platillos: uno nuevo, uno en preparación, uno listo y uno ya entregado. */
async function pedirEnLosCuatroEstados(salon: Salon, indice: number): Promise<string> {
  const { ordenId } = await sentarYPedir(salon, indice, [
    { platillo: 'arrachera', cantidad: '1' },
    { platillo: 'guacamole', cantidad: '1' },
    { platillo: 'cerveza', cantidad: '1' },
  ]);
  await pedirMas(salon, ordenId, [{ platillo: 'cerveza', cantidad: '1' }]);
  const items = await itemsDe(ordenId);
  expect(items).toHaveLength(4);
  const [, enPreparacion, listo, entregado] = items.map((i) => i.id);
  exigirOk(await mover(salon, [enPreparacion ?? ''], 'en_preparacion'), 'en preparación');
  exigirOk(await mover(salon, [entregado ?? ''], 'listo'), 'listo (para entregar)');
  exigirOk(
    await comando(entregarPedidos, {
      entrada: { ordenId },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'entregar',
  );
  exigirOk(await mover(salon, [listo ?? ''], 'listo'), 'listo');
  return ordenId;
}

interface Flujo {
  readonly salon: Salon;
  readonly cuentas: readonly string[];
  readonly meseroA: string;
  readonly meseroB: string;
  readonly unionId: string;
  readonly avisosDeLaUnion: readonly { desdeMesa: number; aMesa: number }[][];
}

const enHilera = (i: number) => ({ x: 100 + i * LADO, y: 100 });

async function armarElFlujo(): Promise<Flujo> {
  const salon = await salonEnFila('Salón del flujo real', 6);
  await abrirLasCajas(salon);
  const meseroA = await sembrarCompanero(salon.negocio, { nombre: 'Ana', rol: 'mesero' });
  const meseroB = await sembrarCompanero(salon.negocio, { nombre: 'Beto', rol: 'mesero' });
  const cuentas: string[] = [];
  for (let i = 0; i < MESAS; i += 1) cuentas.push(await pedirEnLosCuatroEstados(salon, i));
  // La principal es de Ana; la 4, que entra después, estaba con Beto.
  const db = obtenerDb();
  await db
    .updateTable('mesas')
    .set({ empleado_atiende_id: meseroA })
    .where('id', '=', mesa(salon, 0))
    .execute();
  await db
    .updateTable('mesas')
    .set({ empleado_atiende_id: meseroB })
    .where('id', '=', mesa(salon, 3))
    .execute();

  const avisos: { desdeMesa: number; aMesa: number }[][] = [];
  const primera = exigirOk(
    await unir(salon, 0, [1], [{ i: 1, ...enHilera(1) }]),
    'unir la 1 con la 2',
  );
  avisos.push([...primera.cuentasQuePasaron]);
  // «Unir mesas» con la principal del grupo y una mesa que se pega.
  const tercera = exigirOk(
    await unir(salon, 0, [2], [{ i: 2, ...enHilera(2) }]),
    'unir la 1 con la 3 (ya hay grupo)',
  );
  avisos.push([...tercera.cuentasQuePasaron]);
  // «Unir mesas» eligiendo como principal a la que entra: manda la principal de siempre.
  const cuarta = exigirOk(
    await unir(salon, 3, [0], [{ i: 3, ...enHilera(3) }]),
    'unir la 4 con la 1 (ya hay grupo): queda la 1',
  );
  avisos.push([...cuarta.cuentasQuePasaron]);
  // «Agregar mesas».
  const quinta = exigirOk(
    await comando(agregarALaUnionComando, {
      entrada: {
        unionId: primera.unionId,
        mesaIds: [mesa(salon, 4)],
        posiciones: [{ mesaId: mesa(salon, 4), ...enHilera(4) }],
      },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'agregar la 5',
  );
  avisos.push([...quinta.cuentasQuePasaron]);
  return { salon, cuentas, meseroA, meseroB, unionId: primera.unionId, avisosDeLaUnion: avisos };
}

describe('se pegan mesas poco a poco y toda la cuenta va a la principal', () => {
  let f: Flujo;
  beforeAll(async () => {
    f = await armarElFlujo();
  }, 300_000);

  it('a · cada unión avisa qué cuenta pasó a qué mesa', () => {
    expect(f.avisosDeLaUnion).toEqual([
      [{ desdeMesa: 2, aMesa: 1 }],
      [{ desdeMesa: 3, aMesa: 1 }],
      [{ desdeMesa: 4, aMesa: 1 }],
      [{ desdeMesa: 5, aMesa: 1 }],
    ]);
  });

  it('b · una sola cuenta viva, la de la 1, con los veinte renglones y el total exacto', async () => {
    const [principal, ...demas] = f.cuentas;
    expect(await ordenPersistida(principal ?? '')).toMatchObject({
      total_centavos: TOTAL_DEL_GRUPO,
    });
    for (const absorbida of demas) {
      expect(await ordenPersistida(absorbida)).toMatchObject({
        estado: 'absorbida',
        total_centavos: 0n,
      });
    }
    const lineas = await obtenerDb()
      .selectFrom('orden_lineas')
      .select(['orden_id'])
      .where('orden_id', 'in', [...f.cuentas])
      .where('anulada_en', 'is', null)
      .execute();
    expect(lineas).toHaveLength(MESAS * 4);
    expect(new Set(lineas.map((l) => l.orden_id))).toEqual(new Set([principal]));
  });

  it('c · cada renglón dice de qué mesa vino; los de la propia 1, ninguna', async () => {
    const lineas = await obtenerDb()
      .selectFrom('orden_lineas')
      .select(['mesa_origen_numero as origen'])
      .where('orden_id', '=', f.cuentas[0] ?? '')
      .execute();
    const cuantas = new Map<number | null, number>();
    for (const l of lineas) cuantas.set(l.origen, (cuantas.get(l.origen) ?? 0) + 1);
    expect(Object.fromEntries(cuantas)).toEqual({ null: 4, 2: 4, 3: 4, 4: 4, 5: 4 });
  });

  it('d · cada platillo conserva su estado: cinco en cada uno de los cuatro', async () => {
    const items = await itemsDe(f.cuentas[0] ?? '');
    expect(items).toHaveLength(MESAS * 4);
    for (const estado of ESTADOS) {
      expect(
        items.filter((i) => i.estado === estado),
        estado,
      ).toHaveLength(MESAS);
    }
  });

  it('e · cocina dice la mesa principal: ninguna comanda quedó a nombre de una mesa que ya no cuenta', async () => {
    const items = await itemsDe(f.cuentas[0] ?? '');
    expect(new Set(items.map((i) => i.mesaDeLaComanda))).toEqual(new Set([mesa(f.salon, 0)]));
  });

  it('f · el aviso de «listo» es del mesero de la principal, con todo lo listo del grupo', async () => {
    const leer = async (empleoId: string) =>
      exigirOk(
        await comando(avisosDeListo, {
          entrada: {},
          ambito: { ...ambitoDeCaja(f.salon), rol: 'mesero' as const, empleoId },
          idempotencyKey: clave(),
        }),
        'avisos',
      ).avisos.filter((a) => a.ordenId === f.cuentas[0]);
    const deAna = await leer(f.meseroA);
    expect(deAna.length).toBeGreaterThan(0);
    expect(new Set(deAna.map((a) => a.mesaNumero))).toEqual(new Set([1]));
    expect(deAna.flatMap((a) => a.platillos)).toHaveLength(MESAS);
    expect(await leer(f.meseroB)).toHaveLength(0);
  });

  it('g · las mesas que entraron quedan ocultas y sin cuenta, con la gente en la principal', async () => {
    for (const i of [1, 2, 3, 4]) {
      expect(await mesaPersistida(mesa(f.salon, i)), `mesa ${String(i + 1)}`).toMatchObject({
        orden_activa_id: null,
        unida_a_mesa_id: mesa(f.salon, 0),
      });
    }
    expect((await mesaPersistida(mesa(f.salon, 0))).orden_activa_id).toBe(f.cuentas[0]);
  });
});

describe('la precuenta, el cobro y separar tras armar el grupo por partes', () => {
  let f: Flujo;
  beforeAll(async () => {
    f = await armarElFlujo();
  }, 300_000);

  it('h · la precuenta sale una vez, con la mesa de cada renglón, y las cuentas absorbidas no tienen hoja', async () => {
    const hoja = exigirOk(
      await comando(imprimirPrecuenta, {
        entrada: { ordenId: f.cuentas[0] ?? '', anchoMm: 80 },
        ambito: ambitoDeCaja(f.salon),
        idempotencyKey: clave(),
      }),
      'precuenta del grupo',
    );
    expect(hoja).toMatchObject({
      mesaNumero: 1,
      copia: 1,
      totalCentavos: TOTAL_DEL_GRUPO.toString(),
    });
    expect(hoja.lineas).toHaveLength(MESAS * 4);
    const deMesa = (n: number | null) => hoja.lineas.filter((l) => l.mesaOrigen === n).length;
    expect([deMesa(null), deMesa(2), deMesa(3), deMesa(4), deMesa(5)]).toEqual([4, 4, 4, 4, 4]);
    const deOtra = await comando(imprimirPrecuenta, {
      entrada: { ordenId: f.cuentas[1] ?? '', anchoMm: 80 },
      ambito: ambitoDeCaja(f.salon),
      idempotencyKey: clave(),
    });
    expect(deOtra.ok).toBe(false);
  });

  it('i · se cobra UNA vez por el total exacto y la principal pasa a limpieza', async () => {
    await pedirLaCuenta(f.salon, f.cuentas[0] ?? '', 1_000);
    exigirOk(
      await cobrarExacto(ambitoDeCaja(f.salon), f.cuentas[0] ?? '', Number(TOTAL_DEL_GRUPO)),
      'cobrar el grupo',
    );
    const pagos = await pagosDe(f.cuentas);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]).toMatchObject({ orden_id: f.cuentas[0], monto_centavos: TOTAL_DEL_GRUPO });
    expect(await mesaPersistida(mesa(f.salon, 0))).toMatchObject({ estado: 'limpieza' });
  });

  it('j · al final se separa: cada mesa vuelve libre a su lugar y la cuenta se queda en la principal', async () => {
    exigirOk(
      await comando(separarMesasComando, {
        entrada: { unionId: f.unionId },
        ambito: ambitoDeCaja(f.salon),
        idempotencyKey: clave(),
      }),
      'separar',
    );
    for (const i of [1, 2, 3, 4]) {
      expect(await mesaPersistida(mesa(f.salon, i)), `mesa ${String(i + 1)}`).toMatchObject({
        estado: 'libre',
        orden_activa_id: null,
        unida_a_mesa_id: null,
      });
      expect(await posicion(mesa(f.salon, i))).toEqual([100 + i * 200, 100]);
    }
    expect((await mesaPersistida(mesa(f.salon, 0))).orden_activa_id).toBe(f.cuentas[0]);
  });
});
