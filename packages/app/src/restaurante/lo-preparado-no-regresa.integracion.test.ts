import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { guardarReceta } from '../inventario/recetas.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { escribir } from '../puente/escribir.ts';
import { devolverVenta } from '../venta/devolucion-de-venta.ts';
import { cancelarOrden } from './cancelacion.ts';
import { abrirMesa } from './mesas.ts';
import { enviarPedido } from './pedido.ts';
import { transicionarPedido } from './preparacion.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  mesaDe,
  ordenPersistida,
  pedirLaCuenta,
  sembrarSalon,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-22 · LO PREPARADO NO REGRESA AL ANAQUEL; LO QUE NO SE PREPARÓ, SÍ (Postgres real).
 *
 * Para un producto vendido POR PESO y uno POR PORCIÓN de contenedor, los dos con «ingrediente
 * base» (se crean como los crea la pantalla de Recetas):
 *
 *   i.   cancelar la cuenta con el platillo SIN preparar deja el almacén exactamente como estaba
 *        (el almacén sólo baja al cobrar: no había nada que regresar y no sale nada);
 *   ii.  cancelar con el platillo ya PREPARADO saca del almacén lo que se gastó, como merma «Por
 *        cancelación»: no vuelve al anaquel;
 *   iii. devolver una venta ya cobrada con «la mercancía regresa» no regresa el insumo base de lo
 *        preparado (sólo lo que se vende tal cual, por pieza, vuelve al anaquel).
 */

let salon: Salon;
let quesoId = '';
let tequilaId = '';
let indiceDeMesa = 0;
const QUESO_INICIAL = 10_000;
const TEQUILA_INICIAL = 3_000;

const ambitoPuente = () => ({
  organizacionId: salon.negocio.organizacionId,
  sucursalId: salon.sucursal.sucursalId,
  rol: 'dueno',
});

async function sembrarInsumo(nombre: string, unidad: 'g' | 'ml', existencia: number) {
  const db = obtenerDb();
  const id = randomUUID();
  await db
    .insertInto('insumos')
    .values({
      id,
      organizacion_id: salon.negocio.organizacionId,
      nombre: `${nombre} ${id.slice(0, 6)}`,
      unidad_base: unidad,
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

const existenciaDe = async (insumoId: string): Promise<number> =>
  Number(
    (
      await obtenerDb()
        .selectFrom('existencias')
        .select('cantidad')
        .where('insumo_id', '=', insumoId)
        .executeTakeFirstOrThrow()
    ).cantidad,
  );

/** Lo que hace `RecetaFormDialog`: crear por el puente y guardar la receta vacía. */
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
      ambito: { ...ambitoDeCaja(salon), rol: 'dueno' },
      idempotencyKey: clave(),
    }),
    'inventario.guardar_receta',
  );
  return productoId;
}

interface Producto {
  readonly nombre: string;
  readonly productoId: string;
  readonly insumoId: string;
  readonly cantidad: string;
  /** Lo que gasta del insumo base la cantidad pedida. */
  readonly gasto: number;
  readonly inicial: number;
}
let porPeso: Producto;
let porPorcion: Producto;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Lo preparado no regresa', mesas: 12 });
  await abrirLasCajas(salon);
  quesoId = await sembrarInsumo('Queso', 'g', QUESO_INICIAL);
  tequilaId = await sembrarInsumo('Tequila', 'ml', TEQUILA_INICIAL);
  porPeso = {
    nombre: 'Queso por kilo',
    productoId: await crearComoLaPantalla({
      nombre: 'Queso por kilo',
      precio_venta: 0,
      tipo_venta: 'variable_medida',
      ingrediente_base_id: quesoId,
      unidad_variable: 'kg',
      precio_por_unidad_variable: 200,
    }),
    insumoId: quesoId,
    cantidad: '0.25',
    gasto: 250,
    inicial: QUESO_INICIAL,
  };
  porPorcion = {
    nombre: 'Shot de tequila',
    productoId: await crearComoLaPantalla({
      nombre: 'Shot de tequila',
      precio_venta: 0,
      tipo_venta: 'porcion_contenedor',
      ingrediente_base_id: tequilaId,
      unidad_variable: '',
      capacidad_contenedor_ml: 750,
      porciones_por_contenedor: 25,
      nombre_porcion: 'shot',
      precio_por_porcion: 80,
    }),
    insumoId: tequilaId,
    cantidad: '3',
    gasto: 90,
    inicial: TEQUILA_INICIAL,
  };
}, 120_000);

