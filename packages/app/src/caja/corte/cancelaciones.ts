import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { etiquetaDelMotivoDeAnulacion } from '@morphiqpos/domain/venta';
import { sql } from 'kysely';

import type { AlcanceDelCorte } from './alcance-del-corte.ts';

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
 *
 * ── Cuánto se perdió (DP-13.2) ───────────────────────────────────────────
 * Antes, una cuenta con UN platillo listo marcaba pérdida la cuenta entera. La pérdida es sólo el
 * valor de lo que ya estaba hecho y no se cobró (`perdidaCentavos`): de cada platillo de la cuenta
 * que no se anuló aparte, la parte que la cocina dejó lista o se entregó, a su precio en la
 * cuenta. Lo demás de la cuenta es cancelado sin costo. Un platillo anulado es pérdida entera si
 * ya estaba hecho, cero si no.
 *
 * De QUÉ cancelaciones habla cada corte lo dice `alcance-del-corte.ts`.
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
  /** Todo lo cancelado (la cuenta o el platillo). */
  readonly montoCentavos: string;
  readonly mesa: string | null;
  /** De eso, lo que ya estaba listo o entregado: comida hecha que no se cobra. */
  readonly perdidaCentavos: string;
  /** `true` si hay pérdida (`perdidaCentavos > 0`). */
  readonly perdida: boolean;
}

/** Hasta dónde mirar: una sucursal (o todas, sin `sucursalId`) entre dos instantes. */
export interface AlcanceDeCancelaciones {
  readonly sucursalId: string | null;
  readonly desde: Date;
  readonly hasta: Date;
}

/** El platillo de la comanda, `ci`, ya salió: listo o entregado, ÉL. */
export const yaHechoElPlatillo = sql`(ci.listo_en is not null or ci.estado = 'entregado')`;

/**
 * En una cuenta cancelada entera, también cuenta la comanda `c` lista o entregada: sus platillos
 * vivos salieron con ella. NO vale para un platillo anulado: si se quitó antes y la cocina dejó
 * lista la comanda con lo demás, ese platillo no se hizo (DP-13.2).
 */
export const yaHechoEnLaCuenta = sql`(${yaHechoElPlatillo}
                               or c.lista_en is not null
                               or c.entregada_en is not null)`;

/**
 * Lo que vale lo ya hecho de la cuenta `o`: de cada platillo que no se anuló aparte, la parte que
 * la cocina dejó lista o se entregó (por cantidad, nunca más que el platillo), a su precio.
 */
const perdidaPorLaCocina = sql`coalesce((
    select sum(round(l.total_centavos
                     * least(1, hecho.cantidad / nullif(l.cantidad::numeric, 0))))
      from orden_lineas l
      join lateral (
        select sum(ci.cantidad::numeric) as cantidad
          from comanda_items ci
          join comandas c on c.id = ci.comanda_id and c.organizacion_id = ci.organizacion_id
         where ci.organizacion_id = l.organizacion_id
           and ci.orden_linea_id = l.id
           and ${yaHechoEnLaCuenta}
      ) hecho on hecho.cantidad is not null
     where l.organizacion_id = o.organizacion_id
       and l.orden_id = o.id
       and l.anulada_en is null), 0)::bigint`;

/**
 * DP-14.6-7 · La cuenta que se canceló SIN poder comprobar la cocina, con el PIN de un gerente
 * (`restaurante.cancelar_orden` con `sinComprobarLaCocina`): no se sabe qué salió, así que todo lo
 * vivo es pérdida. La marca vive en su entrada de la auditoría (sin columna nueva: cero DDL).
 */
const todoComoHecho = sql`exists (
    select 1
      from auditoria au
     where au.organizacion_id = o.organizacion_id
       and au.entidad = 'orden'
       and au.entidad_id = o.id
       and au.accion = 'restaurante.cancelar_orden'
       and au.payload ->> 'todoComoHecho' = 'true')`;

const perdidaDeLaCuenta = sql`case
    when ${todoComoHecho} then coalesce((
      select sum(l.total_centavos)
        from orden_lineas l
       where l.organizacion_id = o.organizacion_id
         and l.orden_id = o.id
         and l.anulada_en is null), 0)::bigint
    else ${perdidaPorLaCocina}
  end`;

/** El platillo anulado `l`: si ya estaba hecho (él, no su comanda), se perdió entero. */
const perdidaDeLaLinea = sql`case
    when l.estado_preparacion in ('listo', 'entregado')
      or exists (
           select 1
             from comanda_items ci
            where ci.organizacion_id = l.organizacion_id
              and ci.orden_linea_id = l.id
              and ${yaHechoElPlatillo})
    then l.total_centavos
    else 0
  end`;

const folio = sql`case when o.folio is null then null else o.serie || '-' || o.folio::text end`;
/** La mesa; la de una PARTE de una cuenta dividida es la de su madre (las partes nacen sin mesa). */
const mesa = sql`coalesce(m.nombre, 'Mesa ' || m.numero::text)`;

type FilaCruda = Omit<Cancelacion, 'perdida'>;

/** Las columnas de la cuenta cancelada entera, `o`. */
const deLaCuenta = sql`
    select 'orden'                       as "tipo",
           ${folio}                      as "folio",
           o.cancelada_en                as "hora",
           ev.nombre                     as "usuario",
           o.motivo_cancelacion          as "motivo",
           null::text                    as "producto",
           o.total_centavos::text        as "montoCentavos",
           ${mesa}                       as "mesa",
           ${perdidaDeLaCuenta}::text    as "perdidaCentavos"
      from ordenes o
      left join empleados_visibles ev on ev.id = o.cancelada_por
      left join ordenes madre on madre.id = o.orden_padre_id
                             and madre.organizacion_id = o.organizacion_id
      left join mesas m on m.id = coalesce(o.mesa_id, madre.mesa_id)
                       and m.organizacion_id = o.organizacion_id`;

