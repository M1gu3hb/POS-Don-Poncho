import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { obtenerDb } from '../cliente.ts';

/**
 * DP-10.5 · LA 188 ARCHIVA LAS DEMOSTRACIONES DE LA 042 SÓLO EN UNA BASE NUEVA (contra Postgres).
 *
 * Se corre el SQL REAL de la migración sobre una `organizaciones` de juguete en un esquema
 * temporal (el `search_path` lo pone primero), dentro de una transacción que se deshace: así se
 * prueban sus dos caminos sin tocar la base de las pruebas. Que una base recién migrada quede con
 * las tres apagadas lo prueba el ensayo de la mudanza (reporte 003).
 */

const MIGRACION = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'sql', '188_demostraciones_archivadas.sql'),
  'utf8',
);
const DEMOS = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
];
const DON_PONCHO = '617ec3ad-cdc5-46d4-8d71-a1ed479c496b';
const OTRO = '22222222-2222-4222-8222-222222222222';

class Deshacer extends Error {}

/** Las organizaciones de juguete con `ids`, la migración, y cuáles quedaron activas. */
async function despuesDeLa188(ids: readonly string[]): Promise<readonly string[]> {
  let activas: readonly string[] = [];
  try {
    await obtenerDb()
      .transaction()
      .execute(async (tx) => {
        await sql`create schema prueba_188`.execute(tx);
        await sql`set local search_path = prueba_188, public`.execute(tx);
        await sql`
          create table prueba_188.organizaciones (
            id uuid primary key, activa boolean not null default true,
            updated_at timestamptz not null default now())`.execute(tx);
        for (const id of ids) {
          await sql`insert into prueba_188.organizaciones (id) values (${id}::uuid)`.execute(tx);
        }
        await sql.raw(MIGRACION).execute(tx);
        const { rows } = await sql<{ id: string }>`
          select id::text from prueba_188.organizaciones where activa order by id`.execute(tx);
        activas = rows.map((r) => r.id);
        throw new Deshacer();
      });
  } catch (error) {
    if (!(error instanceof Deshacer)) throw error;
  }
  return activas;
}

describe('migración 188 · demostraciones archivadas', () => {
  it('en una base nueva con Don Poncho, apaga las tres demostraciones y deja a Don Poncho', async () => {
    expect(await despuesDeLa188([...DEMOS, DON_PONCHO])).toEqual([DON_PONCHO]);
  });

  it('recién migrada, sin Don Poncho todavía, también las apaga', async () => {
    expect(await despuesDeLa188(DEMOS)).toEqual([]);
  });

  it('con cualquier otro negocio (la compartida), no toca a nadie', async () => {
    expect(await despuesDeLa188([...DEMOS, DON_PONCHO, OTRO])).toEqual(
      [...DEMOS, DON_PONCHO, OTRO].sort(),
    );
  });
});
