import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

/**
 * LOS RETIROS QUE LLEVARON EL PIN DE UN GERENTE, en el corte (DP-16, encargo 1.4).
 *
 * Un retiro de la cajera arriba del umbral se autoriza con el PIN de un gerente, administrador o
 * dueño. Quién lo autorizó vive en la auditoría de `caja.movimiento` (`autorizadoPor`, junto al
 * `movimientoId` del renglón de `movimientos_caja`); aquí se junta para que el corte lo diga.
 */

export interface RetiroConPinDelCorte {
  readonly movimientoId: string;
  /** Con signo: un retiro es negativo. */
  readonly montoCentavos: string;
  readonly motivo: string | null;
  /** Quién retiró. */
  readonly quien: string | null;
  /** Quién tecleó su PIN. */
  readonly autorizo: string | null;
  readonly registradoEn: string;
}

const TOPE_DE_FILAS = 500;

export async function retirosConPinDelCorte(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly RetiroConPinDelCorte[]> {
  const { rows } = await sql<RetiroConPinDelCorte>`
    select m.id::text                          as "movimientoId",
           m.monto_centavos::text              as "montoCentavos",
           m.motivo                            as "motivo",
           ev.nombre                           as "quien",
           ea.nombre                           as "autorizo",
           to_char(m.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                                               as "registradoEn"
      from movimientos_caja m
      join auditoria a on a.organizacion_id = m.organizacion_id
                      and a.accion = 'caja.movimiento'
                      and a.entidad_id = m.sesion_caja_id
                      and a.payload ->> 'movimientoId' = m.id::text
                      and a.payload ->> 'autorizadoPor' is not null
      left join empleados_visibles ev on ev.id = m.empleado_id
      left join empleados_visibles ea on ea.id::text = a.payload ->> 'autorizadoPor'
     where m.organizacion_id = ${organizacionId}
       and m.sesion_caja_id = ${sesionCajaId}
       and m.tipo = 'retiro'
     order by m.created_at, m.id
     limit ${TOPE_DE_FILAS}
  `.execute(tx);
  return rows;
}
