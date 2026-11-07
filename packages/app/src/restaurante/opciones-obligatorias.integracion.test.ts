import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { enviarPedido } from './pedido.ts';
import { crearOrden, agregarLinea } from '../venta/carrito.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { quitarDelCarrito } from '../portal/carrito-comandos.ts';
import { TELEFONO_A, mesaConPortal } from '../portal/pruebas/mesa-con-portal.ts';

/**
 * DP-14.6-3 · LAS OPCIONES OBLIGATORIAS LAS EXIGE EL SERVIDOR, en los tres caminos, contra Postgres.
 *
 * El taco trae el grupo obligatorio «Salsa» (verde o roja) y el agua no trae ninguno. Cada camino
 * (mesero, portal, /pos) rechaza el taco sin su elección con `OPCION_OBLIGATORIA` y, con ella, lo
 * escribe ESTRUCTURADO: `orden_linea_modificadores` y la instantánea `orden_lineas.opciones`.
 */

type Caso = Awaited<ReturnType<typeof mesaConPortal>>;
let caso: Caso;
let grupoId = '';
let verde = '';
let ventaId = '';
let roja = '';

const codigo = (r: { ok: boolean; error?: { datos?: Readonly<Record<string, unknown>> } }) =>
  r.ok ? null : r.error?.datos?.['regla'];

beforeAll(async () => {
  caso = await mesaConPortal();
  const db = obtenerDb();
  const org = caso.negocio.organizacionId;
  await db
    .insertInto('estaciones_preparacion')
    .values({ organizacion_id: org, nombre: 'Cocina general', es_general: true })
    .execute();
  const grupo = await db
    .insertInto('modificadores')
    .values({ organizacion_id: org, nombre: 'Salsa', obligatorio: true, tipo: 'unica' })
    .returning('id')
    .executeTakeFirstOrThrow();
  grupoId = grupo.id;
  const opciones = await db
    .insertInto('modificador_opciones')
    .values([
      { modificador_id: grupoId, nombre: 'Verde', orden: 1 },
      { modificador_id: grupoId, nombre: 'Roja', orden: 2 },
    ])
    .returning(['id', 'nombre'])
    .execute();
  verde = opciones.find((o) => o.nombre === 'Verde')?.id ?? '';
  roja = opciones.find((o) => o.nombre === 'Roja')?.id ?? '';
  await db
    .insertInto('producto_modificadores')
    .values({ organizacion_id: org, producto_id: caso.taco, modificador_id: grupoId })
    .execute();
  ventaId = (await caso.abrir(2)).ventaId;
});

async function elegidasDe(ordenId: string) {
  return obtenerDb()
    .selectFrom('orden_lineas as l')
    .leftJoin('orden_linea_modificadores as m', 'm.orden_linea_id', 'l.id')
    .select(['l.producto_nombre', 'l.opciones', 'm.modificador_nombre', 'm.opcion_nombre'])
    .where('l.orden_id', '=', ordenId)
    .execute();
}

describe('el mesero (restaurante.enviar_pedido)', () => {
  it('rechaza el taco sin su salsa y no escribe NADA, ni el agua que iba con él', async () => {
    const r = await comando(enviarPedido, {
      entrada: {
        ordenId: ventaId,
        lineas: [
          { productoId: caso.agua, cantidad: '1' },
          { productoId: caso.taco, cantidad: '1', notas: 'sin cebolla' },
        ],
      },
      ambito: caso.ambito,
      idempotencyKey: clave(),
    });
    expect(codigo(r)).toBe('OPCION_OBLIGATORIA');
    expect(await elegidasDe(ventaId)).toHaveLength(0);
  });

  it('con la elección estructurada la escribe estructurada', async () => {
    const orden = await ordenAbierta();
    exigirOk(
      await comando(enviarPedido, {
        entrada: {
          ordenId: orden,
          lineas: [
            {
              productoId: caso.taco,
              cantidad: '1',
              opciones: [{ grupoId, opcionIds: [roja] }],
            },
          ],
        },
        ambito: caso.ambito,
        idempotencyKey: clave(),
      }),
      'enviar con opción',
    );
    const filas = await elegidasDe(orden);
    expect(filas.map((f) => [f.modificador_nombre, f.opcion_nombre])).toContainEqual([
      'Salsa',
      'Roja',
    ]);
    expect(JSON.stringify(filas.find((f) => f.opcion_nombre === 'Roja')?.opciones)).toContain(
      'Roja',
    );
  });

  it('rechaza una opción que no es del platillo', async () => {
    const orden = await ordenAbierta();
    const r = await comando(enviarPedido, {
      entrada: {
        ordenId: orden,
        lineas: [
          {
            productoId: caso.taco,
            cantidad: '1',
            opciones: [{ grupoId, opcionIds: [crypto.randomUUID()] }],
          },
        ],
      },
      ambito: caso.ambito,
      idempotencyKey: clave(),
    });
    expect(codigo(r)).toBe('OPCION_NO_VALIDA');
  });

  it('el cliente que sólo manda texto sigue valiendo si la nota trae la salsa', async () => {
    const orden = await ordenAbierta();
    exigirOk(
      await comando(enviarPedido, {
        entrada: {
          ordenId: orden,
          lineas: [{ productoId: caso.taco, cantidad: '1', notas: 'Salsa: Verde · poca' }],
        },
        ambito: caso.ambito,
        idempotencyKey: clave(),
      }),
      'enviar con nota',
    );
    const filas = await elegidasDe(orden);
    expect(filas.some((f) => f.opcion_nombre === 'Verde')).toBe(true);
    expect(verde).not.toBe('');
  });
});

