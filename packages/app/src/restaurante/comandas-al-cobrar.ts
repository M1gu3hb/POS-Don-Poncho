import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { quedanComandasActivas } from './datos.ts';
import { ajustarComandaAlMinimo } from './items.ts';
import { sincronizarMesa } from './preparacion-escrituras.ts';
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
): Promise<readonly ComandaCancelada[]> {
  const { rows } = await sql<ComandaCancelada>`
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
    returning c.id::text as "id", c.orden_id::text as "ordenId"
  `.execute(tx);
  return rows;
}

/** Una comanda que se quedó sin platillos vivos, con la cuenta de la que cuelga. */
export interface ComandaCancelada {
  readonly id: string;
  /** La cuenta dueña de la comanda: en una cuenta dividida, la madre (no la parte). */
  readonly ordenId: string;
}

/**
 * DP-15 · La revisión de código · La mesa, después de quitar lo último que faltaba.
 *
 * Cancelar la comanda vacía no movía la mesa: se quedaba en «pedido enviado» aunque ya no hubiera
 * nada en la cocina, o sin pasar a «Esperando entrega» aunque lo demás ya estuviera listo. Con lo
 * que queda de la cuenta dueña de las comandas:
 *   · todavía falta algo por preparar → la mesa no se mueve;
 *   · sólo quedan comandas listas → como si la última hubiera quedado lista: esperando entrega;
 *   · no queda nada vivo → ocupada, sin nada en cocina.
 */
export async function moverLaMesaTrasCancelar(
  tx: Transaccion,
  datos: {
    readonly organizacionId: string;
    readonly canceladas: readonly ComandaCancelada[];
    readonly empleoId: string | null;
    readonly ahora: Date;
  },
): Promise<void> {
  const porCuenta = new Map<string, string[]>();
  for (const c of datos.canceladas)
    porCuenta.set(c.ordenId, [...(porCuenta.get(c.ordenId) ?? []), c.id]);

  for (const [ordenId, comandas] of porCuenta) {
    const orden = await tx
      .selectFrom('ordenes')
      .select('mesa_id')
      .where('organizacion_id', '=', datos.organizacionId)
      .where('id', '=', ordenId)
      .executeTakeFirst();
    const mesaId = orden?.mesa_id ?? null;
    if (mesaId === null) continue;

    // Si quedan comandas listas, la mesa se mueve como si la última hubiera quedado lista
    // (`sincronizarMesa` comprueba entonces que nada falte por preparar); si no, como cancelada.
    const quedanListas = await quedanComandasActivas(tx, datos.organizacionId, ordenId, comandas, [
      'listo',
    ]);
    await sincronizarMesa(tx, {
      organizacionId: datos.organizacionId,
      ordenId,
      mesaId,
      comandasMovidas: comandas,
      estadoComanda: quedanListas ? 'listo' : 'cancelado',
      empleoId: datos.empleoId,
      ahora: datos.ahora,
    });
  }
}

/**
 * DP-15 · QA de la jornada, J-H3 · Lo que una estación termina DESPUÉS de que se cobró la cuenta.
 *
 * Al cobrar, lo que seguía por preparar se queda en la estación con la marca «Cuenta cobrada»
 * (`entregarLoListoDeLaCuenta`). Cuando la estación lo termina, ya no hay mesero que lo «entregue»
 * en el sistema —la mesa está en limpieza o libre—: la comanda se quedaba en «Listos» para siempre,
 * incluso después del Cierre del día. Los renglones listos de una cuenta PAGADA se dan por
 * entregados en el mismo movimiento, renglón por renglón (en una cuenta dividida, sólo los de las
 * partes pagadas).
 *
 * DP-16 · Salvo el pedido PARA LLEVAR: se cobra antes de preparar, y cuando la cocina lo termina
 * el cliente sigue esperando en la caja. Se queda «listo» hasta que la caja toca «Entregado». Las
 * mesas siguen igual (DP-D87, DP-D90).
 */
export async function entregarLoListoYaCobrado(
  tx: Transaccion,
  organizacionId: string,
  comandaId: string,
  ahora: Date,
): Promise<boolean> {
  const { rows } = await sql<{ id: string }>`
    update comanda_items ci
       set estado = 'entregado'
     where ci.organizacion_id = ${organizacionId}
       and ci.comanda_id = ${comandaId}
       and ci.estado = 'listo'
       and exists (
         select 1
           from orden_lineas ol
           join ordenes o on o.organizacion_id = ol.organizacion_id and o.id = ol.orden_id
          where ol.organizacion_id = ci.organizacion_id
            and ol.id = ci.orden_linea_id
            and o.estado = 'pagada'
            -- DP-16 · El pedido para llevar ya cobrado NO se entrega solo: espera en la Caja a que
            -- alguien se lo dé al cliente («Pedido para llevar N listo» → «Entregado»).
            and o.canal <> 'llevar')
    returning ci.id::text as "id"
  `.execute(tx);
  if (rows.length === 0) return false;

  const comanda = await tx
    .selectFrom('comandas')
    .select('estado')
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', comandaId)
    .executeTakeFirst();
  if (comanda !== undefined) {
    await ajustarComandaAlMinimo(
      tx,
      organizacionId,
      comandaId,
      comanda.estado as EstadoComanda,
      ahora,
    );
  }
  return true;
}
