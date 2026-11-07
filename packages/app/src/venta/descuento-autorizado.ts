import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { COMANDOS_QUE_GASTAN_AUTORIZACION } from './autorizacion-de-un-uso.ts';

/**
 * `venta.descuento_autorizado` — EL DESCUENTO DE UNA CUENTA, CON QUIÉN Y POR QUÉ (DP-14 · ronda 2,
 * medio 4).
 *
 * El cobro de la Caja pinta el subtotal en bruto, «Descuento −$X», quién tecleó su PIN y el motivo,
 * para que el cajero sepa lo que cobra. Es la misma lectura que el corte (`descuentos-del-corte.ts`):
 * la ÚLTIMA entrada de la auditoría de un comando que descuenta, de la cuenta o de su madre (una
 * parte de una cuenta dividida hereda el descuento de la madre). Sólo lee.
 */

export const entradaDescuentoAutorizado = z.object({ ordenId: z.uuid() });

export interface DescuentoAutorizado {
  readonly montoCentavos: string;
  /** Quien tecleó su PIN; nulo si la cuenta no tiene descuento (o uno de antes de DP-14.2). */
  readonly autorizo: string | null;
  readonly motivo: string | null;
}

const ROLES_DE_CAJA = ['cajero', 'gerente', 'administrador', 'dueno'] as const;

export const descuentoAutorizadoComando = definirComando<
  Transaccion,
  typeof entradaDescuentoAutorizado,
  DescuentoAutorizado
>({
  nombre: 'venta.descuento_autorizado',
  entidad: 'orden',
  escribe: false,
  roles: [...ROLES_DE_CAJA],
  paquetes: PAQUETES_MOSTRADOR,
  sucursal: { ordenId: 'ordenes' },
  entrada: entradaDescuentoAutorizado,
  async ejecutar(ctx, entrada) {
    const { rows } = await sql<{
      montoCentavos: string;
      autorizo: string | null;
      motivo: string | null;
    }>`
      select o.descuento_centavos::text as "montoCentavos",
             case when o.descuento_centavos > 0 then ev.nombre end as "autorizo",
             case when o.descuento_centavos > 0 then a.payload ->> 'motivo' end as "motivo"
        from ordenes o
        left join lateral (
               select au.payload
                 from auditoria au
                where au.organizacion_id = o.organizacion_id
                  and au.accion in (${sql.join([...COMANDOS_QUE_GASTAN_AUTORIZACION])})
                  and au.entidad_id in (o.id, coalesce(o.orden_padre_id, o.id))
                order by au.created_at desc
                limit 1
             ) a on true
        left join empleados_visibles ev on ev.id::text = a.payload ->> 'autorizadoPor'
       where o.organizacion_id = ${ctx.ambito.organizacionId}
         and o.id = ${entrada.ordenId}
    `.execute(ctx.tx);
    const fila = rows[0];
    if (fila === undefined)
      throw new ErrorDominio('ORDEN_NO_ENCONTRADA', 'Esa cuenta ya no existe.');
    return fila;
  },
});
