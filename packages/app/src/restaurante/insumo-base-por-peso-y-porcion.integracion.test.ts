import { randomUUID } from 'node:crypto';

import { ErrorDominio } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { guardarReceta } from '../inventario/recetas.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { escribir } from '../puente/escribir.ts';
import { abrirMesa } from './mesas.ts';
import { enviarPedido } from './pedido.ts';
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
 * DP-18 · A3 y A2 · LOS PRODUCTOS POR PESO Y POR PORCIÓN BAJAN SU INGREDIENTE BASE, contra Postgres.
 *
 * Se crean EXACTAMENTE como lo hace la pantalla de Recetas (la escritura genérica del puente,
 * con los campos de `RecetaFormDialog`) y, igual que ella, se llama a `inventario.guardar_receta`
 * con la lista vacía. Después se venden y se LEE la existencia del insumo base.
 *
 *   · 0.25 kg de un queso que se lleva en gramos  → bajan 250 g;
 *   · 3 «shots» de una botella de 750 ml en 25 porciones (30 ml) → bajan 90 ml;
 *   · el de porción sin `ml_por_porcion` y con `unidad_variable: ''` ya no da 500: se deriva y se
 *     guarda; lo que de verdad falta se rechaza con 422 y su mensaje.
 */

let salon: Salon;
let quesoId = '';
let tequilaId = '';
const EXISTENCIA_QUESO = 10_000;
const EXISTENCIA_TEQUILA = 3_000;

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

async function existenciaDe(insumoId: string): Promise<number> {
  const fila = await obtenerDb()
    .selectFrom('existencias')
    .select('cantidad')
    .where('insumo_id', '=', insumoId)
    .executeTakeFirstOrThrow();
  return Number(fila.cantidad);
}

/** Lo que hace `RecetaFormDialog.handleSave`: crear por el puente y guardar la receta VACÍA. */
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

async function estrategiaDe(productoId: string): Promise<string> {
  const fila = await obtenerDb()
    .selectFrom('productos')
    .select(['estrategia_consumo', 'ml_por_porcion'])
    .where('id', '=', productoId)
    .executeTakeFirstOrThrow();
  return fila.estrategia_consumo;
}

/** Abre una mesa, pide la línea, pide la cuenta y la cobra entera. */
async function venderYCobrar(
  indiceDeMesa: number,
  productoId: string,
  cantidad: string,
): Promise<void> {
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
      entrada: { ordenId, lineas: [{ productoId, cantidad }] },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.enviar_pedido',
  );
  await pedirLaCuenta(salon, ordenId);
  const total = Number((await ordenPersistida(ordenId)).total_centavos);
  exigirOk(await cobrarExacto(ambitoDeCaja(salon), ordenId, total), 'venta.cobrar');
}

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Insumo base por peso y porción', mesas: 4 });
  await abrirLasCajas(salon);
  quesoId = await sembrarInsumo('Queso', 'g', EXISTENCIA_QUESO);
  tequilaId = await sembrarInsumo('Tequila', 'ml', EXISTENCIA_TEQUILA);
});

describe('A3 · por peso: «Variable por medida» con su ingrediente base', () => {
  it('queda con la estrategia insumo_base y la venta baja los gramos del queso', async () => {
    const productoId = await crearComoLaPantalla({
      nombre: 'Queso por kilo',
      precio_venta: 0,
      tipo_venta: 'variable_medida',
      ingrediente_base_id: quesoId,
      unidad_variable: 'kg',
      precio_por_unidad_variable: 200,
    });
    expect(await estrategiaDe(productoId)).toBe('insumo_base');

    await venderYCobrar(0, productoId, '0.25');

    expect(await existenciaDe(quesoId)).toBe(EXISTENCIA_QUESO - 250);
  });
});