/** Abre una mesa y manda el platillo a cocina. Devuelve la cuenta, su comanda y su línea. */
async function pedir(producto: Producto) {
  const { ordenId } = exigirOk(
    await comando(abrirMesa, {
      entrada: { mesaId: mesaDe(salon, indiceDeMesa), personas: 2 },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  );
  indiceDeMesa += 1;
  exigirOk(
    await comando(enviarPedido, {
      entrada: {
        ordenId,
        lineas: [{ productoId: producto.productoId, cantidad: producto.cantidad }],
      },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.enviar_pedido',
  );
  const comanda = await obtenerDb()
    .selectFrom('comandas')
    .select('id')
    .where('orden_id', '=', ordenId)
    .executeTakeFirstOrThrow();
  const linea = await obtenerDb()
    .selectFrom('orden_lineas')
    .select('id')
    .where('orden_id', '=', ordenId)
    .executeTakeFirstOrThrow();
  return { ordenId, comandaId: comanda.id, lineaId: linea.id };
}

async function prepararTodo(comandaId: string): Promise<void> {
  exigirOk(
    await comando(transicionarPedido, {
      entrada: { comandaId, estado: 'listo' },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.transicionar_pedido',
  );
}

async function cancelar(ordenId: string): Promise<void> {
  exigirOk(
    await comando(cancelarOrden, {
      entrada: { ordenId, motivo: 'El comensal se fue sin pagar' },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.cancelar_orden',
  );
}

const movimientosDe = (insumoId: string) =>
  obtenerDb()
    .selectFrom('movimientos_stock')
    .select(['tipo', 'cantidad', 'referencia_tipo'])
    .where('insumo_id', '=', insumoId)
    .execute();

describe.each([
  ['por peso', () => porPeso],
  ['por porción', () => porPorcion],
] as const)('producto vendido %s', (_etiqueta, producto) => {
  it('i · cancelar lo NO preparado deja el insumo exactamente como estaba', async () => {
    const p = producto();
    const antes = await existenciaDe(p.insumoId);
    const movimientosAntes = (await movimientosDe(p.insumoId)).length;
    const { ordenId } = await pedir(p);

    await cancelar(ordenId);

    expect(await existenciaDe(p.insumoId)).toBe(antes);
    expect(await movimientosDe(p.insumoId)).toHaveLength(movimientosAntes);
  });

  it('ii · cancelar lo ya PREPARADO no lo regresa: sale del almacén como merma «Por cancelación»', async () => {
    const p = producto();
    const antes = await existenciaDe(p.insumoId);
    const { ordenId, comandaId } = await pedir(p);
    await prepararTodo(comandaId);

    await cancelar(ordenId);

    expect(await existenciaDe(p.insumoId)).toBe(antes - p.gasto);
    const mermas = (await movimientosDe(p.insumoId)).filter(
      (m) => m.tipo === 'merma' && m.referencia_tipo === 'orden',
    );
    expect(mermas.map((m) => Number(m.cantidad))).toEqual([-p.gasto]);
  });

  it('iii · devolver la venta cobrada NO regresa el insumo base de lo que se preparó', async () => {
    const p = producto();
    const { ordenId, comandaId, lineaId } = await pedir(p);
    await prepararTodo(comandaId);
    await pedirLaCuenta(salon, ordenId);
    const total = Number((await ordenPersistida(ordenId)).total_centavos);
    exigirOk(await cobrarExacto(ambitoDeCaja(salon), ordenId, total), 'venta.cobrar');
    const trasElCobro = await existenciaDe(p.insumoId);
    const movimientosAntes = (await movimientosDe(p.insumoId)).length;

    exigirOk(
      await comando(devolverVenta, {
        entrada: {
          ordenId,
          lineas: [{ ordenLineaId: lineaId, cantidad: p.cantidad }],
          metodo: 'efectivo',
          motivo: 'El comensal no quedó conforme',
          regresaAlInventario: true,
        },
        ambito: { ...ambitoDeCaja(salon), rol: 'gerente' },
        idempotencyKey: clave(),
      }),
      'venta.devolver_venta',
    );

    expect(await existenciaDe(p.insumoId)).toBe(trasElCobro);
    expect(await movimientosDe(p.insumoId)).toHaveLength(movimientosAntes);
    // El cobro sí gastó el insumo (la prueba no pasa por no haber gastado nada).
    expect(trasElCobro).toBeLessThan(p.inicial);
  });
});
