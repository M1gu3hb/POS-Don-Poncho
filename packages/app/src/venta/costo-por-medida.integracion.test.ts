import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { guardarReceta } from '../inventario/recetas.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { escribir } from '../puente/escribir.ts';
import { resumenDelPeriodo } from '../registros/resumen-del-periodo.ts';
import { abrirMesa } from '../restaurante/mesas.ts';
import { enviarPedido } from '../restaurante/pedido.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  mesaDe,
  ordenPersistida,
  pedirLaCuenta,
  sembrarSalon,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';

/**
 * DP-D180 · HALLAZGO 27 · EL COSTO DE LO QUE SE VENDE POR KILO O POR PORCIÓN, contra Postgres.
 *
 * Un platillo por medida o por porción de un contenedor (`estrategia_consumo = 'insumo_base'`)
 * BAJA su insumo base, pero su renglón se guardaba con costo cero —`productos.costo_unitario_centavos`
 * sólo lo llena la receta— y el margen de Registros lo dejaba fuera (de «Utilidad bruta» y de la base
 * del 72.4 %). Ahora el costo del renglón sale del MISMO cálculo que el consumo: lo que baja × el costo
 * EXACTO del insumo al cobrar, redondeado UNA vez al centavo (DP-D165).
 *
 * Los números NO redondean bonito a propósito, para que el costo en centavos enteros, el redondeo por
 * pieza y el exacto den cada uno una cifra distinta:
 *
 *   · Barbacoa: 34.567 ¢/g (345 670 dmc; en centavos enteros, 35). ½ kg = 500 g = 17 283.5 → 17 284;
 *     0.35 kg = 350 g = 12 098.45 → 12 098. Con 35 ¢/g serían 17 500 y 12 250.
 *   · Mezcal por copa: 750 ml ÷ 16 = 46.875 ml la copa, a 2.7345 ¢/ml (27 345 dmc; en centavos, 3).
 *     3 copas = 140.625 ml = 384.539… → 385. Redondeando cada copa (128.18 → 128) saldrían 384; con 3 ¢/ml,
 *     422.
 */

let salon: Salon;
let barbacoaInsumoId = '';
let mezcalInsumoId = '';
let barbacoaId = '';
let copaId = '';
let sinCostoId = '';
let conRecetaId = '';

const PRECIO_KILO = 795; // pesos por kg
const PRECIO_COPA = 90; // pesos por copa
const COSTO_BARBACOA_DMC = 345_670n;
const COSTO_MEZCAL_DMC = 27_345n;

const ambitoDueno = () => ({ ...ambitoDeCaja(salon), rol: 'dueno' as const });
const ambitoPuente = () => ({
  organizacionId: salon.negocio.organizacionId,
  sucursalId: salon.sucursal.sucursalId,
  rol: 'dueno',
});

async function sembrarInsumo(
  nombre: string,
  unidad: 'g' | 'ml',
  existencia: number,
  costoDmc: bigint,
): Promise<string> {
  const db = obtenerDb();
  const id = randomUUID();
  await db
    .insertInto('insumos')
    .values({
      id,
      organizacion_id: salon.negocio.organizacionId,
      nombre: `${nombre} ${id.slice(0, 6)}`,
      unidad_base: unidad,
      // El de centavos es el exacto redondeado (lo exige un `check`).
      costo_unitario_centavos: (costoDmc + 5_000n) / 10_000n,
      costo_exacto_dmc: costoDmc,
    })
    .execute();
  await db
    .insertInto('existencias')
    .values({
      organizacion_id: salon.negocio.organizacionId,
      almacen_id: salon.sucursal.almacenId,
      insumo_id: id,
      cantidad: String(existencia),
    })
    .execute();
  return id;
}

/** Lo que hace la pantalla de Recetas: crear por el puente y guardar la receta VACÍA. */
async function crearComoLaPantalla(datos: Record<string, unknown>): Promise<string> {
  const creado = await conTransaccion((tx) =>
    escribir(tx, ambitoPuente(), {
      entidad: 'ProductoTerminado',
      operacion: 'create',
      datos: { area_preparacion: 'cocina', visible_en_pos: true, activo: true, ...datos },
    }),
  );
  const productoId = String(creado['id']);
  exigirOk(
    await comando(guardarReceta, {
      entrada: { productoId, ingredientes: [] },
      ambito: ambitoDueno(),
      idempotencyKey: clave(),
    }),
    'inventario.guardar_receta',
  );
  return productoId;
}

