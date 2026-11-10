import { ErrorDominio } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { enviarPedido } from '../restaurante/pedido.ts';
import { transicionarPedido } from '../restaurante/preparacion.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { mesaConPortal } from '../portal/pruebas/mesa-con-portal.ts';
import { consultar } from './consultar.ts';

/**
 * DP-16 · 2.2 · LO QUE LEE LA PANTALLA GRANDE DE COCINA, contra Postgres.
 *
 *   · sólo las comandas VIVAS (`estado: [...]`): lo entregado no se baja;
 *   · cada item trae sus opciones elegidas APARTE de la nota, reducidas a grupo y nombres (ni ids
 *     ni precios), y la comanda trae desde cuándo espera (`fecha_marchada`);
 *   · el filtro de lista rechaza lo que no es una lista de textos o números.
 */

type Caso = Awaited<ReturnType<typeof mesaConPortal>>;
let caso: Caso;
let cuenta = '';
let comandasEntregadas: readonly string[] = [];

const ambitoDeCocina = () => ({ ...caso.ambito, rol: 'cocina' });

async function comandasDe(ordenId: string): Promise<readonly string[]> {
  const filas = await obtenerDb()
    .selectFrom('comandas')
    .select('id')
    .where('orden_id', '=', ordenId)
    .execute();
  return filas.map((f) => f.id);
}

/** La mesa es una sola: abrirla otra vez devuelve la misma cuenta. Devuelve las comandas que nacieron. */
async function pedir(lineas: readonly Record<string, unknown>[]): Promise<readonly string[]> {
  const { ventaId } = await caso.abrir(2);
  cuenta = ventaId;
  const antes = await comandasDe(ventaId);
  exigirOk(
    await comando(enviarPedido, {
      entrada: { ordenId: ventaId, lineas },
      ambito: caso.ambito,
      idempotencyKey: clave(),
    }),
    'enviar_pedido',
  );
  return (await comandasDe(ventaId)).filter((id) => !antes.includes(id));
}

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
  const opciones = await db
    .insertInto('modificador_opciones')
    .values([
      { modificador_id: grupo.id, nombre: 'Verde', orden: 1 },
      { modificador_id: grupo.id, nombre: 'Roja', orden: 2 },
    ])
    .returning(['id', 'nombre'])
    .execute();
  await db
    .insertInto('producto_modificadores')
    .values({ organizacion_id: org, producto_id: caso.taco, modificador_id: grupo.id })
    .execute();
  const rojaId = opciones.find((o) => o.nombre === 'Roja')?.id ?? '';

  await pedir([
    {
      productoId: caso.taco,
      cantidad: '2',
      notas: 'Salsa: Roja · sin cebolla',
      opciones: [{ grupoId: grupo.id, opcionIds: [rojaId] }],
    },
    { productoId: caso.agua, cantidad: '1', notas: 'sin hielo' },
  ]);

  // Un segundo pedido de la misma cuenta, cuyas comandas se entregan: no debe bajar al tablero.
  comandasEntregadas = await pedir([{ productoId: caso.agua, cantidad: '1' }]);
  for (const id of comandasEntregadas) {
    for (const estado of ['en_preparacion', 'listo', 'entregado']) {
      exigirOk(
        await comando(transicionarPedido, {
          entrada: { comandaId: id, estado },
          ambito: caso.ambito,
          idempotencyKey: clave(),
        }),
        `transicionar a ${estado}`,
      );
    }
  }
});

const VIVAS = ['nuevo', 'en_preparacion', 'listo'];

describe('la lectura de la cocina', () => {
  it('sólo trae las comandas vivas: la entregada se queda fuera', async () => {
    const filas = await consultar(ambitoDeCocina(), {
      entidad: 'PedidoPreparacion',
      operacion: 'filter',
      filtro: { estado: VIVAS },
    });
    const ids = new Set(filas.map((f) => f['id']));
    expect(comandasEntregadas.length).toBeGreaterThan(0);
    expect(filas.some((f) => f['venta_id'] === cuenta)).toBe(true);
    for (const entregada of comandasEntregadas) expect(ids.has(entregada)).toBe(false);
    expect(filas.every((f) => VIVAS.includes(String(f['estado'])))).toBe(true);
  });

  it('cada item trae sus opciones aparte de la nota, sin ids ni precios', async () => {
    const filas = await consultar(ambitoDeCocina(), {
      entidad: 'PedidoPreparacion',
      operacion: 'filter',
      filtro: { venta_id: cuenta, estado: VIVAS },
    });
    const items = filas.flatMap((f) => f['items'] as Record<string, unknown>[]);
    const taco = items.find((i) => i['producto_id'] === caso.taco);
    const agua = items.find((i) => i['producto_id'] === caso.agua);
    expect(taco?.['opciones']).toEqual([{ grupo: 'Salsa', opciones: ['Roja'] }]);
    expect(taco?.['notas']).toBe('Salsa: Roja · sin cebolla');
    expect(JSON.stringify(taco?.['opciones'])).not.toMatch(/precio|centavos|[0-9a-f]{8}-/);
    expect(agua?.['opciones']).toBeNull();
    expect(agua?.['notas']).toBe('sin hielo');
  });

  it('la comanda dice desde cuándo espera', async () => {
    const [comanda] = await consultar(ambitoDeCocina(), {
      entidad: 'PedidoPreparacion',
      operacion: 'filter',
      filtro: { venta_id: cuenta, estado: VIVAS },
    });
    expect(Date.parse(String(comanda?.['fecha_marchada']))).not.toBeNaN();
  });
});

describe('el filtro de lista', () => {
  it('una lista vacía no trae nada', async () => {
    expect(
      await consultar(ambitoDeCocina(), {
        entidad: 'PedidoPreparacion',
        operacion: 'filter',
        filtro: { estado: [] },
      }),
    ).toEqual([]);
  });

  it.each([
    ['con objetos', [{ a: 1 }]],
    ['con nulos', ['nuevo', null]],
    ['con más de 200 valores', Array.from({ length: 201 }, (_, i) => `e${String(i)}`)],
  ])('una lista %s es una entrada mala, no un 500', async (_que, lista) => {
    const intento = consultar(ambitoDeCocina(), {
      entidad: 'PedidoPreparacion',
      operacion: 'filter',
      filtro: { estado: lista },
    });
    await expect(intento).rejects.toBeInstanceOf(ErrorDominio);
    await expect(intento).rejects.toMatchObject({ codigo: 'PUENTE_FILTRO_INVALIDO' });
  });

  it('un campo que no existe no se puede filtrar con una lista', async () => {
    await expect(
      consultar(ambitoDeCocina(), {
        entidad: 'PedidoPreparacion',
        operacion: 'filter',
        filtro: { no_existe: ['a'] },
      }),
    ).rejects.toMatchObject({ codigo: 'PUENTE_CAMPO_INVALIDO' });
  });
});
