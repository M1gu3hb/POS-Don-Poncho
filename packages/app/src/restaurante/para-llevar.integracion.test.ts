import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { hojaDelCorte } from '../caja/corte/documento.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { asignarNumeroParaLlevar } from '../venta/numero-para-llevar.ts';
import { armarParaLlevar, descartarParaLlevar } from './para-llevar.ts';
import { paraLlevarDelDia } from './para-llevar-del-dia.ts';
import { entregarParaLlevar } from './para-llevar-entregar.ts';
import { transicionarPedido } from './preparacion.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrar,
  ordenPersistida,
  sembrarSalon,
  sumaDeLosPagos,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-16 · EL PEDIDO PARA LLEVAR, de la caja a la cocina y de vuelta a la caja, contra Postgres.
 *
 * Barbacoa ½ kg con su opción y su nota → «Cobrar» arma el borrador (nada sale a cocina) → el
 * cobro toma el número del día y manda la comanda en la misma transacción → la cocina marca
 * «listo» → el pedido NO se entrega solo (la caja lo ve «listo») → «Entregado». Y dos cajas que
 * cobran a la vez no se llevan el mismo número.
 */

const PRECIO_KILO = 79_500n;
const MEDIO_KILO = 39_750;

let salon: Salon;
let barbacoaId = '';
let grupoId = '';
let maiz = '';
let sesiones: string[] = [];
const caja = (terminal = 0) => ambitoDeCaja(salon, terminal);

async function sembrarBarbacoaConTortillas(): Promise<void> {
  const db = obtenerDb();
  const org = salon.negocio.organizacionId;
  const fila = await db
    .insertInto('productos')
    .values({
      organizacion_id: org,
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
  barbacoaId = fila.id;
  const grupo = await db
    .insertInto('modificadores')
    .values({ organizacion_id: org, nombre: 'Tortillas', obligatorio: true, tipo: 'unica' })
    .returning('id')
    .executeTakeFirstOrThrow();
  grupoId = grupo.id;
  const opciones = await db
    .insertInto('modificador_opciones')
    .values([
      { modificador_id: grupoId, nombre: 'Maíz', orden: 1 },
      { modificador_id: grupoId, nombre: 'Harina', orden: 2 },
    ])
    .returning(['id', 'nombre'])
    .execute();
  maiz = opciones.find((o) => o.nombre === 'Maíz')?.id ?? '';
  await db
    .insertInto('producto_modificadores')
    .values({ organizacion_id: org, producto_id: barbacoaId, modificador_id: grupoId })
    .execute();
}

async function armar(terminal: number, nombrePedido?: string) {
  return exigirOk(
    await comando(armarParaLlevar, {
      entrada: {
        ...(nombrePedido === undefined ? {} : { nombrePedido }),
        lineas: [
          {
            productoId: barbacoaId,
            cantidad: '0.5',
            unidad: 'kg',
            notas: 'Bien dorada, sin cebolla',
            opciones: [{ grupoId, opcionIds: [maiz] }],
          },
        ],
      },
      ambito: caja(terminal),
      idempotencyKey: clave(),
    }),
    'restaurante.armar_para_llevar',
  );
}

async function comandasDe(ordenId: string) {
  return obtenerDb()
    .selectFrom('comandas')
    .select(['id', 'estado'])
    .where('orden_id', '=', ordenId)
    .execute();
}

async function pedidosDelDia() {
  return exigirOk(
    await comando(paraLlevarDelDia, { entrada: {}, ambito: caja(), idempotencyKey: clave() }),
    'restaurante.para_llevar_del_dia',
  ).pedidos;
}

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Para llevar', mesas: 2, terminales: 2 });
  sesiones = await abrirLasCajas(salon, 50_000);
  await sembrarBarbacoaConTortillas();
});