/** Abre la mesa, pide las líneas, pide la cuenta y la cobra entera. Devuelve la orden. */
async function venderYCobrar(
  indiceDeMesa: number,
  lineas: readonly (readonly [string, string])[],
): Promise<string> {
  const { ordenId } = exigirOk(
    await comando(abrirMesa, {
      entrada: { mesaId: mesaDe(salon, indiceDeMesa), personas: 2 },
      ambito: ambitoDeCaja(salon),
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
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.enviar_pedido',
  );
  await pedirLaCuenta(salon, ordenId);
  const total = Number((await ordenPersistida(ordenId)).total_centavos);
  exigirOk(await cobrarExacto(ambitoDeCaja(salon), ordenId, total), 'venta.cobrar');
  return ordenId;
}

async function lineasPersistidas(ordenId: string) {
  return obtenerDb()
    .selectFrom('orden_lineas')
    .select([
      'cantidad',
      'total_centavos',
      'costo_unitario_centavos',
      'utilidad_centavos',
      'producto_id',
    ])
    .where('orden_id', '=', ordenId)
    .where('anulada_en', 'is', null)
    .orderBy('orden_visual')
    .execute();
}

async function ordenConSuCosto(ordenId: string) {
  return obtenerDb()
    .selectFrom('ordenes')
    .select(['total_centavos', 'subtotal_centavos', 'costo_total_centavos', 'utilidad_centavos'])
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();
}

async function existenciaDe(insumoId: string): Promise<string> {
  const fila = await obtenerDb()
    .selectFrom('existencias')
    .select('cantidad')
    .where('insumo_id', '=', insumoId)
    .executeTakeFirstOrThrow();
  return fila.cantidad;
}

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Costo por medida', mesas: 8 });
  await abrirLasCajas(salon);
  barbacoaInsumoId = await sembrarInsumo('Barbacoa', 'g', 50_000, COSTO_BARBACOA_DMC);
  mezcalInsumoId = await sembrarInsumo('Mezcal', 'ml', 10_000, COSTO_MEZCAL_DMC);
  const sinCostoInsumoId = await sembrarInsumo('Costillar sin costo', 'g', 50_000, 0n);

  barbacoaId = await crearComoLaPantalla({
    nombre: 'Barbacoa por kilo',
    precio_venta: 0,
    tipo_venta: 'variable_medida',
    ingrediente_base_id: barbacoaInsumoId,
    unidad_variable: 'kg',
    precio_por_unidad_variable: PRECIO_KILO,
  });
  copaId = await crearComoLaPantalla({
    nombre: 'Copa de mezcal',
    precio_venta: 0,
    tipo_venta: 'porcion_contenedor',
    ingrediente_base_id: mezcalInsumoId,
    unidad_variable: '',
    capacidad_contenedor_ml: 750,
    porciones_por_contenedor: 16,
    nombre_porcion: 'copa',
    precio_por_porcion: PRECIO_COPA,
  });
  sinCostoId = await crearComoLaPantalla({
    nombre: 'Costillar por kilo, insumo sin costo',
    precio_venta: 0,
    tipo_venta: 'variable_medida',
    ingrediente_base_id: sinCostoInsumoId,
    unidad_variable: 'kg',
    precio_por_unidad_variable: 400,
  });
  // Un platillo con receta (la regla de siempre): no debe cambiar.
  conRecetaId = salon.platillos.guacamole;
});

describe('DP-D180 · por kilo: el renglón guarda lo que bajó × el costo exacto del insumo', () => {
  let ordenId = '';

  beforeAll(async () => {
    ordenId = await venderYCobrar(0, [
      [barbacoaId, '0.5'],
      [barbacoaId, '0.35'],
    ]);
  });

  it('baja 850 g del insumo base (lo que se cobra y lo que baja no cambian)', async () => {
    expect(Number(await existenciaDe(barbacoaInsumoId))).toBe(50_000 - 850);
    const lineas = await lineasPersistidas(ordenId);
    expect(lineas.map((l) => l.total_centavos)).toEqual([39_750n, 27_825n]);
  });

  it('cada renglón guarda su costo exacto, redondeado una vez: 17 284 y 12 098 ¢', async () => {
    const lineas = await lineasPersistidas(ordenId);
    // Costo por kg: 34.567 ¢/g × 1 000 g = 34 567 ¢ (el de centavos enteros diría 35 000).
    expect(lineas.map((l) => l.costo_unitario_centavos)).toEqual([34_567n, 34_567n]);
    // La utilidad del renglón es total − costo (el invariante de F1-04 §7.3).
    expect(lineas.map((l) => l.total_centavos - l.utilidad_centavos)).toEqual([17_284n, 12_098n]);
  });

  it('la cuenta suma el costo de los dos renglones y deja su utilidad', async () => {
    const orden = await ordenConSuCosto(ordenId);
    expect(orden.costo_total_centavos).toBe(17_284n + 12_098n);
    expect(orden.utilidad_centavos).toBe(orden.subtotal_centavos - (17_284n + 12_098n));
  });
});

