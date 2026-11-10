import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { ORDEN_VENDIDA, TOPE_DE_FILAS } from './consultas.ts';

/**
 * DP-16 · LAS OPCIONES VENDIDAS EN UNA CAJA, para el corte.
 *
 * El total de cada platillo ya trae lo que sumaron sus opciones (el servidor lo cobra en la
 * línea); esto dice DE DÓNDE salió: cuántas veces se pidió «Extras: Queso» y cuánto sumó, y cuánto
 * restó «Sin crema». Cuenta como cobra el servidor (`precio-de-las-opciones.ts`): por pieza en lo
 * que va por pieza y una vez por renglón en lo que va por peso o por porción. Sólo lo cobrado y no
 * anulado, igual que «Productos vendidos».
 */

export interface OpcionVendida {
  readonly grupo: string;
  readonly opcion: string;
  /** Piezas que la llevaron (en lo que va por peso, renglones). */
  readonly veces: string;
  /** Lo que sumó (o restó), en centavos con signo. */
  readonly importeCentavos: string;
}

const POR_RENGLON = sql`l.tipo_venta in ('variable_medida', 'porcion_contenedor')`;

export async function opcionesVendidas(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly OpcionVendida[]> {
  const { rows } = await sql<OpcionVendida>`
    select m.modificador_nombre                                         as "grupo",
           m.opcion_nombre                                              as "opcion",
           trim_scale(sum(case when ${POR_RENGLON} then 1
                               else l.cantidad end)::numeric)::text     as "veces",
           sum(case when ${POR_RENGLON} then m.delta_precio_centavos
                    else round(m.delta_precio_centavos * l.cantidad)::bigint end)::text
                                                                        as "importeCentavos"
      from orden_linea_modificadores m
      join orden_lineas l on l.id = m.orden_linea_id
      join ordenes o on o.id = l.orden_id and o.organizacion_id = l.organizacion_id
     where l.organizacion_id = ${organizacionId}
       and o.sesion_caja_id = ${sesionCajaId}
       and ${ORDEN_VENDIDA}
       and l.anulada_en is null
     group by m.modificador_nombre, m.opcion_nombre
     order by sum(case when ${POR_RENGLON} then m.delta_precio_centavos
                       else round(m.delta_precio_centavos * l.cantidad)::bigint end) desc,
              2, 1
     limit ${TOPE_DE_FILAS}
  `.execute(tx);
  return rows;
}