/**
 * Las columnas del platillo anulado, `l`, de una cuenta que sigue (o que se canceló después: la
 * cancelación de la cuenta no se lleva consigo un platillo que ya se había anulado, que es otro
 * importe).
 */
const delPlatillo = sql`
    select 'linea',
           ${folio},
           l.anulada_en,
           ev.nombre,
           l.motivo_anulacion,
           l.producto_nombre,
           l.total_centavos::text,
           ${mesa},
           (${perdidaDeLaLinea})::text
      from orden_lineas l
      join ordenes o on o.id = l.orden_id and o.organizacion_id = l.organizacion_id
      left join empleados_visibles ev on ev.id = l.empleado_anula_id
      left join ordenes madre on madre.id = o.orden_padre_id
                             and madre.organizacion_id = o.organizacion_id
      left join mesas m on m.id = coalesce(o.mesa_id, madre.mesa_id)
                       and m.organizacion_id = o.organizacion_id`;

const conPalabras = (filas: readonly FilaCruda[]): readonly Cancelacion[] =>
  filas.map((fila) => ({
    ...fila,
    motivo: etiquetaDelMotivoDeAnulacion(fila.motivo),
    perdida: BigInt(fila.perdidaCentavos) > 0n,
  }));

/**
 * Las de una sucursal (o de todas) entre dos instantes, lo más reciente primero: Registros. Una
 * sola sentencia.
 */
export async function leerCancelaciones(
  tx: Transaccion,
  organizacionId: string,
  alcance: AlcanceDeCancelaciones,
  tope: number = TOPE_DE_FILAS,
): Promise<readonly Cancelacion[]> {
  const { rows } = await sql<FilaCruda>`
    ${deLaCuenta}
     where o.organizacion_id = ${organizacionId}
       and (${alcance.sucursalId}::uuid is null or o.sucursal_id = ${alcance.sucursalId}::uuid)
       and o.estado = 'cancelada'
       and o.cancelada_en between ${alcance.desde} and ${alcance.hasta}
    union all
    ${delPlatillo}
     where l.organizacion_id = ${organizacionId}
       and (${alcance.sucursalId}::uuid is null or o.sucursal_id = ${alcance.sucursalId}::uuid)
       and l.anulada_en between ${alcance.desde} and ${alcance.hasta}
     order by 3 desc
     limit ${tope}
  `.execute(tx);
  return conPalabras(rows);
}

/**
 * Las de UN corte (`alcance-del-corte.ts`), en el orden en que pasaron. Una sola sentencia.
 *
 *   · Cierre del día: todas las de la sucursal en su ventana.
 *   · Una caja: la cuenta cancelada por quien la abrió, con la caja abierta; el platillo anulado
 *     de una cuenta que esta caja cobró (cuando sea que se anuló, hasta el cierre), o, de una
 *     cuenta que nadie ha cobrado, el que anuló quien la abrió con la caja abierta.
 */
/** Las filas que entran en un corte (sin orden ni tope): las lee la lista y las suma el total. */
function delCorte(organizacionId: string, alcance: AlcanceDelCorte) {
  const { sesionId, sucursalId, abreId, cierraElDia, desde, hasta } = alcance;
  return sql`
    ${deLaCuenta}
     where o.organizacion_id = ${organizacionId}
       and o.sucursal_id = ${sucursalId}
       and o.estado = 'cancelada'
       and o.cancelada_en > ${desde}
       and o.cancelada_en <= ${hasta}
       and (${cierraElDia}::boolean
            or o.sesion_caja_id = ${sesionId}
            or (o.sesion_caja_id is null and o.cancelada_por = ${abreId}))
    union all
    ${delPlatillo}
     where l.organizacion_id = ${organizacionId}
       and o.sucursal_id = ${sucursalId}
       and l.anulada_en <= ${hasta}
       and ((${cierraElDia}::boolean and l.anulada_en > ${desde})
            or (not ${cierraElDia}::boolean
                and (o.sesion_caja_id = ${sesionId}
                     or (o.sesion_caja_id is null
                         and l.empleado_anula_id = ${abreId}
                         and l.anulada_en > ${desde}))))`;
}

export async function cancelacionesDelCorte(
  tx: Transaccion,
  organizacionId: string,
  alcance: AlcanceDelCorte,
  tope: number = TOPE_DE_FILAS,
): Promise<readonly Cancelacion[]> {
  const { rows } = await sql<FilaCruda>`
    ${delCorte(organizacionId, alcance)}
     order by 3
     limit ${tope}
  `.execute(tx);
  return conPalabras(rows);
}

/** Cuántas son en TOTAL y cuánto suman, contado en SQL: la lista puede cortarse, esto no. */
export interface TotalDeCancelaciones {
  readonly cuantas: number;
  readonly montoCentavos: string;
  readonly perdidaCentavos: string;
}

export async function totalDeLasCancelacionesDelCorte(
  tx: Transaccion,
  organizacionId: string,
  alcance: AlcanceDelCorte,
): Promise<TotalDeCancelaciones> {
  const { rows } = await sql<{ cuantas: number; monto: string; perdida: string }>`
    select count(*)::int as cuantas,
           coalesce(sum(t."montoCentavos"::numeric), 0)::text as monto,
           coalesce(sum(t."perdidaCentavos"::numeric), 0)::text as perdida
      from (${delCorte(organizacionId, alcance)}) t
  `.execute(tx);
  const fila = rows[0];
  return {
    cuantas: fila?.cuantas ?? 0,
    montoCentavos: fila?.monto ?? '0',
    perdidaCentavos: fila?.perdida ?? '0',
  };
}
