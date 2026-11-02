import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

/**
 * CUÁNDO LE TOCA LIMPIAR SUS SOLICITUDES A UN NEGOCIO (DP-12.6).
 *
 * La pantalla del mesero pedía la limpieza en CADA visita a Mesas, y cada visita escribía una
 * línea de auditoría aunque no hubiera nada que borrar. Ahora el SERVIDOR decide: la limpieza
 * automática corre a lo mucho una vez por hora y por negocio, y cuando no le toca no escribe nada
 * (`SinNovedad`: ni auditoría ni clave de idempotencia).
 *
 * ── De dónde sale «la última vez» ──────────────────────────────────────────────────────────
 * De la propia auditoría: la última fila de `restaurante.limpiar_solicitudes` que salió bien. Sin
 * columna nueva, sin marca en la configuración y sin migración; como la limpieza que no tocaba no
 * deja fila, las que hay son exactamente las veces que corrió (la automática y la que el dueño
 * pide con su botón, que también cuenta: acaba de limpiar). El índice `auditoria_por_accion`
 * (organización, acción, fecha) la encuentra sin recorrer nada.
 */

/** La acción con la que `limpiar_solicitudes` se audita: el nombre del comando. */
export const ACCION_DE_LA_LIMPIEZA = 'restaurante.limpiar_solicitudes';

/** Lo más seguido que corre sola: una hora. */
export const ENTRE_LIMPIEZAS_MS = 3_600_000;

/** Aísla este cerrojo de cualquier otro que se pida sobre la misma organización. */
export const CLASE_DE_CERROJO = 'morphiqpos.restaurante.limpieza_de_solicitudes';

/**
 * ¿Le toca limpiar? Sí si nunca se ha limpiado o ya pasó la hora. Una «última vez» en el futuro
 * (relojes desfasados entre la aplicación y la base) no deja limpiar hasta que alcance al reloj.
 */
export function tocaLimpiar(ultima: Date | null, ahora: Date): boolean {
  if (ultima === null) return true;
  return ahora.getTime() - ultima.getTime() >= ENTRE_LIMPIEZAS_MS;
}

/** Cuándo salió bien la última limpieza de este negocio; `null` si nunca. */
async function ultimaLimpieza(tx: Transaccion, organizacionId: string): Promise<Date | null> {
  const filas = await sql<{ ultima: Date | string }>`
    select a.created_at as ultima
      from auditoria a
     where a.organizacion_id = ${organizacionId}
       and a.accion = ${ACCION_DE_LA_LIMPIEZA}
       and a.payload ->> 'resultado' = 'ok'
     order by a.created_at desc
     limit 1
  `.execute(tx);
  const fila = filas.rows[0];
  return fila === undefined ? null : new Date(fila.ultima);
}

/**
 * Decide, DENTRO de la transacción del comando, si a este negocio le toca limpiar ahora.
 *
 * Antes de leer toma un cerrojo consultivo de TRANSACCIÓN por negocio: dos visitas a Mesas a la
 * vez se forman, y la segunda lee ya la auditoría que dejó la primera al confirmar. Sin él las
 * dos verían «hace más de una hora» y limpiarían (y auditarían) las dos. El cerrojo se suelta
 * solo al confirmar o al revertir.
 */
export async function leTocaLimpiar(
  tx: Transaccion,
  organizacionId: string,
  ahora: Date,
): Promise<boolean> {
  await sql`
    select pg_advisory_xact_lock(
      hashtext(${CLASE_DE_CERROJO}::text),
      hashtext(${organizacionId}::text)
    )
  `.execute(tx);
  return tocaLimpiar(await ultimaLimpieza(tx, organizacionId), ahora);
}
