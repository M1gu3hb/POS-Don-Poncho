import 'server-only';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { TOPE_DE_FILAS } from './consultas.ts';

/**
 * LAS DEVOLUCIONES DEL CORTE (cierre de la 2.4).
 *
 * «Devolución de material vendible · Resta de la venta del día en que se devuelve» (ferretería
 * §1, y lo mismo la tienda y el salón): la devolución es un documento propio (178) y el corte
 * de la caja donde se hizo la resta. Cada giro la dice por su método: en efectivo sale del
 * cajón —y la cascada del esperado ya la lleva—; con tarjeta o transferencia queda por
 * reversar; fiada o a crédito (182) baja lo que el cliente debe y no toca el cajón.
 *
 * Se atribuye por la CAJA de la devolución (`devoluciones.sesion_caja_id`): toda devolución
 * nombra la de su terminal, aunque no mueva el cajón.
 */

export interface DevolucionDelCorte {
  /** El folio de la VENTA devuelta, con su serie: «A-128». */
  readonly folio: string | null;
  readonly devueltaEn: Date;
  readonly metodo: string;
  readonly montoCentavos: string;
  readonly motivo: string;
  readonly quien: string | null;
  /** Si algo volvió de verdad al almacén: hay un movimiento de stock de la devolución. */
  readonly regresoAlInventario: boolean;
  /**
   * El costo de lo que REGRESÓ al almacén, a lo que costaba al venderse: deja de ser costo
   * de ventas. Lo que no regresó (dañado, ya preparado) sigue siendo costo: se perdió.
   */
  readonly costoDevueltoCentavos: string;
}

/**
 * QA2-011 (DP-13.5): lo que regresó se lee de lo que la devolución escribió en el almacén, no de
 * su casilla «regresa al inventario». Lo de receta no vuelve aunque la casilla diga que sí (ya se
 * preparó, `venta/devolucion-de-venta.ts`): con la casilla, el corte daba por regresado el costo
 * de un platillo que nunca volvió y lo quitaba del costo de ventas.
 */
const REGRESO_DE_LA_DEVOLUCION = sql`
  select 1 from movimientos_stock ms
   where ms.organizacion_id = d.organizacion_id
     and ms.referencia_tipo = 'devolucion'
     and ms.referencia_id = d.id
`;

export async function devolucionesDelCorte(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly DevolucionDelCorte[]> {
  const { rows } = await sql<DevolucionDelCorte>`
    select o.serie || '-' || coalesce(o.folio::text, '—') as "folio",
           d.created_at                                    as "devueltaEn",
           d.metodo                                        as "metodo",
           d.monto_centavos::text                          as "montoCentavos",
           d.motivo                                        as "motivo",
           ev.nombre                                       as "quien",
           exists (${REGRESO_DE_LA_DEVOLUCION})            as "regresoAlInventario",
           coalesce((
             select sum(round(l.costo_unitario_centavos * dl.cantidad))
               from devoluciones_lineas dl
               join orden_lineas l on l.id = dl.orden_linea_id
                                  and l.organizacion_id = dl.organizacion_id
               join insumos i on i.producto_id = l.producto_id
                             and i.organizacion_id = l.organizacion_id
              where dl.organizacion_id = d.organizacion_id
                and dl.devolucion_id = d.id
                and exists (${REGRESO_DE_LA_DEVOLUCION} and ms.insumo_id = i.id)
           ), 0)::text                                     as "costoDevueltoCentavos"
      from devoluciones d
      join ordenes o on o.id = d.orden_id and o.organizacion_id = d.organizacion_id
      left join empleados_visibles ev on ev.id = d.empleado_id
     where d.organizacion_id = ${organizacionId}
       and d.sesion_caja_id = ${sesionCajaId}
     order by d.created_at
     limit ${TOPE_DE_FILAS}
  `.execute(tx);
  return rows;
}

/** Lo devuelto en la sesión, por método: lo que el resumen resta de la venta. */
export function devueltoPorMetodo(devoluciones: readonly DevolucionDelCorte[]): readonly {
  readonly metodo: string;
  readonly montoCentavos: string;
  readonly cuantas: number;
}[] {
  const porMetodo = new Map<string, { monto: bigint; cuantas: number }>();
  for (const d of devoluciones) {
    const previo = porMetodo.get(d.metodo) ?? { monto: 0n, cuantas: 0 };
    porMetodo.set(d.metodo, {
      monto: previo.monto + BigInt(d.montoCentavos),
      cuantas: previo.cuantas + 1,
    });
  }
  return [...porMetodo].map(([metodo, { monto, cuantas }]) => ({
    metodo,
    montoCentavos: monto.toString(),
    cuantas,
  }));
}
