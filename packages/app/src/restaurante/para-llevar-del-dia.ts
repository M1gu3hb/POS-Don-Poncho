import 'server-only';

import { PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { diaDelNegocio } from '../reportes/dia.ts';

/**
 * DP-16 · Los pedidos para llevar del día, para la lista de la Caja.
 *
 * Cada pedido cobrado hoy con su número, su nombre y cómo va en la cocina. La Caja la lee cada
 * pocos segundos: cuando un pedido pasa a «listo» suena el aviso «Pedido para llevar N listo» con
 * su botón «Entregado» (`restaurante.entregar_pedidos`). Lo listo de un pedido para llevar NO se da
 * por entregado solo (`entregarLoListoYaCobrado`): alguien se lo tiene que dar al cliente.
 *
 * Sólo lectura, acotada al día del negocio y a 100 pedidos (el más nuevo primero).
 *
 * DP-18 · M3 (auditoría del 10-11): un pedido cobrado a las 23:55 y listo a las 00:05 desaparecía de
 * la lista a la medianoche, listo y sin entregar. Ahora también vienen los de los DOS días anteriores
 * que siguen en la cocina o listos (alguna comanda viva), marcados `deOtroDia`, hasta «Entregado».
 */

/** Hasta cuántos días atrás se busca lo que se cobró y no se ha entregado. */
const DIAS_DE_GRACIA = 2;

const ROLES_DE_CAJA = ['cajero', 'gerente', 'administrador', 'dueno'] as const;
const TOPE = 100;

export type EstadoParaLlevar = 'en_cocina' | 'listo' | 'entregado';

export interface PedidoParaLlevar {
  readonly ordenId: string;
  readonly numero: number;
  readonly nombre: string | null;
  readonly folio: string;
  readonly totalCentavos: string;
  readonly cobradoEn: string | null;
  readonly estado: EstadoParaLlevar;
  /** Comandas que siguen en el fuego (nuevo o en preparación). */
  readonly pendientes: number;
  /** Comandas listas esperando a que se entreguen. */
  readonly listas: number;
  readonly listoEn: string | null;
  /** DP-18 · Se cobró otro día (antes de medianoche o del Cierre) y no se ha entregado. */
  readonly deOtroDia: boolean;
}

export const entradaParaLlevarDelDia = z.object({}).strict();

interface Fila {
  ordenId: string;
  numero: number;
  nombre: string | null;
  serie: string;
  folio: string | null;
  totalCentavos: string;
  cobradoEn: Date | null;
  pendientes: number;
  listas: number;
  listoEn: Date | null;
  deOtroDia: boolean;
}

/** El estado del pedido sale de sus comandas: lo que falta manda sobre lo que ya está. */
export function estadoDelPedido(pendientes: number, listas: number): EstadoParaLlevar {
  if (pendientes > 0) return 'en_cocina';
  if (listas > 0) return 'listo';
  return 'entregado';
}

export async function leerParaLlevarDelDia(
  tx: Transaccion,
  organizacionId: string,
  sucursalId: string | null,
  ahora: Date,
): Promise<readonly PedidoParaLlevar[]> {
  const { fecha } = await diaDelNegocio(tx, organizacionId, ahora);
  const { rows } = await sql<Fila>`
    select o.id::text                                                         as "ordenId",
           o.numero_pedido                                                    as "numero",
           o.nombre_pedido                                                    as "nombre",
           o.serie                                                            as "serie",
           o.folio::text                                                      as "folio",
           o.total_centavos::text                                             as "totalCentavos",
           o.cerrada_en                                                       as "cobradoEn",
           (count(c.id) filter (where c.estado in ('nuevo', 'en_preparacion')))::int as "pendientes",
           (count(c.id) filter (where c.estado = 'listo'))::int              as "listas",
           max(c.lista_en)                                                    as "listoEn",
           (o.dia_del_pedido <> ${fecha}::date)                              as "deOtroDia"
      from ordenes o
      left join comandas c
        on c.organizacion_id = o.organizacion_id and c.orden_id = o.id
     where o.organizacion_id = ${organizacionId}
       and (o.dia_del_pedido = ${fecha}::date
            or (o.dia_del_pedido >= ${fecha}::date - ${DIAS_DE_GRACIA}::int
                and o.dia_del_pedido < ${fecha}::date
                and exists (select 1 from comandas v
                             where v.organizacion_id = o.organizacion_id and v.orden_id = o.id
                               and v.estado in ('nuevo', 'en_preparacion', 'listo'))))
       and o.numero_pedido is not null
       and o.estado = 'pagada'
       and (${sucursalId}::uuid is null or o.sucursal_id = ${sucursalId}::uuid)
     group by o.id
     order by o.dia_del_pedido desc, o.numero_pedido desc
     limit ${TOPE}
  `.execute(tx);

  return rows.map((f) => ({
    ordenId: f.ordenId,
    numero: f.numero,
    nombre: f.nombre,
    folio: f.folio === null ? '' : `${f.serie}-${f.folio}`,
    totalCentavos: f.totalCentavos,
    cobradoEn: f.cobradoEn === null ? null : new Date(f.cobradoEn).toISOString(),
    estado: estadoDelPedido(f.pendientes, f.listas),
    pendientes: f.pendientes,
    listas: f.listas,
    listoEn: f.listoEn === null ? null : new Date(f.listoEn).toISOString(),
    deOtroDia: f.deOtroDia,
  }));
}

export const paraLlevarDelDia = definirComando<
  Transaccion,
  typeof entradaParaLlevarDelDia,
  { readonly pedidos: readonly PedidoParaLlevar[] }
>({
  nombre: 'restaurante.para_llevar_del_dia',
  entidad: 'orden',
  escribe: false,
  roles: [...ROLES_DE_CAJA],
  paquetes: PAQUETES_RESTAURANTE,
  entrada: entradaParaLlevarDelDia,
  async ejecutar(ctx) {
    const { organizacionId, sucursalId } = ctx.ambito;
    const pedidos = await ctx.paso('leer_pedidos', () =>
      leerParaLlevarDelDia(ctx.tx, organizacionId, sucursalId, ctx.ahora),
    );
    return { pedidos };
  },
});
