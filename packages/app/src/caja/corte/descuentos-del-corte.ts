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
  readonly descuentos: readonly DescuentoDelCorte[];
  readonly totalCentavos: string;
  readonly alcance: 'caja' | 'dia';
}

/** Un corte de un restaurante no tiene tantos: el tope es el freno de una consulta sin página. */
const TOPE_DE_DESCUENTOS = 1_000;

export async function descuentosDelCorte(
  tx: Transaccion,
  organizacionId: string,
  alcance: AlcanceDelCorte,
): Promise<DescuentosDelCorte> {
  const { sesionId, sucursalId, cierraElDia, desde, hasta } = alcance;
  const { rows } = await sql<DescuentoDelCorte>`
    select o.id::text                                  as "ordenId",
           o.folio::text                               as "folio",
           m.numero                                    as "mesa",
           o.descuento_centavos::text                  as "montoCentavos",
           ev.nombre                                   as "autorizo",
           a.payload ->> 'motivo'                      as "motivo",
           to_char(a.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "cuando"
      from ordenes o
      left join mesas m on m.id = o.mesa_id
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
     where o.organizacion_id = ${organizacionId}
       and o.sucursal_id = ${sucursalId}
       and ${ORDEN_VENDIDA}
       and o.descuento_centavos > 0
       and (case when ${cierraElDia}::boolean
                 then o.cerrada_en > ${desde} and o.cerrada_en <= ${hasta}
                 else o.sesion_caja_id = ${sesionId}::uuid end)
     order by o.cerrada_en, o.id
     limit ${TOPE_DE_DESCUENTOS}
  `.execute(tx);
  const total = rows.reduce((suma, fila) => suma + BigInt(fila.montoCentavos), 0n);
  return {
    descuentos: rows,
    totalCentavos: total.toString(),
    alcance: cierraElDia ? 'dia' : 'caja',
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
