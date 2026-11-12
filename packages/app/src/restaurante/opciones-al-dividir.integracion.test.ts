import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { opcionesVendidasEn } from '../caja/corte/opciones-vendidas.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { dividirCuentaComando } from './division.ts';
import { abrirMesa } from './mesas.ts';
import { enviarPedido } from './pedido.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  mesaDe,
  pedirLaCuenta,
  sembrarSalon,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-18 · M5 (auditoría del 10-11) · DIVIDIR UNA LÍNEA CON OPCIÓN «POR RENGLÓN» Y EL CORTE.
 *
 * En lo que va por peso o por porción, la opción se cobra UNA vez por renglón (DP-D104): 2 copitas
 * de mezcal con «sal de gusano» (+$20) pagan $20, no $40. Al dividir la cuenta, la línea de 2
 * porciones se parte en dos renglones (uno por parte) y cada uno copiaba la opción con su precio
 * entero: el corte decía «Sal de gusano · $40.00» con $20.00 cobrados. Lo de peso no se parte (va
 * entero a una parte, DP-14.5), y se prueba igual.
 */

let salon: Salon;
let mezcalId = '';
let barbacoaId = '';
let refrescoId = '';
const opcion = { mezcal: { grupo: '', sal: '' }, barbacoa: { grupo: '', harina: '' } };
const caja = () => ambitoDeCaja(salon, 0);

