import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';

import { cerrarDb, obtenerDb } from '../cliente.ts';

/**
 * DP-15.1 · NINGUNA FUNCIÓN DE `public` CON EL `search_path` MUDABLE (migración 190).
 *
 * Es la regla 0011 del linter de Supabase (`function_search_path_mutable`): una función sin
 * `search_path` fijo resuelve los nombres con el de quien la llama, y otro esquema puede ponerle
 * delante un objeto con el mismo nombre. En la base propia de Don Poncho el linter marcó una sola,
 * `lealtad_movimientos_inmutables`; la 190 se lo fija. Las funciones de las extensiones quedan
 * fuera, como en el linter: no son nuestras.
 */

afterAll(async () => {
  await cerrarDb();
});

describe('las funciones de public', () => {
  it('todas llevan search_path fijo', async () => {
    const filas = await sql<{ funcion: string }>`
      select p.oid::regprocedure::text as funcion
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.prokind in ('f', 'p')
         and not exists (
           select 1 from pg_depend d
            where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
         )
         and not exists (
           select 1 from unnest(coalesce(p.proconfig, '{}')) as c(ajuste)
            where c.ajuste like 'search_path=%'
         )
       order by 1
    `.execute(obtenerDb());
    expect(filas.rows.map((f) => f.funcion)).toEqual([]);
  });

  it('lealtad_movimientos sigue siendo inmutable después de fijarlo', async () => {
    const disparador = await sql<{ n: number }>`
      select count(*)::int as n from pg_trigger
       where tgname = 'lealtad_movimientos_sin_update'
         and tgfoid = 'public.lealtad_movimientos_inmutables()'::regprocedure
    `.execute(obtenerDb());
    expect(disparador.rows[0]?.n).toBe(1);
  });
});