describe('A3 + A2 · por porción de contenedor', () => {
  it('sin ml_por_porcion y con unidad_variable vacía: se crea, se deriva y la venta baja 90 ml', async () => {
    const productoId = await crearComoLaPantalla({
      nombre: 'Shot de tequila',
      precio_venta: 0,
      tipo_venta: 'porcion_contenedor',
      ingrediente_base_id: tequilaId,
      unidad_variable: '',
      capacidad_contenedor_ml: 750,
      porciones_por_contenedor: 25,
      nombre_porcion: 'shot',
      precio_por_porcion: 80,
    });
    const fila = await obtenerDb()
      .selectFrom('productos')
      .select(['estrategia_consumo', 'ml_por_porcion', 'unidad_variable'])
      .where('id', '=', productoId)
      .executeTakeFirstOrThrow();
    expect(fila.estrategia_consumo).toBe('insumo_base');
    expect(Number(fila.ml_por_porcion)).toBe(30);
    expect(fila.unidad_variable).toBeNull();

    await venderYCobrar(1, productoId, '3');

    expect(await existenciaDe(tequilaId)).toBe(EXISTENCIA_TEQUILA - 90);
  });

  it('sin capacidad se rechaza con CATALOGO_INVALIDO (422), no con un 500 de la base', async () => {
    const intento = conTransaccion((tx) =>
      escribir(tx, ambitoPuente(), {
        entidad: 'ProductoTerminado',
        operacion: 'create',
        datos: {
          nombre: 'Shot sin botella',
          precio_venta: 0,
          tipo_venta: 'porcion_contenedor',
          ingrediente_base_id: tequilaId,
          area_preparacion: 'cocina',
          unidad_variable: '',
          porciones_por_contenedor: 25,
          precio_por_porcion: 80,
        },
      }),
    );
    await expect(intento).rejects.toBeInstanceOf(ErrorDominio);
    await expect(intento).rejects.toMatchObject({ codigo: 'CATALOGO_INVALIDO' });
  });

  it('por medida con unidad vacía se rechaza con su mensaje', async () => {
    const intento = conTransaccion((tx) =>
      escribir(tx, ambitoPuente(), {
        entidad: 'ProductoTerminado',
        operacion: 'create',
        datos: {
          nombre: 'Queso sin unidad',
          precio_venta: 0,
          tipo_venta: 'variable_medida',
          area_preparacion: 'cocina',
          unidad_variable: '',
          precio_por_unidad_variable: 200,
        },
      }),
    );
    await expect(intento).rejects.toThrow(/necesita su unidad/);
  });
});

describe('A3 · editar tampoco lo devuelve a sku', () => {
  it('cambiar el ingrediente base de un producto viejo en sku lo pasa a insumo_base', async () => {
    const viejo = (
      await obtenerDb()
        .insertInto('productos')
        .values({
          organizacion_id: salon.negocio.organizacionId,
          nombre: 'Queso viejo',
          precio_venta_centavos: 20_000n,
          tipo_venta: 'variable_medida',
          unidad_venta: 'kg',
          unidad_variable: 'kg',
          precio_por_unidad_variable_centavos: 20_000n,
          estrategia_consumo: 'sku',
          area_preparacion: 'cocina',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await conTransaccion((tx) =>
      escribir(tx, ambitoPuente(), {
        entidad: 'ProductoTerminado',
        operacion: 'update',
        id: viejo,
        datos: { ingrediente_base_id: quesoId },
      }),
    );
    expect(await estrategiaDe(viejo)).toBe('insumo_base');
  });
});

describe('DP-18 · lo que pasó por cocina se cobra aunque el almacén diga que no había', () => {
  it('el ingrediente base sin existencias no traba el cobro: queda en negativo para el conteo', async () => {
    // Un insumo recién dado de alta, sin inventario cargado (lo normal el primer día): el
    // producto no permite vender sin existencias (el valor por omisión de la columna).
    const carneId = await sembrarInsumo('Carne sin contar', 'g', 0);
    const productoId = await crearComoLaPantalla({
      nombre: 'Carne por kilo',
      precio_venta: 0,
      tipo_venta: 'variable_medida',
      ingrediente_base_id: carneId,
      unidad_variable: 'kg',
      precio_por_unidad_variable: 300,
    });

    // La cocina ya la preparó y el comensal ya comió: frenar el cobro sólo detiene la caja.
    await venderYCobrar(2, productoId, '0.5');

    expect(await existenciaDe(carneId)).toBe(-500);
  });
});
