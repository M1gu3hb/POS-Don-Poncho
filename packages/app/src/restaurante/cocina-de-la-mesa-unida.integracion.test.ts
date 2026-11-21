import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { moverPlatillos } from './mover-platillos.ts';
import { entregarPedidos, transicionarPedido } from './preparacion.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  mesaPersistida,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from './pruebas/salon-real.ts';
import { unirMesasComando } from './union-de-mesas.ts';

/**
 * DP-25 · Parte 4 · LA COCINA DE UNA MESA UNIDA MUEVE LA MESA QUE SE VE (Postgres real).
 *
 * Al unir mesas, las comandas de la cuenta absorbida pasan a la cuenta de la principal pero
 * conservan `comandas.mesa_id` (la mesa de la que salieron). La cocina movía «la mesa de la
 * comanda»: con lo que terminaba de la mesa absorbida cambiaba una mesa que el mapa no enseña, y
 * la principal se quedaba en «pedido enviado» o «en preparación» aunque todo estuviera listo. La
 * mesa que cambia es la de la CUENTA (`ordenes.mesa_id`), que en una unión es la principal.
 */

let salon: Salon;
let indice = 0;

const cocina = () => ({ ...ambitoDeCaja(salon), rol: 'cocina' as const });
const mesero = () => ({ ...ambitoDeCaja(salon), rol: 'mesero' as const });

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Cocina de la mesa unida', mesas: 24 });
  await abrirLasCajas(salon);
  const db = obtenerDb();
  const org = salon.negocio.organizacionId;
  const cantina = await db
    .insertInto('estaciones_preparacion')
    .values({ organizacion_id: org, nombre: 'Cantina', color: '#0891b2' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const categoria = await db
    .insertInto('categorias')
    .values({ organizacion_id: org, nombre: 'Bebidas', estacion_preparacion_id: cantina.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await db
    .updateTable('productos')
    .set({ categoria_id: categoria.id })
    .where('id', '=', salon.platillos.cerveza)
    .execute();
  await sql`
    insert into configuracion (organizacion_id, valores)
    values (${org}, ${JSON.stringify({ estaciones_preparacion_activas: true })}::jsonb)
    on conflict (organizacion_id) do update set valores = configuracion.valores || excluded.valores
  `.execute(db);
  await sembrarCompanero(salon.negocio, { nombre: 'Ana', rol: 'mesero' });
}, 120_000);

/** Dos mesas con cuenta y pedido en estaciones distintas, ya unidas: la primera es la principal. */
async function dosMesasUnidas() {
  const posicion = indice;
  indice += 2;
  const principal = await sentarYPedir(salon, posicion, [{ platillo: 'guacamole', cantidad: '1' }]);
  const otra = await sentarYPedir(salon, posicion + 1, [
    { platillo: 'cerveza', cantidad: '1' },
    { platillo: 'arrachera', cantidad: '1' },
  ]);
  exigirOk(
    await comando(unirMesasComando, {
      entrada: { mesaPrincipalId: principal.mesaId, mesaIds: [otra.mesaId] },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'unir',
  );
  return { principal, otra };
}

async function platillosDe(ordenId: string) {
  return obtenerDb()
    .selectFrom('comanda_items as i')
    .innerJoin('comandas as c', 'c.id', 'i.comanda_id')
    .select(['i.id', 'i.producto_nombre as nombre', 'i.estado', 'c.id as comandaId'])
    .where('c.orden_id', '=', ordenId)
    .orderBy('i.orden_visual')
    .execute();
}

const marcar = (comandaId: string, comandaItemId: string, estado: 'en_preparacion' | 'listo') =>
  comando(transicionarPedido, {
    entrada: { comandaId, comandaItemId, estado },
    ambito: cocina(),
    idempotencyKey: clave(),
  });

describe('P4 · la cocina de una mesa unida', () => {
  it('a · todo lo que se pidió en la mesa absorbida sale listo: la PRINCIPAL pasa a «esperando entrega»', async () => {
    const { principal, otra } = await dosMesasUnidas();
    for (const p of await platillosDe(principal.ordenId)) {
      exigirOk(await marcar(p.comandaId, p.id, 'listo'), 'marcar listo');
    }
    expect((await mesaPersistida(principal.mesaId)).estado).toBe('en_espera_entrega');
    // La absorbida no es la que cuenta: nada de la cocina la decide.
    expect((await mesaPersistida(otra.mesaId)).estado).not.toBe('en_espera_entrega');
  });

  it('b · la estación de la mesa absorbida arranca: la principal pasa a «en preparación»', async () => {
    const { principal } = await dosMesasUnidas();
    const todos = await platillosDe(principal.ordenId);
    const deLaOtra = todos.filter((p) => !p.nombre.startsWith('Guacamole'));
    for (const p of deLaOtra) {
      exigirOk(await marcar(p.comandaId, p.id, 'en_preparacion'), 'marcar en preparación');
    }
    // La cantina y la cocina de la absorbida van en el fuego; el guacamole de la principal no.
    expect((await mesaPersistida(principal.mesaId)).estado).toBe('en_preparacion');
  });

  it('c · el bloque completo (mover_platillos) también mueve la principal', async () => {
    const { principal } = await dosMesasUnidas();
    const ids = (await platillosDe(principal.ordenId)).map((p) => p.id);
    exigirOk(
      await comando(moverPlatillos, {
        entrada: { platilloIds: ids, desde: 'nuevo', estado: 'listo' },
        ambito: cocina(),
        idempotencyKey: clave(),
      }),
      'mover_platillos',
    );
    expect((await mesaPersistida(principal.mesaId)).estado).toBe('en_espera_entrega');
  });

  it('d · entregado todo, la principal queda ocupada y sin nada en cocina', async () => {
    const { principal } = await dosMesasUnidas();
    for (const p of await platillosDe(principal.ordenId)) {
      exigirOk(await marcar(p.comandaId, p.id, 'listo'), 'marcar listo');
    }
    exigirOk(
      await comando(entregarPedidos, {
        entrada: { ordenId: principal.ordenId },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'entregar',
    );
    expect((await mesaPersistida(principal.mesaId)).estado).toBe('ocupada');
  });
});