async function ordenAbierta(): Promise<string> {
  const fila = await obtenerDb()
    .selectFrom('ordenes')
    .select('id')
    .where('mesa_id', '=', caso.mesaId)
    .where('estado', 'in', ['borrador', 'confirmada'])
    .executeTakeFirstOrThrow();
  return fila.id;
}

describe('el portal (envío del carrito)', () => {
  it('no manda el taco sin su salsa y sí con ella en la nota', async () => {
    const portal = await mesaConPortal();
    const db = obtenerDb();
    const org = portal.negocio.organizacionId;
    const g = await db
      .insertInto('modificadores')
      .values({ organizacion_id: org, nombre: 'Salsa', obligatorio: true, tipo: 'unica' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('modificador_opciones')
      .values([{ modificador_id: g.id, nombre: 'Verde' }])
      .execute();
    await db
      .insertInto('producto_modificadores')
      .values({ organizacion_id: org, producto_id: portal.taco, modificador_id: g.id })
      .execute();

    await portal.abrir(2);
    const sinSalsa = exigirOk(
      await portal.agregar(TELEFONO_A, portal.taco, '1', 'sin cebolla'),
      'agregar',
    );
    const sin = await portal.enviar(TELEFONO_A, true);
    expect(codigo(sin)).toBe('OPCION_OBLIGATORIA');
    const quedan = await db
      .selectFrom('carrito_mesa_lineas')
      .select('id')
      .where('mesa_id', '=', portal.mesaId)
      .execute();
    expect(quedan, 'el carrito sigue intacto').toHaveLength(1);

    // Se quita la línea sin salsa y se pide otra CON ella (como la pliega el portal en la nota).
    exigirOk(
      await portal.publico(quitarDelCarrito, {
        dispositivo: TELEFONO_A,
        lineaId: sinSalsa.lineas[0]?.id ?? '',
      }),
      'quitar',
    );
    exigirOk(
      await portal.agregar(TELEFONO_A, portal.taco, '1', 'Salsa: Verde · sin cebolla'),
      'agregar con salsa',
    );
    exigirOk(await portal.enviar(TELEFONO_A, true), 'enviar con salsa');
    const filas = await db
      .selectFrom('orden_linea_modificadores as m')
      .innerJoin('orden_lineas as l', 'l.id', 'm.orden_linea_id')
      .innerJoin('ordenes as o', 'o.id', 'l.orden_id')
      .select(['m.modificador_nombre', 'm.opcion_nombre'])
      .where('o.mesa_id', '=', portal.mesaId)
      .execute();
    expect(filas).toEqual([{ modificador_nombre: 'Salsa', opcion_nombre: 'Verde' }]);
  });
});

describe('/pos (venta.agregar_linea)', () => {
  it('rechaza el taco sin salsa y con ella guarda la elección y la deja en notas', async () => {
    const { ordenId } = exigirOk(
      await comando(crearOrden, { entrada: {}, ambito: caso.ambito, idempotencyKey: clave() }),
      'crear',
    );
    const sin = await comando(agregarLinea, {
      entrada: { ordenId, productoId: caso.taco, cantidad: '1' },
      ambito: caso.ambito,
      idempotencyKey: clave(),
    });
    expect(codigo(sin)).toBe('OPCION_OBLIGATORIA');

    const { lineaId } = exigirOk(
      await comando(agregarLinea, {
        entrada: {
          ordenId,
          productoId: caso.taco,
          cantidad: '1',
          opciones: [{ grupoId, opcionIds: [verde] }],
        },
        ambito: caso.ambito,
        idempotencyKey: clave(),
      }),
      'agregar con salsa',
    );
    const fila = await obtenerDb()
      .selectFrom('orden_lineas')
      .select(['notas', 'opciones'])
      .where('id', '=', lineaId)
      .executeTakeFirstOrThrow();
    expect(fila.notas).toBe('Salsa: Verde');
    expect(JSON.stringify(fila.opciones)).toContain('Verde');

    const agua = exigirOk(
      await comando(agregarLinea, {
        entrada: { ordenId, productoId: caso.agua, cantidad: '1' },
        ambito: caso.ambito,
        idempotencyKey: clave(),
      }),
      'agua sin opciones',
    );
    expect(agua.lineaId).not.toBe('');
  });
});
