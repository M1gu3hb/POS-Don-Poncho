import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { etiquetaDelMotivoDeAnulacion } from '@morphiqpos/domain/venta';
import { sql } from 'kysely';

/**
 * LAS CANCELACIONES, leídas del servidor para los DOS cortes y para Registros (DP-12.4).
 *
 * ── Quién canceló, de verdad ─────────────────────────────────────────────
 * El corte heredado de la Caja armaba su sección de cancelaciones en el navegador, desde las
 * ventas, y en la columna «Usuario» ponía a quien cobraba o atendía la cuenta: el cajero o el
 * mesero de la venta, no a quien la canceló. Esta lectura sale de las columnas que guardan el
 * hecho —`ordenes.cancelada_por` y `orden_lineas.empleado_anula_id`— y la leen la hoja del corte
 * y la lectura del corte heredado. Dos generadores, una sola verdad.
 *
 * ── Qué es una pérdida ───────────────────────────────────────────────────
 * Cancelar lo que ya estaba preparado o entregado: la comida se hizo y no se cobra. Se decide
 * con lo que la cocina dejó escrito —`comandas.lista_en` / `entregada_en`, y
 * `comanda_items.listo_en` / estado `entregado`—, NO con `orden_lineas.estado_preparacion`:
 * `restaurante.cancelar_orden` lo pisa a `cancelado` en todas las líneas y entonces ya no dice
 * qué se había preparado. Lo que se cancela antes de prepararse también queda, sin la marca.
 *
 * El criterio es el que pidió el dueño: «listo» o «entregado». Un plato `en_preparacion` aún no
 * cuenta (el dominio, `elConsumoSePerdio`, es más estricto con el insumo; aquí se habla del plato
 * que ya existe y se tiró).
 */

/** Tope de filas: un día de restaurante lleno cabe, y Registros pide menos. */
const TOPE_DE_FILAS = 500;

export interface Cancelacion {
  readonly tipo: 'orden' | 'linea';
  readonly folio: string | null;
  readonly hora: Date | null;
  /** Quién canceló (o anuló), por su nombre; no quien atendía ni quien cobraba la cuenta. */
  readonly usuario: string | null;
  /** Con palabras: el texto libre de la cuenta, o la etiqueta del motivo de la anulación. */
  readonly motivo: string | null;
  readonly producto: string | null;
  readonly montoCentavos: string;
  readonly mesa: string | null;
  /** `true` si ya estaba preparado o entregado: comida hecha que no se cobra. */
  readonly perdida: boolean;
}

/** Hasta dónde mirar: una sucursal (o todas, sin `sucursalId`) entre dos instantes. */
export interface AlcanceDeCancelaciones {
  readonly sucursalId: string | null;
  readonly desde: Date;
  readonly hasta: Date;
}

interface FilaCruda extends Omit<Cancelacion, 'motivo'> {
  readonly motivo: string | null;
}

/**
 * Una sola sentencia: la cuenta cancelada entera y el platillo anulado de una cuenta que sigue
 * (o que se canceló después: la cancelación de la cuenta no se lleva consigo un platillo que ya
 * se había anulado, que es otro importe).
 */
