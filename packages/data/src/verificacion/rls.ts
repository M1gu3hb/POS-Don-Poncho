import { readFileSync } from 'node:fs';

const MIGRACIONES_INDICES_CRITICOS = [
  new URL('../migraciones/sql/046_restricciones_restaurante.sql', import.meta.url),
  new URL('../migraciones/sql/052_qr_token_unico.sql', import.meta.url),
] as const;

export function extraerIndicesUnicos(sql: string): string[] {
  return [...sql.matchAll(/create\s+unique\s+index\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi)]
    .map((coincidencia) => coincidencia[1])
    .filter((nombre): nombre is string => nombre !== undefined);
}

/**
 * Los índices críticos que una migración posterior SUSTITUYÓ por otra cosa, con el
 * disparador que ahora hace cumplir la misma regla. Dejan de exigirse como índice SÓLO
 * si su sustituto está en la base: quitar el índice sin poner el disparador sería
 * perder la regla, y esta puerta lo tiene que ver.
 */
export const SUSTITUIDOS: Readonly<Record<string, string>> = {
  // 179 · F-235: el cupo de cajas es de la sucursal; un índice único no sabe contar hasta dos.
  sesiones_caja_una_abierta_por_sucursal: 'sesiones_caja_cupo_de_la_sucursal',
};

export const INDICES_UNICOS_046 = [
  ...MIGRACIONES_INDICES_CRITICOS.flatMap((ruta) =>
    extraerIndicesUnicos(readFileSync(ruta, 'utf8')),
  ),
] as const;

export interface RelacionSeguridad {
  readonly clave: string;
  readonly tipo: 'tabla' | 'tabla_particionada' | 'vista' | 'vista_materializada';
  readonly rlsActiva: boolean | null;
  readonly rlsForzada: boolean | null;
  readonly selectAnon: boolean;
  readonly selectAuthenticated: boolean;
}

export interface IndiceSeguridad {
  readonly nombre: string;
  readonly unico: boolean;
  readonly valido: boolean;
}

export interface FuncionSeguridad {
  readonly clave: string;
  readonly executeAnon: boolean;
  readonly executeAuthenticated: boolean;
}

export interface EstadoSeguridad {
  readonly relaciones: readonly RelacionSeguridad[];
  readonly indices: readonly IndiceSeguridad[];
  readonly funciones: readonly FuncionSeguridad[];
  /** Los disparadores del esquema, por nombre. Opcional: un estado viejo no los traía. */
  readonly disparadores?: readonly string[];
}

/**
 * LO QUE `problemasDeSeguridad` LEE, en una sola consulta para las dos puertas que lo
 * preguntan (`verify:rls` y `verify:acople`). Eran dos copias y la del acople se quedó
 * sin los disparadores: nunca veía el sustituto de la 179 y daba por perdida una regla que
 * la base sí cumple (DP-7). Sólo lee el catálogo.
 */
export const CONSULTA_SEGURIDAD = String.raw`
with relaciones as (
  select
    format('%I.%I', n.nspname, c.relname) as clave,
    case c.relkind
      when 'r' then 'tabla'
      when 'p' then 'tabla_particionada'
      when 'v' then 'vista'
      when 'm' then 'vista_materializada'
    end as tipo,
    case when c.relkind in ('r', 'p') then c.relrowsecurity else null end as "rlsActiva",
    case when c.relkind in ('r', 'p') then c.relforcerowsecurity else null end as "rlsForzada",
    has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'SELECT') as "selectAnon",
    has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'SELECT')
      as "selectAuthenticated"
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
), indices as (
  select
    i.relname as nombre,
    x.indisunique as unico,
    x.indisvalid as valido
  from pg_catalog.pg_index x
  join pg_catalog.pg_class i on i.oid = x.indexrelid
  join pg_catalog.pg_class t on t.oid = x.indrelid
  join pg_catalog.pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
), funciones as (
  select
    format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) as clave,
    has_function_privilege('anon', p.oid, 'EXECUTE') as "executeAnon",
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as "executeAuthenticated"
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
), disparadores as (
  select tg.tgname as nombre
  from pg_catalog.pg_trigger tg
  join pg_catalog.pg_class c on c.oid = tg.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not tg.tgisinternal
)
select json_build_object(
  'relaciones', coalesce(
    (select json_agg(row_to_json(r) order by r.clave) from relaciones r),
    '[]'::json
  ),
  'indices', coalesce(
    (select json_agg(row_to_json(i) order by i.nombre) from indices i),
    '[]'::json
  ),
  'funciones', coalesce(
    (select json_agg(row_to_json(f) order by f.clave) from funciones f),
    '[]'::json
  ),
  'disparadores', coalesce(
    (select json_agg(d.nombre order by d.nombre) from disparadores d),
    '[]'::json
  )
) as estado;
`;

/** Convierte el estado vivo de PostgreSQL en fallos concretos para CI. */
export function problemasDeSeguridad(estado: EstadoSeguridad): string[] {
  const problemas: string[] = [];

  for (const relacion of estado.relaciones) {
    if (relacion.tipo === 'tabla' || relacion.tipo === 'tabla_particionada') {
      if (relacion.rlsActiva !== true) problemas.push(`${relacion.clave}: RLS no está activa`);
      if (relacion.rlsForzada !== true) problemas.push(`${relacion.clave}: RLS no está forzada`);
    }
    if (relacion.selectAnon) problemas.push(`${relacion.clave}: anon conserva SELECT`);
    if (relacion.selectAuthenticated) {
      problemas.push(`${relacion.clave}: authenticated conserva SELECT`);
    }
  }

  for (const funcion of estado.funciones) {
    if (funcion.executeAnon) problemas.push(`${funcion.clave}: anon conserva EXECUTE`);
    if (funcion.executeAuthenticated) {
      problemas.push(`${funcion.clave}: authenticated conserva EXECUTE`);
    }
  }

  const indices = new Map(estado.indices.map((indice) => [indice.nombre, indice]));
  const disparadores = new Set(estado.disparadores ?? []);
  for (const nombre of INDICES_UNICOS_046) {
    const indice = indices.get(nombre);
    const sustituto = SUSTITUIDOS[nombre];
    if (indice === undefined && sustituto !== undefined) {
      if (!disparadores.has(sustituto)) {
        problemas.push(`${nombre}: ni el índice 046 ni su sustituto (${sustituto}) están`);
      }
      continue;
    }
    if (indice === undefined) {
      problemas.push(`${nombre}: índice 046 ausente`);
      continue;
    }
    if (!indice.unico) problemas.push(`${nombre}: el índice no es único`);
    if (!indice.valido) problemas.push(`${nombre}: el índice no es válido`);
  }

  return problemas;
}
