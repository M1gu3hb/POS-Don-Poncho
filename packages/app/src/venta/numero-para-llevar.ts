import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { diaDelNegocio } from '../reportes/dia.ts';

/**
 * DP-16 · «Pedido para llevar N»: el número del pedido, que empieza en 1 cada día del negocio.
 *
 * Lo toma `venta.cobrar` DENTRO de su transacción, después del folio y antes de mandar las
 * comandas: la cocina recibe la comanda ya con su número, y un cobro que se cancela no gasta
 * número (se revierte con todo lo demás).
 *
 * ── Por qué un candado y no sólo el índice único ───────────────────────────
 * Dos cajas que cobran a la vez leerían el mismo `max + 1` y la segunda chocaría con el índice
 * `ordenes_numero_pedido_del_dia` (23505): la cajera vería «Algo falló» con el cliente enfrente.
 * El candado de la transacción (por negocio) las pone en fila; el índice queda como la red.
 *
 * El día es el del negocio (`diaDelNegocio`, zona del negocio): a las 23:30 de CDMX sigue siendo
 * hoy aunque en UTC ya sea mañana, y a las 00:05 vuelve a empezar en 1.
 */

/** Aísla este candado de cualquier otro que se pida sobre la misma organización. */
export const CLASE_DE_CANDADO = 'morphiqpos.venta.numero_para_llevar';

export interface NumeroParaLlevar {
  readonly numero: number;
  /** `YYYY-MM-DD`, el día del negocio. */
  readonly dia: string;
}

export async function asignarNumeroParaLlevar(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
  ahora: Date,
): Promise<NumeroParaLlevar> {
  await sql`
    select pg_advisory_xact_lock(
      hashtext(${CLASE_DE_CANDADO}::text),
      hashtext(${organizacionId}::text)
    )
  `.execute(tx);

  // Un reintento del mismo cobro no le da otro número: el que ya tiene se queda.
  const yaTiene = await tx
    .selectFrom('ordenes')
    .select(['numero_pedido', 'dia_del_pedido'])
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', ordenId)
    .executeTakeFirst();
  if (yaTiene?.numero_pedido != null && yaTiene.dia_del_pedido !== null) {
    return { numero: yaTiene.numero_pedido, dia: yaTiene.dia_del_pedido.slice(0, 10) };
  }

  const { fecha } = await diaDelNegocio(tx, organizacionId, ahora);
  const siguiente = await sql<{ numero: number }>`
    select (coalesce(max(o.numero_pedido), 0) + 1)::int as numero
      from ordenes o
     where o.organizacion_id = ${organizacionId}
       and o.dia_del_pedido = ${fecha}::date
  `.execute(tx);
  const numero = siguiente.rows[0]?.numero ?? 1;

  await tx
    .updateTable('ordenes')
    .set({ numero_pedido: numero, dia_del_pedido: fecha })
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', ordenId)
    .execute();

  return { numero, dia: fecha };
}