export async function leerCancelaciones(
  tx: Transaccion,
  organizacionId: string,
  alcance: AlcanceDeCancelaciones,
  tope: number = TOPE_DE_FILAS,
): Promise<readonly Cancelacion[]> {
  const { rows } = await sql<FilaCruda>`
    select 'orden'                              as "tipo",
           case when o.folio is null then null
                else o.serie || '-' || o.folio::text end as "folio",
           o.cancelada_en                       as "hora",
           ev.nombre                            as "usuario",
           o.motivo_cancelacion                 as "motivo",
           null::text                           as "producto",
           o.total_centavos::text               as "montoCentavos",
           coalesce(m.nombre, 'Mesa ' || m.numero::text) as "mesa",
           exists (
             select 1
               from comandas c
              where c.organizacion_id = o.organizacion_id
                and (c.orden_id = o.id
                     or c.orden_id in (
                          select mi.orden_absorbida_id
                            from union_mesa_miembros mi
                            join uniones_mesa u on u.id = mi.union_id
                           where u.organizacion_id = o.organizacion_id
                             and u.orden_id = o.id
                             and mi.orden_absorbida_id is not null))
                and (
                     exists (
                       select 1
                         from comanda_items ci
                        where ci.organizacion_id = c.organizacion_id
                          and ci.comanda_id = c.id
                          and (ci.listo_en is not null
                               or ci.estado = 'entregado'
                               or c.lista_en is not null
                               or c.entregada_en is not null)
                          and not exists (
                                select 1
                                  from orden_lineas ya
                                 where ya.id = ci.orden_linea_id
                                   and ya.anulada_en is not null))
                     or (not exists (
                           select 1
                             from comanda_items sin
                            where sin.organizacion_id = c.organizacion_id
                              and sin.comanda_id = c.id)
                         and (c.lista_en is not null or c.entregada_en is not null)))
           )                                    as "perdida"
      from ordenes o
      left join empleados_visibles ev on ev.id = o.cancelada_por
      left join mesas m on m.id = o.mesa_id and m.organizacion_id = o.organizacion_id
     where o.organizacion_id = ${organizacionId}
       and (${alcance.sucursalId}::uuid is null or o.sucursal_id = ${alcance.sucursalId}::uuid)
       and o.estado = 'cancelada'
       and o.cancelada_en between ${alcance.desde} and ${alcance.hasta}
    union all
    select 'linea',
           case when o.folio is null then null
                else o.serie || '-' || o.folio::text end,
           l.anulada_en,
           ev.nombre,
           l.motivo_anulacion,
           l.producto_nombre,
           l.total_centavos::text,
           coalesce(m.nombre, 'Mesa ' || m.numero::text),
           (l.estado_preparacion in ('listo', 'entregado')
            or exists (
                 select 1
                   from comanda_items ci
                  where ci.organizacion_id = l.organizacion_id
                    and ci.orden_linea_id = l.id
                    and (ci.listo_en is not null or ci.estado = 'entregado')))
      from orden_lineas l
      join ordenes o on o.id = l.orden_id and o.organizacion_id = l.organizacion_id
      left join empleados_visibles ev on ev.id = l.empleado_anula_id
      left join mesas m on m.id = o.mesa_id and m.organizacion_id = o.organizacion_id
     where l.organizacion_id = ${organizacionId}
       and (${alcance.sucursalId}::uuid is null or o.sucursal_id = ${alcance.sucursalId}::uuid)
       and l.anulada_en between ${alcance.desde} and ${alcance.hasta}
     order by 3 desc
     limit ${tope}
  `.execute(tx);

  return rows.map((fila) => ({
    ...fila,
    motivo: etiquetaDelMotivoDeAnulacion(fila.motivo),
  }));
}

/** La ventana de una sesión de caja: desde que se abrió hasta que se cerró (o hasta ahora). */
export interface VentanaDelCorte {
  readonly sucursalId: string;
  readonly abiertaEn: Date;
  readonly cerradaEn: Date | null;
}

/**
 * Las cancelaciones de la ventana de la sesión, en el orden en que pasaron. Una cuenta cancelada
 * que nunca se cobró no tiene sesión, así que se busca por su hora y su sucursal.
 */
export async function cancelacionesDelCorte(
  tx: Transaccion,
  organizacionId: string,
  sesion: VentanaDelCorte,
): Promise<readonly Cancelacion[]> {
  const filas = await leerCancelaciones(tx, organizacionId, {
    sucursalId: sesion.sucursalId,
    desde: sesion.abiertaEn,
    hasta: sesion.cerradaEn ?? new Date(),
  });
  // La consulta trae lo más reciente primero (para que un tope corte lo viejo); el corte lo cuenta
  // en el orden del día.
  return [...filas].reverse();
}