describe('DP-16 · el pedido para llevar de punta a punta', () => {
  it('armar no manda nada a cocina; el cobro numera y comanda; «listo» espera a «Entregado»', async () => {
    const { ordenId, totalCentavos } = await armar(0, 'Don Beto');
    expect(totalCentavos).toBe(String(MEDIO_KILO));
    expect(await comandasDe(ordenId)).toHaveLength(0);
    const borrador = await obtenerDb()
      .selectFrom('ordenes')
      .select(['canal', 'nombre_pedido', 'estado', 'numero_pedido'])
      .where('id', '=', ordenId)
      .executeTakeFirstOrThrow();
    expect(borrador).toMatchObject({
      canal: 'llevar',
      nombre_pedido: 'Don Beto',
      estado: 'borrador',
      numero_pedido: null,
    });

    const cobro = exigirOk(
      await cobrar(caja(0), ordenId, MEDIO_KILO, [
        { metodo: 'efectivo', montoCentavos: MEDIO_KILO, recibidoCentavos: 50_000 },
      ]),
      'venta.cobrar',
    );
    expect(cobro.numeroPedido).toBeGreaterThanOrEqual(1);
    expect((await ordenPersistida(ordenId)).estado).toBe('pagada');
    expect(await sumaDeLosPagos([ordenId])).toBe(BigInt(MEDIO_KILO));

    // La comanda salió con el cobro, con su nota y su opción.
    const comandas = await comandasDe(ordenId);
    expect(comandas).toHaveLength(1);
    const linea = await obtenerDb()
      .selectFrom('orden_lineas as l')
      .leftJoin('orden_linea_modificadores as m', 'm.orden_linea_id', 'l.id')
      .select(['l.notas', 'l.cantidad', 'm.opcion_nombre'])
      .where('l.orden_id', '=', ordenId)
      .executeTakeFirstOrThrow();
    expect(linea.notas).toContain('sin cebolla');
    expect(linea.opcion_nombre).toBe('Maíz');

    // La cocina lo termina: NO se entrega solo, la caja lo ve «listo».
    const comandaId = comandas[0]?.id ?? '';
    exigirOk(
      await comando(transicionarPedido, {
        entrada: { comandaId, estado: 'listo' },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.transicionar_pedido',
    );
    expect((await comandasDe(ordenId))[0]?.estado).toBe('listo');
    const items = await obtenerDb()
      .selectFrom('comanda_items')
      .select('estado')
      .where('comanda_id', '=', comandaId)
      .execute();
    expect(items.every((i) => i.estado === 'listo')).toBe(true);
    const listo = (await pedidosDelDia()).find((p) => p.ordenId === ordenId);
    expect(listo).toMatchObject({
      estado: 'listo',
      nombre: 'Don Beto',
      numero: cobro.numeroPedido,
    });

    // «Entregado» desde la caja.
    exigirOk(
      await comando(entregarParaLlevar, {
        entrada: { ordenId },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.entregar_para_llevar',
    );
    expect((await comandasDe(ordenId))[0]?.estado).toBe('entregado');
    expect((await pedidosDelDia()).find((p) => p.ordenId === ordenId)?.estado).toBe('entregado');
  });

  it('si se cancela el cobro, el borrador queda vacío y la cocina no se entera', async () => {
    const { ordenId } = await armar(0);
    exigirOk(
      await comando(descartarParaLlevar, {
        entrada: { ordenId },
        ambito: caja(0),
        idempotencyKey: clave(),
      }),
      'restaurante.descartar_para_llevar',
    );
    const lineas = await obtenerDb()
      .selectFrom('orden_lineas')
      .select('id')
      .where('orden_id', '=', ordenId)
      .execute();
    expect(lineas).toHaveLength(0);
    const orden = await obtenerDb()
      .selectFrom('ordenes')
      .select(['canal', 'nombre_pedido', 'numero_pedido'])
      .where('id', '=', ordenId)
      .executeTakeFirstOrThrow();
    expect(orden).toEqual({ canal: 'aqui', nombre_pedido: null, numero_pedido: null });
    expect(await comandasDe(ordenId)).toHaveLength(0);
  });

  it('otra caja no le vacía a ésta su pedido a medio cobrar', async () => {
    const { ordenId } = await armar(0);
    const otra = exigirOk(
      await comando(descartarParaLlevar, {
        entrada: { ordenId },
        ambito: caja(1),
        idempotencyKey: clave(),
      }),
      'restaurante.descartar_para_llevar',
    );
    expect(otra.quitadas).toBe(0);
    const lineas = await obtenerDb()
      .selectFrom('orden_lineas')
      .select('id')
      .where('orden_id', '=', ordenId)
      .execute();
    expect(lineas).toHaveLength(1);
  });

  it('volver a tocar «Cobrar» reemplaza el pedido, no lo duplica', async () => {
    const primero = await armar(0);
    const segundo = await armar(0);
    expect(segundo.ordenId).toBe(primero.ordenId);
    expect(segundo.lineas).toBe(1);
    expect(segundo.totalCentavos).toBe(String(MEDIO_KILO));
  });

  it('dos cajas que cobran a la vez se llevan números distintos y seguidos', async () => {
    const [a, b] = await Promise.all([armar(0, 'Ana'), armar(1, 'Beto')]);
    const [cobroA, cobroB] = await Promise.all([
      cobrar(caja(0), a.ordenId, MEDIO_KILO, [{ metodo: 'efectivo', montoCentavos: MEDIO_KILO }]),
      cobrar(caja(1), b.ordenId, MEDIO_KILO, [{ metodo: 'tarjeta', montoCentavos: MEDIO_KILO }]),
    ]);
    const nA = exigirOk(cobroA, 'venta.cobrar').numeroPedido ?? 0;
    const nB = exigirOk(cobroB, 'venta.cobrar').numeroPedido ?? 0;
    expect(nA).not.toBe(nB);
    expect(Math.abs(nA - nB)).toBe(1);
    const numeros = (await pedidosDelDia()).map((p) => p.numero);
    expect(new Set(numeros).size).toBe(numeros.length);
    expect((await comandasDe(a.ordenId)).length + (await comandasDe(b.ordenId)).length).toBe(2);
  });

  it('dos cobros que se cruzan en el tiempo no toman el mismo número (el candado)', async () => {
    const a = await armar(0);
    const b = await armar(1);
    const org = salon.negocio.organizacionId;
    const dentro = new Date(Date.now() + 3 * 86_400_000);
    // La primera transacción toma su número y se queda abierta un rato: la segunda empieza
    // mientras tanto. Sin candado leería el mismo «máximo + 1» y chocaría con el índice único.
    const primera = conTransaccion(async (tx) => {
      const n = await asignarNumeroParaLlevar(tx, org, a.ordenId, dentro);
      await sql`select pg_sleep(0.4)`.execute(tx);
      return n.numero;
    });
    await new Promise((listo) => setTimeout(listo, 100));
    const segunda = conTransaccion((tx) => asignarNumeroParaLlevar(tx, org, b.ordenId, dentro));
    const [na, nb] = await Promise.all([primera, segunda]);
    expect(na).toBe(1);
    expect(nb.numero).toBe(2);
    // Siguen siendo borradores de sus cajas: se les quita el número para las pruebas que siguen.
    await obtenerDb()
      .updateTable('ordenes')
      .set({ numero_pedido: null, dia_del_pedido: null })
      .where('id', 'in', [a.ordenId, b.ordenId])
      .execute();
  });

  it('el corte de cada caja trae sus pedidos para llevar con número y cuadra al centavo', async () => {
    for (const [i, sesionCajaId] of sesiones.entries()) {
      const hoja = exigirOk(
        await comando(hojaDelCorte, {
          entrada: { sesionCajaId },
          ambito: caja(i),
          idempotencyKey: clave(),
        }),
        'caja.hoja_del_corte',
      );
      const llevar = hoja.ventas.filter((v) => v.canal === 'llevar');
      expect(llevar.length).toBeGreaterThan(0);
      expect(llevar.every((v) => typeof v.numeroPedido === 'number')).toBe(true);
      const suma = hoja.ventas.reduce((s, v) => s + BigInt(v.totalCentavos), 0n);
      expect(suma.toString()).toBe(hoja.resumen.totalCentavos);
    }
  });

  it('el número vuelve a 1 al día siguiente del negocio', async () => {
    const { ordenId } = await armar(0);
    const manana = new Date(Date.now() + 26 * 3_600_000);
    const asignado = await conTransaccion((tx) =>
      asignarNumeroParaLlevar(tx, salon.negocio.organizacionId, ordenId, manana),
    );
    expect(asignado.numero).toBe(1);
    // Y no se lo cambia un segundo intento.
    const otraVez = await conTransaccion((tx) =>
      asignarNumeroParaLlevar(tx, salon.negocio.organizacionId, ordenId, new Date()),
    );
    expect(otraVez).toEqual(asignado);
  });
});
