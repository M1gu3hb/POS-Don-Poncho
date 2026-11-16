import 'server-only';

import type { Esquema, Transaccion } from '@morphiqpos/data';
import type { Kysely } from 'kysely';

import { foliosEn, operacionDesdeEn, type FoliosDelNegocio } from './folios-del-negocio.ts';

/**
 * Lo que el documento de configuración dice de los folios, leído de la base (DP-21 · Bloque 6).
 *
 * Es el ÚNICO archivo que lee la tabla `configuracion` para esto: quien necesite el prefijo, los
 * primeros folios o `operacion_desde` (el corte, las exportaciones, los comandos de mantenimiento)
 * pasa por aquí y no abre otra lectura del documento. Nunca devuelve el documento entero.
 */

type Conexion = Kysely<Esquema> | Transaccion;

async function valoresDe(db: Conexion, organizacionId: string): Promise<unknown> {
  const fila = await db
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  return fila?.valores;
}

export async function leerFoliosDelNegocio(
  db: Conexion,
  organizacionId: string,
): Promise<FoliosDelNegocio> {
  return foliosEn(await valoresDe(db, organizacionId));
}

/** Desde cuándo opera de verdad el negocio (H1), o `null`. Una fecha dañada falla cerrada. */
export async function leerOperacionDesde(
  db: Conexion,
  organizacionId: string,
): Promise<Date | null> {
  return operacionDesdeEn(await valoresDe(db, organizacionId));
}