describe('DP-D180 · por porción de un contenedor: 750 ml ÷ 16 = 46.875 ml la copa', () => {
  let ordenId = '';

  beforeAll(async () => {
    ordenId = await venderYCobrar(1, [[copaId, '3']]);
  });

  it('baja 140.625 ml y el renglón cuesta 385 ¢ (no 384 por copa redondeada ni 422 por centavos)', async () => {
    expect(Number(await existenciaDe(mezcalInsumoId))).toBeCloseTo(10_000 - 140.625, 4);
    const [linea] = await lineasPersistidas(ordenId);
    expect(linea?.total_centavos).toBe(27_000n);
    expect((linea?.total_centavos ?? 0n) - (linea?.utilidad_centavos ?? 0n)).toBe(385n);
    // Por copa: 46.875 ml × 2.7345 = 128.1796875 → 128.
    expect(linea?.costo_unitario_centavos).toBe(128n);
    expect((await ordenConSuCosto(ordenId)).costo_total_centavos).toBe(385n);
  });
});

describe('DP-D180 · Registros, el corte y «sin receta» lo cuentan', () => {
  it('con costo conocido: no es «sin receta» y entra a la base del margen', async () => {
    const ordenId = await venderYCobrar(2, [[barbacoaId, '0.5']]);
    const orden = await ordenConSuCosto(ordenId);
    expect(orden.costo_total_centavos).toBe(17_284n);

    const resumen = exigirOk(
      await comando(resumenDelPeriodo, {
        entrada: { desde: '2026-01-01', hasta: '2030-12-31' },
        ambito: ambitoDueno(),
        idempotencyKey: clave(),
      }),
      'registros.resumen',
    );
    expect(resumen.ventas.sinReceta).toBe(0);
    // Las tres cuentas por medida de arriba entran con su costo: 17 284 + 12 098 + 385 + 17 284.
    expect(resumen.ventas.costoCentavos).toBe(String(17_284n + 12_098n + 385n + 17_284n));
    expect(BigInt(resumen.ventas.ventaConCostoCentavos)).toBeGreaterThan(0n);
  });

  it('un insumo base SIN costo sigue siendo costo desconocido (no se inventa uno)', async () => {
    const ordenId = await venderYCobrar(3, [[sinCostoId, '0.25']]);
    const [linea] = await lineasPersistidas(ordenId);
    expect(linea?.costo_unitario_centavos).toBe(0n);
    expect((await ordenConSuCosto(ordenId)).costo_total_centavos).toBe(0n);
  });

  it('un platillo con receta se cobra con el costo de siempre, aunque sus insumos ya tengan costo exacto', async () => {
    // Los insumos de la receta con costo conocido: si el cobro tratara la receta como «por medida» (que no
    // lo es), el renglón se re-costaría con lo que baja × este costo y dejaría de ser el de la receta.
    const db = obtenerDb();
    const deLaReceta = await db
      .selectFrom('recetas')
      .select('insumo_id')
      .where('producto_id', '=', conRecetaId)
      .execute();
    expect(deLaReceta.length).toBeGreaterThan(0);
    await db
      .updateTable('insumos')
      .set({ costo_exacto_dmc: 7_654_321n })
      .where(
        'id',
        'in',
        deLaReceta.map((r) => r.insumo_id),
      )
      .execute();
    const ordenId = await venderYCobrar(4, [[conRecetaId, '1']]);
    const [linea] = await lineasPersistidas(ordenId);
    const producto = await obtenerDb()
      .selectFrom('productos')
      .select('costo_unitario_centavos')
      .where('id', '=', conRecetaId)
      .executeTakeFirstOrThrow();
    expect(linea?.costo_unitario_centavos).toBe(producto.costo_unitario_centavos);
  });
});
