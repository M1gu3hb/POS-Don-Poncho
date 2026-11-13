/**
 * EL RELOJ DE QA EN LA COPIA DE LA BASE (nunca una migración: sólo en una base local `qa_…`).
 *
 *   node qa/simulador/reloj/en-la-base.ts <postgres://…localhost…/qa_…>
 *
 * Postgres no sabe de la hora simulada: los `default now()` (200 columnas), el disparador
 * `tocar_updated_at` y el `now()` de las consultas de la app usarían la real. En la copia:
 *   1. el esquema `qa_reloj` con sus parámetros (los mismos del archivo del servidor) y la función
 *      `qa_reloj.now()`, que cuenta la hora simulada desde el `now()` real de la transacción;
 *   2. cada `default` con `now()`, `CURRENT_TIMESTAMP` o `CURRENT_DATE` apunta a `qa_reloj.now()`;
 *   3. cada función de `public` que lee la hora la lee de `qa_reloj.now()`;
 *   4. la base busca primero en `qa_reloj`: el `now()` sin esquema de la app es el simulado.
 * Pasa antes por el candado. Es idempotente: correrlo dos veces deja lo mismo.
 */
import { createRequire } from 'node:module';

import { exigirCopiaLocal } from '../candado.ts';

const HORA =
  /(?<!qa_reloj\.)\bnow\(\)|\bCURRENT_TIMESTAMP\b|\bclock_timestamp\(\)|\bstatement_timestamp\(\)|\btransaction_timestamp\(\)/gi;
const FECHA = /\bCURRENT_DATE\b/gi;

export function conElRelojDeQa(expresion: string): string {
  return expresion.replace(HORA, 'qa_reloj.now()').replace(FECHA, '(qa_reloj.now())::date');
}

interface Cliente {
  // El tipo de las filas lo pide quien consulta, como en el `Client` de `pg`.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  query<T = Record<string, unknown>>(texto: string, valores?: unknown[]): Promise<{ rows: T[] }>;
}

export async function instalarElReloj(
  cliente: Cliente,
  base: string,
): Promise<{ defaults: number; funciones: number }> {
  await cliente.query('begin');
  try {
    await cliente.query('create schema if not exists qa_reloj');
    await cliente.query(`create table if not exists qa_reloj.reloj_parametros (
      id int primary key default 1 check (id = 1),
      base_real timestamptz not null,
      base_sim timestamptz not null,
      factor numeric not null check (factor > 0))`);
    await cliente.query(`create or replace function qa_reloj.now() returns timestamptz
      language sql stable as $$
        select coalesce(
          (select p.base_sim + (pg_catalog.now() - p.base_real) * p.factor
             from qa_reloj.reloj_parametros p where p.id = 1),
          pg_catalog.now())
      $$`);
    const defaults = await cliente.query<{ tabla: string; columna: string; expr: string }>(`
      select format('%I.%I', n.nspname, c.relname) tabla, quote_ident(a.attname) columna,
             pg_get_expr(d.adbin, d.adrelid) expr
        from pg_attrdef d
        join pg_class c on c.oid = d.adrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
       where n.nspname = 'public'`);
    let cambiados = 0;
    for (const d of defaults.rows) {
      const nueva = conElRelojDeQa(d.expr);
      if (nueva === d.expr) continue;
      await cliente.query(`alter table ${d.tabla} alter column ${d.columna} set default ${nueva}`);
      cambiados += 1;
    }
    const funciones = await cliente.query<{ definicion: string }>(`
      select pg_get_functiondef(p.oid) definicion
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f'`);
    let reescritas = 0;
    for (const f of funciones.rows) {
      const nueva = conElRelojDeQa(f.definicion);
      if (nueva === f.definicion) continue;
      await cliente.query(nueva);
      reescritas += 1;
    }
    await cliente.query(
      `alter database ${JSON.stringify(base)} set search_path = qa_reloj, "$user", public, pg_catalog`,
    );
    await cliente.query('commit');
    return { defaults: cambiados, funciones: reescritas };
  } catch (error: unknown) {
    await cliente.query('rollback');
    throw error;
  }
}

if (import.meta.main) {
  const cadena = process.argv[2] ?? '';
  exigirCopiaLocal({ databaseUrl: cadena, entorno: process.env });
  const raiz = new URL('../../../', import.meta.url);
  const pg = createRequire(new URL('packages/data/package.json', raiz))('pg') as {
    Client: new (o: {
      connectionString: string;
    }) => Cliente & { connect(): Promise<void>; end(): Promise<void> };
  };
  const cliente = new pg.Client({ connectionString: cadena });
  await cliente.connect();
  try {
    const base = decodeURIComponent(new URL(cadena).pathname.slice(1));
    const r = await instalarElReloj(cliente, base);
    console.log(
      `✓ Reloj de QA en ${base}: ${String(r.defaults)} defaults y ${String(r.funciones)} funciones.`,
    );
  } finally {
    await cliente.end();
  }
}
