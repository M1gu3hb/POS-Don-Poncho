import 'server-only';

import { ErrorDominio } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { sellarTransicionDeMesa } from './sala-escrituras.ts';

/**
 * REABRIR LA CUENTA PEDIDA PARA MANDAR UN PEDIDO DEL PORTAL (DP-13.3, punto 15).
 *
 * Los comensales arman su pedido en el portal; si entre tanto alguien pidió la cuenta (`cuenta_
 * solicitada`), el pedido ya no entra por el camino de siempre: la cuenta está en manos de la caja. El
 * mesero que lo confirma desde «Pedido del portal» puede REABRIRLA, y sólo si no se ha cobrado: la
 * cuenta vuelve a `confirmada` y la mesa a `ocupada`, y el envío sigue por el camino de siempre
 * (`comandarLasLineas`), que la avanza a «pedido enviado». Todo en la misma transacción que el envío:
 * si éste falla, la cuenta sigue pedida, tal cual estaba.
 *
 * Conserva el `codigo_caja` (el comensal ya tiene ese papel en la mano; al pedirla otra vez se
 * reutiliza, `restaurante/cuenta.ts`) y sube la versión de la cuenta, como cualquier cambio de sus
 * líneas, para que una caja que la tenía abierta sepa que cambió.
 */

export interface CuentaPorReabrir {
  readonly organizacionId: string;
  readonly sucursalId: string;
  readonly ordenId: string;
  readonly mesaId: string;
  readonly empleoId: string;
  readonly ahora: Date;
}

/** Lanza si la cuenta, justo ahora y con candado, ya no está pedida o ya tiene pagos. */
async function exigirQueSeaReabrible(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
): Promise<void> {
  const cuenta = await tx
    .selectFrom('ordenes')
    .select('estado')
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', ordenId)
    .forUpdate()
    .executeTakeFirst();
  if (cuenta?.estado !== 'cuenta_solicitada') {
    throw new ErrorDominio(
      'ORDEN_NO_EDITABLE',
      'Esa cuenta cambió mientras se reabría (quizá ya se cobró). Revísala en caja antes de reintentar.',
      { estado: cuenta?.estado ?? null },
    );
  }
  const pago = await tx
    .selectFrom('pagos')
    .select('id')
    .where('organizacion_id', '=', organizacionId)
    .where('orden_id', '=', ordenId)
    .executeTakeFirst();
  if (pago !== undefined) {
    throw new ErrorDominio(
      'CARRITO_CUENTA_CON_PAGOS',
      'Esa cuenta ya tiene pagos: no se reabre para mandarle más platillos. Termina de cobrarla.',
    );
  }
}

export async function reabrirLaCuentaPedida(
  tx: Transaccion,
  cuenta: CuentaPorReabrir,
): Promise<void> {
  const { organizacionId, ordenId, mesaId } = cuenta;
  await exigirQueSeaReabrible(tx, organizacionId, ordenId);
  await tx
    .updateTable('ordenes')
    .set({ estado: 'confirmada', version: sql`version + 1`, updated_at: cuenta.ahora })
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', ordenId)
    .execute();

  const mesa = await tx
    .selectFrom('mesas')
    .select('estado')
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', mesaId)
    .executeTakeFirst();
  if (mesa?.estado !== 'cuenta_solicitada') return;
  await tx
    .updateTable('mesas')
    .set({ estado: 'ocupada', updated_at: cuenta.ahora })
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', mesaId)
    .execute();
  await sellarTransicionDeMesa(tx, {
    organizacionId,
    sucursalId: cuenta.sucursalId,
    mesaId,
    ordenId,
    estadoAnterior: 'cuenta_solicitada',
    estadoNuevo: 'ocupada',
    empleadoId: cuenta.empleoId,
    ahora: cuenta.ahora,
  });
}
