import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../../definicion.ts';
import { COMANDOS_QUE_GASTAN_AUTORIZACION } from '../../venta/autorizacion-de-un-uso.ts';
import { alcanceDelCorte, type AlcanceDelCorte } from './alcance-del-corte.ts';
import { ORDEN_VENDIDA } from './consultas.ts';

/**
 * LOS DESCUENTOS DEL CORTE, uno por uno: cuánto, quién lo autorizó y por qué (DP-14.2, DP-D61).
 *
 * El corte ya traía «Descuentos otorgados, por usuario» (la suma por quien cobró). Desde DP-14.2
 * todo descuento lleva la clave de un gerente, administrador o dueño, y Miguel pidió verlos en el
 * corte y en el Cierre del día con nombre y motivo. El monto es el de la venta
 * (`ordenes.descuento_centavos`, lo que de verdad se descontó); quién y por qué salen de la
 * auditoría del comando que lo aplicó (la última, porque volver a descontar REEMPLAZA), de la
 * cuenta misma o de la cuenta de la que es parte, si se descontó antes de dividirla.
 *
 * El alcance es el de las cancelaciones (`alcance-del-corte.ts`): el corte de una caja trae lo que
 * ESA caja cobró; el Cierre del día, todo lo cobrado en la sucursal desde el Cierre anterior.
 */

export interface DescuentoDelCorte {
  readonly ordenId: string;
  readonly folio: string | null;
  readonly mesa: number | null;
  readonly montoCentavos: string;
  /** Quien tecleó su PIN. Nulo en un descuento de antes de DP-14.2 que no pasaba del tope. */
  readonly autorizo: string | null;
  readonly motivo: string | null;
  readonly cuando: string | null;
}

export interface DescuentosDelCorte {
  /** Hasta el tope de filas: si `cuantos` es mayor, la lista se cortó («se muestran X de N»). */
  readonly descuentos: readonly DescuentoDelCorte[];
  /** Cuántos son en TOTAL, contados en SQL (la lista puede cortarse, esto no). */
  readonly cuantos: number;
  /** La suma de TODOS, en SQL: no sólo de lo que cupo en la lista. */
  readonly totalCentavos: string;
  readonly alcance: 'caja' | 'dia';
}

/** Un corte de un restaurante no tiene tantos: el tope es el freno de la LISTA (la suma no se corta). */
const TOPE_DE_DESCUENTOS = 1_000;

/** Las ventas con descuento que entran en este corte (sin orden ni tope): la lista y la suma. */
function cobradasConDescuento(organizacionId: string, alcance: AlcanceDelCorte) {
  const { sesionId, sucursalId, cierraElDia, desde, hasta } = alcance;
  return sql`
      from ordenes o
     where o.organizacion_id = ${organizacionId}
       and o.sucursal_id = ${sucursalId}
       and ${ORDEN_VENDIDA}
       and o.descuento_centavos > 0
       and (case when ${cierraElDia}::boolean
                 then o.cerrada_en > ${desde} and o.cerrada_en <= ${hasta}
                 else o.sesion_caja_id = ${sesionId}::uuid end)`;
}

export async function descuentosDelCorte(
  tx: Transaccion,
  organizacionId: string,
  alcance: AlcanceDelCorte,
  tope: number = TOPE_DE_DESCUENTOS,
): Promise<DescuentosDelCorte> {
  const { rows } = await sql<DescuentoDelCorte>`
    select o.id::text                                  as "ordenId",
           case when o.folio is null then null
                else o.serie || '-' || o.folio::text end as "folio",
           m.numero                                    as "mesa",
           o.descuento_centavos::text                  as "montoCentavos",
           ev.nombre                                   as "autorizo",
           a.payload ->> 'motivo'                      as "motivo",
           to_char(a.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "cuando"
      from (select o.* ${cobradasConDescuento(organizacionId, alcance)}
             order by o.cerrada_en, o.id
             limit ${tope}) o
      left join ordenes madre on madre.id = o.orden_padre_id
                             and madre.organizacion_id = o.organizacion_id
      left join mesas m on m.id = coalesce(o.mesa_id, madre.mesa_id)
                       and m.organizacion_id = o.organizacion_id
      left join lateral (
             select au.payload, au.created_at
               from auditoria au
              where au.organizacion_id = o.organizacion_id
                and au.accion in (${sql.join([...COMANDOS_QUE_GASTAN_AUTORIZACION])})
                and au.entidad_id in (o.id, coalesce(o.orden_padre_id, o.id))
              order by au.created_at desc
              limit 1
           ) a on true
      left join empleados_visibles ev on ev.id::text = a.payload ->> 'autorizadoPor'
     order by o.cerrada_en, o.id
  `.execute(tx);
  // La cuenta y la suma salen de SQL sobre TODAS, no de la lista: si se cortó, no se queda corta.
  const { rows: totales } = await sql<{ cuantos: number; total: string }>`
    select count(*)::int as cuantos,
           coalesce(sum(o.descuento_centavos), 0)::text as total
      ${cobradasConDescuento(organizacionId, alcance)}
  `.execute(tx);
  return {
    descuentos: rows,
    cuantos: totales[0]?.cuantos ?? 0,
    totalCentavos: totales[0]?.total ?? '0',
    alcance: alcance.cierraElDia ? 'dia' : 'caja',
  };
}

export const entradaDescuentosDelCorte = z.object({ sesionCajaId: z.uuid() });

const ROLES_DE_CAJA = ['cajero', 'gerente', 'administrador', 'dueno'] as const;

/** `POST /api/caja/descuentos-del-corte`: la lectura del corte heredado de la Caja. */
export const descuentosDelCorteComando = definirComando<
  Transaccion,
  typeof entradaDescuentosDelCorte,
  DescuentosDelCorte
>({
  nombre: 'caja.descuentos_del_corte',
  entidad: 'sesion_caja',
  escribe: false,
  roles: [...ROLES_DE_CAJA],
  paquetes: PAQUETES_MOSTRADOR,
  sucursal: { sesionCajaId: 'sesiones_caja' },
  entrada: entradaDescuentosDelCorte,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const alcance = await ctx.paso('leer_alcance', () =>
      alcanceDelCorte(ctx.tx, organizacionId, entrada.sesionCajaId, ctx.ahora),
    );
    if (alcance === null) {
      throw new ErrorDominio('PUENTE_NO_ENCONTRADO', 'Ese corte no existe en este negocio.');
    }
    return ctx.paso('leer_descuentos', () => descuentosDelCorte(ctx.tx, organizacionId, alcance));
  },
});
