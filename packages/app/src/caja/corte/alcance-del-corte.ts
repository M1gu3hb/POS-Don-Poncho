import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

/**
 * DE QUÉ CANCELACIONES HABLA UN CORTE (DP-13.2, decisión DP-D50; Miguel la puede cambiar).
 *
 * Antes el corte contaba por sucursal y por hora: con dos cajas abiertas, las dos traían las
 * mismas cancelaciones, y lo cancelado sin caja abierta no salía en ninguna. La regla ahora:
 *
 *   · el corte de UNA caja trae sólo las cancelaciones de SUS cuentas: las de las cuentas que
 *     cobró (el platillo anulado de una cuenta que luego se cobró ahí) y las que canceló quien
 *     la abrió mientras estaba abierta (la cajera que cancela en su caja);
 *   · el CIERRE DEL DÍA es el corte de la última caja abierta de la sucursal al cerrar (ninguna
 *     otra quedaba abierta): trae TODAS las cancelaciones de la sucursal desde el Cierre del día
 *     anterior —las de las cajas, las de la mesera, las de nadie—, cada una una vez;
 *   · lo cancelado sin caja abierta cae, por lo mismo, en el Cierre del día que sigue.
 *
 * Las ventanas de dos Cierres del día no se tocan (cada una empieza donde acabó la anterior), así
 * que nada se cuenta dos veces. Sin Cierre anterior, la ventana empieza a medianoche, hora del
 * negocio, del día en que se abrió la caja. Dos cajas que cierran en el mismo instante: cierra el
 * día la de id mayor, la otra no.
 *
 * El corte de una caja abierta cuenta hasta la hora en que se lee (`hasta`), y lo dice
 * (`parcial` en la hoja): leído después, cambia, y no a escondidas.
 */
export interface AlcanceDelCorte {
  readonly sesionId: string;
  readonly sucursalId: string;
  /** Quien abrió la caja: lo que cancela él con la caja abierta es de esta caja. */
  readonly abreId: string;
  /** Es la última caja de la sucursal que cerró: su corte es el Cierre del día. */
  readonly cierraElDia: boolean;
  /** EXCLUSIVO: lo que pasó en este instante es de la ventana anterior. */
  readonly desde: Date;
  readonly hasta: Date;
}

/**
 * Una sola sentencia. `p` cierra el día si, en el instante en que cerró, ninguna otra caja de su
 * sucursal seguía abierta (abierta antes y cerrada después, o todavía abierta).
 */
const cierraElDia = (p: string) => sql`
  ${sql.ref(`${p}.cerrada_en`)} is not null
  and not exists (
        select 1
          from sesiones_caja q
         where q.organizacion_id = ${sql.ref(`${p}.organizacion_id`)}
           and q.sucursal_id = ${sql.ref(`${p}.sucursal_id`)}
           and q.id <> ${sql.ref(`${p}.id`)}
           and q.abierta_en <= ${sql.ref(`${p}.cerrada_en`)}
           and (q.cerrada_en is null
                or q.cerrada_en > ${sql.ref(`${p}.cerrada_en`)}
                or (q.cerrada_en = ${sql.ref(`${p}.cerrada_en`)} and q.id > ${sql.ref(`${p}.id`)})))`;

export async function alcanceDelCorte(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
  ahora: Date,
): Promise<AlcanceDelCorte | null> {
  const { rows } = await sql<AlcanceDelCorte>`
    select s.id                                       as "sesionId",
           s.sucursal_id                              as "sucursalId",
           s.empleado_abre_id                         as "abreId",
           (${cierraElDia('s')})                      as "cierraElDia",
           case
             when ${cierraElDia('s')} then coalesce(
               (select max(p.cerrada_en)
                  from sesiones_caja p
                 where p.organizacion_id = s.organizacion_id
                   and p.sucursal_id = s.sucursal_id
                   and p.cerrada_en < s.cerrada_en
                   and ${cierraElDia('p')}),
               (date_trunc('day', s.abierta_en at time zone o.zona_horaria)
                  at time zone o.zona_horaria) - interval '1 microsecond')
             else s.abierta_en - interval '1 microsecond'
           end                                        as "desde",
           coalesce(s.cerrada_en, ${ahora}::timestamptz) as "hasta"
      from sesiones_caja s
      join organizaciones o on o.id = s.organizacion_id
     where s.organizacion_id = ${organizacionId}
       and s.id = ${sesionCajaId}
  `.execute(tx);
  return rows[0] ?? null;
}
