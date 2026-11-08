import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { ajustarComandaAlMinimo } from './items.ts';
import { recalcularEstadoDeLineas } from './propagacion.ts';
import { type EstadoComanda } from './transiciones.ts';

/**
 * DP-15 · F1 · Lo que la pantalla de una estación deja de enseñar (M2).
 *
 * ── Al cobrar ───────────────────────────────────────────────────────────────
 * Lo que la cocina ya tenía «listo» se da por ENTREGADO: la cuenta se pagó, el plato salió. Sin
 * esto la comanda se quedaba en «Listos · esperando que el mesero recoja» por horas.
 *
 * Lo «nuevo» o «en preparación» NO se toca. Decisión (la más segura para la cocina): cerrarlo
 * escondería comida que sí se va a servir —una cuenta cobrada por adelantado, un cliente que
 * paga y espera el postre—. Sigue visible y la pantalla lo marca «cuenta cobrada».
 *
 * Se mueve por RENGLÓN y por las líneas de la cuenta cobrada, no por comanda: en una cuenta
 * dividida las comandas cuelgan de la madre y llevan platillos de las demás partes (el mismo
 * criterio de `cancelarLoDeLaParte`). La comanda sólo avanza cuando TODOS sus renglones lo hicieron.
 */
export async function entregarLoListoDeLaCuenta(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
  ahora: Date,
): Promise<readonly string[]> {
  const items = await tx
    .updateTable('comanda_items')
    .set({ estado: 'entregado' })
    .where('organizacion_id', '=', organizacionId)
    .where('estado', '=', 'listo')
    .where('orden_linea_id', 'in', (eb) =>
      eb
        .selectFrom('orden_lineas')
        .select('id')
        .where('organizacion_id', '=', organizacionId)
        .where('orden_id', '=', ordenId),
    )
    .returning('comanda_id')
    .execute();

  const comandaIds = [...new Set(items.map((i) => i.comanda_id))];
  for (const comandaId of comandaIds) {
    const comanda = await tx
      .selectFrom('comandas')
      .select('estado')
      .where('organizacion_id', '=', organizacionId)
      .where('id', '=', comandaId)
      .executeTakeFirst();
    if (comanda === undefined) continue;
    await ajustarComandaAlMinimo(
      tx,
      organizacionId,
      comandaId,
      comanda.estado as EstadoComanda,
      ahora,
    );
  }
  await recalcularEstadoDeLineas(tx, organizacionId, comandaIds);
  return comandaIds;
}

/**
 * Cancela las comandas de una línea a las que ya no les queda ningún renglón vivo.
 *
 * Quitar el único platillo de una comanda cancelaba su renglón pero dejaba la comanda `listo` o
 * `nuevo` en la pantalla de la estación. Si aún queda otro platillo la comanda sigue (la pantalla
 * no pinta el renglón quitado).
 */
export async function cancelarComandasSinPlatillos(
  tx: Transaccion,
  organizacionId: string,
  lineaId: string,
): Promise<void> {
  await sql`
    update comandas c
       set estado = 'cancelado'
     where c.organizacion_id = ${organizacionId}
       and c.id in (
         select ci.comanda_id from comanda_items ci
          where ci.organizacion_id = ${organizacionId}
            and ci.orden_linea_id = ${lineaId})
       and c.estado in ('nuevo', 'en_preparacion', 'listo')
       and not exists (
         select 1 from comanda_items ci
          where ci.organizacion_id = c.organizacion_id
            and ci.comanda_id = c.id
            and ci.estado <> 'cancelado')
  `.execute(tx);
}
