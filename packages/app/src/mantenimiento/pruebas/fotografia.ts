import { obtenerDb } from '@morphiqpos/data';
import { sql, type RawBuilder } from 'kysely';

/**
 * LA FOTOGRAFÍA DE UN NEGOCIO: cuántas filas tiene en CADA tabla del esquema que lleva
 * `organizacion_id`, más las dos hijas sin organización propia que un día escribe.
 *
 * Sirve para dos afirmaciones que una prueba de purga necesita y que una lista escrita a mano
 * deja pasar: que lo que se purgó quedó en cero, y que OTRO negocio quedó exactamente igual,
 * incluso en las tablas en las que nadie pensó. La lista de tablas sale del catálogo de
 * Postgres, no de este archivo: una tabla nueva entra sola.
 */

export type Fotografia = Readonly<Record<string, number>>;

/** Las hijas que cuelgan de un padre y no llevan `organizacion_id` (se cuentan por él). */
const POR_PADRE: Readonly<Record<string, (org: string) => RawBuilder<unknown>>> = {
  union_mesa_miembros: (org) =>
    sql`union_id in (select id from uniones_mesa where organizacion_id = ${org})`,
  orden_linea_modificadores: (org) =>
    sql`orden_linea_id in (select id from orden_lineas where organizacion_id = ${org})`,
};

async function tablasConOrganizacion(): Promise<readonly string[]> {
  const { rows } = await sql<{ table_name: string }>`
    select c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name = 'organizacion_id'
       and t.table_type = 'BASE TABLE'
     order by c.table_name
  `.execute(obtenerDb());
  return rows.map((r) => r.table_name);
}

async function contar(tabla: string, donde: RawBuilder<unknown>): Promise<number> {
  const { rows } = await sql<{ n: string }>`
    select count(*)::text as n from ${sql.table(tabla)} where ${donde}
  `.execute(obtenerDb());
  return Number(rows[0]?.n ?? '0');
}

export async function fotografiaDe(organizacionId: string): Promise<Fotografia> {
  const foto: Record<string, number> = {};
  for (const tabla of await tablasConOrganizacion()) {
    foto[tabla] = await contar(tabla, sql`organizacion_id = ${organizacionId}`);
  }
  for (const [tabla, donde] of Object.entries(POR_PADRE)) {
    foto[tabla] = await contar(tabla, donde(organizacionId));
  }
  return foto;
}

/**
 * La HUELLA de un negocio: por tabla, cuántas filas y el md5 de su contenido (cada fila como
 * texto, ordenadas). Los conteos no ven un `update` sin `where` que le cambie la mesa a otro
 * negocio; el contenido sí, hasta en `updated_at`.
 */
export type Huella = Readonly<Record<string, string>>;

async function huellaDeTabla(tabla: string, donde: RawBuilder<unknown>): Promise<string> {
  const { rows } = await sql<{ h: string }>`
    select count(*)::text || ':' || md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as h
      from ${sql.table(tabla)} as t where ${donde}
  `.execute(obtenerDb());
  return rows[0]?.h ?? '0:';
}

export async function huellaDe(organizacionId: string): Promise<Huella> {
  const huella: Record<string, string> = {};
  for (const tabla of await tablasConOrganizacion()) {
    huella[tabla] = await huellaDeTabla(tabla, sql`t.organizacion_id = ${organizacionId}`);
  }
  for (const [tabla, donde] of Object.entries(POR_PADRE)) {
    huella[tabla] = await huellaDeTabla(tabla, donde(organizacionId));
  }
  return huella;
}

/** Las tablas en las que la fotografía tiene algo. */
export function conAlgo(foto: Fotografia): string[] {
  return Object.entries(foto)
    .filter(([, n]) => n > 0)
    .map(([tabla]) => tabla)
    .sort();
}