async function grupoConUnaOpcion(
  productoId: string,
  nombre: string,
  opcionNombre: string,
  delta: bigint,
) {
  const db = obtenerDb();
  const org = salon.negocio.organizacionId;
  const g = await db
    .insertInto('modificadores')
    .values({ organizacion_id: org, nombre, obligatorio: true, tipo: 'unica' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const o = await db
    .insertInto('modificador_opciones')
    .values({
      modificador_id: g.id,
      nombre: opcionNombre,
      orden: 1,
      delta_precio_centavos: delta,
      precio_extra_centavos: delta,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await db
    .insertInto('producto_modificadores')
    .values({ organizacion_id: org, producto_id: productoId, modificador_id: g.id })
    .execute();
  return { grupo: g.id, opcion: o.id };
}

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Opciones al dividir', mesas: 2, terminales: 1 });
  await abrirLasCajas(salon, 50_000);
  const db = obtenerDb();
  const org = salon.negocio.organizacionId;
  mezcalId = (
    await db
      .insertInto('productos')
      .values({
        organizacion_id: org,
        nombre: 'Mezcal por copita',
        precio_venta_centavos: 9_000n,
        costo_unitario_centavos: 0n,
        tipo_venta: 'porcion_contenedor',
        unidad_venta: 'pieza',
        capacidad_contenedor_ml: '750',
        ml_por_porcion: '50',
        nombre_porcion: 'copita',
        precio_por_porcion_centavos: 9_000n,
        estrategia_consumo: 'ninguno',
        area_preparacion: 'barra',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
  barbacoaId = (
    await db
      .insertInto('productos')
      .values({
        organizacion_id: org,
        nombre: 'Barbacoa de horno',
        precio_venta_centavos: 79_500n,
        costo_unitario_centavos: 30_000n,
        tipo_venta: 'variable_medida',
        unidad_venta: 'kg',
        unidad_variable: 'kg',
        precio_por_unidad_variable_centavos: 79_500n,
        estrategia_consumo: 'ninguno',
        area_preparacion: 'cocina',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
  refrescoId = (
    await db
      .insertInto('productos')
      .values({
        organizacion_id: org,
        nombre: 'Refresco',
        precio_venta_centavos: 3_500n,
        costo_unitario_centavos: 1_000n,
        estrategia_consumo: 'ninguno',
        area_preparacion: 'barra',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
  const m = await grupoConUnaOpcion(mezcalId, 'Para acompañar', 'Sal de gusano', 2_000n);
  opcion.mezcal = { grupo: m.grupo, sal: m.opcion };
  const b = await grupoConUnaOpcion(barbacoaId, 'Tortillas', 'Harina', 2_000n);
  opcion.barbacoa = { grupo: b.grupo, harina: b.opcion };
});

async function cuentaConLasLineas(
  indiceDeMesa: number,
  lineas: readonly Record<string, unknown>[],
): Promise<{ ordenId: string; lineaIds: readonly string[] }> {
  const { ordenId } = exigirOk(
    await comando(abrirMesa, {
      entrada: { mesaId: mesaDe(salon, indiceDeMesa), personas: 2 },
      ambito: caja(),
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  );
  exigirOk(
    await comando(enviarPedido, {
      entrada: { ordenId, lineas: [...lineas] },
      ambito: caja(),
      idempotencyKey: clave(),
    }),
    'restaurante.enviar_pedido',
  );
  await pedirLaCuenta(salon, ordenId);
  const filas = await obtenerDb()
    .selectFrom('orden_lineas')
    .select(['id', 'producto_id'])
    .where('orden_id', '=', ordenId)
    .execute();
  const lineaIds = lineas.map(
    (l) => filas.find((f) => f.producto_id === l['productoId'])?.id ?? '',
  );
  return { ordenId, lineaIds };
}

async function dividirYCobrar(
  ordenId: string,
  partes: readonly (readonly { readonly lineaId: string; readonly cantidad: number }[])[],
): Promise<bigint> {
  const r = exigirOk(
    await comando(dividirCuentaComando, {
      entrada: { ordenId, particiones: partes.map((tomas) => ({ tomas: [...tomas] })) },
      ambito: caja(),
      idempotencyKey: clave(),
    }),
    'restaurante.dividir_cuenta',
  );
  let cobrado = 0n;
  for (const h of r.hijas) {
    if (h.totalCentavos === '0') continue;
    exigirOk(await cobrarExacto(caja(), h.ordenId, Number(h.totalCentavos)), 'venta.cobrar');
    cobrado += BigInt(h.totalCentavos);
  }
  return cobrado;
}

const sesiones = () =>
  sql`select id from sesiones_caja where organizacion_id = ${salon.negocio.organizacionId}`;

describe('DP-18 · M5 · las opciones vendidas cuadran con lo cobrado al dividir', () => {
  it('dos copitas con su opción, partidas en dos cuentas: la opción suma $20 una vez', async () => {
    const { ordenId, lineaIds } = await cuentaConLasLineas(0, [
      {
        productoId: mezcalId,
        cantidad: '2',
        unidad: 'porcion',
        opciones: [{ grupoId: opcion.mezcal.grupo, opcionIds: [opcion.mezcal.sal] }],
      },
    ]);
    const lineaId = lineaIds[0] ?? '';
    const cobrado = await dividirYCobrar(ordenId, [
      [{ lineaId, cantidad: 1 }],
      [{ lineaId, cantidad: 1 }],
    ]);
    expect(cobrado).toBe(2n * 9_000n + 2_000n);
    const sal = (
      await conTransaccion((tx) => opcionesVendidasEn(tx, salon.negocio.organizacionId, sesiones()))
    ).find((o) => o.opcion === 'Sal de gusano');
    expect(sal?.importeCentavos).toBe('2000');
  });

  it('medio kilo con tortillas de harina en una cuenta dividida: la línea va entera y suma $20', async () => {
    const { ordenId, lineaIds } = await cuentaConLasLineas(1, [
      {
        productoId: barbacoaId,
        cantidad: '0.5',
        unidad: 'kg',
        opciones: [{ grupoId: opcion.barbacoa.grupo, opcionIds: [opcion.barbacoa.harina] }],
      },
      { productoId: refrescoId, cantidad: '1' },
    ]);
    const [barbacoa, refresco] = lineaIds;
    const cobrado = await dividirYCobrar(ordenId, [
      [{ lineaId: barbacoa ?? '', cantidad: 1 }],
      [{ lineaId: refresco ?? '', cantidad: 1 }],
    ]);
    expect(cobrado).toBe(39_750n + 2_000n + 3_500n);
    const harina = (
      await conTransaccion((tx) => opcionesVendidasEn(tx, salon.negocio.organizacionId, sesiones()))
    ).find((o) => o.opcion === 'Harina');
    expect(harina?.importeCentavos).toBe('2000');
  });
});
