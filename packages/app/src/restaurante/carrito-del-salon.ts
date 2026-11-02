import 'server-only';

import type { Ambito } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

/**
 * EL CARRITO DEL PORTAL VISTO DESDE EL SALÓN (DP-12.2).
 *
 * Los comensales arman el carrito de su mesa aunque esté cerrada (`portal/carrito-comandos.ts`):
 * las líneas cuelgan de la MESA, no de una cuenta, y lo que se armó antes de abrir se conserva al
 * abrirla. Por eso alguien tiene que olvidarlas cuando ya no son de nadie:
 *   · cuando la cuenta de la mesa se cierra, cobrada o cancelada (también la vacía que se libera);
 *   · al cerrar el día, que en este sistema es cerrar la última caja de la sucursal.
 * Y tienen que seguir a la cuenta cuando la cuenta se va de mesa: al unir mesas pasan a la
 * principal, y al cambiar de mesa, a la nueva.
 *
 * `carritos_mesa` (la ronda) se queda donde está: es el contador de envíos de ESA mesa, y los
 * teléfonos sólo miran si sube.
 */

/** Olvida lo que quedó sin enviar en el carrito de una mesa. Devuelve cuántas líneas. */
export async function olvidarElCarritoDeLaMesa(
  tx: Transaccion,
  organizacionId: string,
  mesaId: string,
): Promise<number> {
  const borradas = await tx
    .deleteFrom('carrito_mesa_lineas')
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', '=', mesaId)
    .executeTakeFirst();
  return Number(borradas.numDeletedRows);
}

/** La cuenta se cerró: lo que quedó en el carrito de su mesa ya no es de nadie. */
export async function olvidarElCarritoDeLaCuenta(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
): Promise<number> {
  const borradas = await tx
    .deleteFrom('carrito_mesa_lineas')
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', 'in', (eb) =>
      eb
        .selectFrom('ordenes')
        .select('mesa_id')
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', ordenId)
        .where('mesa_id', 'is not', null)
        .$narrowType<{ mesa_id: string }>(),
    )
    .executeTakeFirst();
  return Number(borradas.numDeletedRows);
}

/** Se cerró la última caja: el día terminó y los carritos de la sucursal se vacían. */
export async function olvidarLosCarritosDeLaSucursal(
  tx: Transaccion,
  organizacionId: string,
  sucursalId: string,
): Promise<number> {
  const borradas = await tx
    .deleteFrom('carrito_mesa_lineas')
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', 'in', (eb) =>
      eb
        .selectFrom('mesas')
        .select('id')
        .where('organizacion_id', '=', organizacionId)
        .where('sucursal_id', '=', sucursalId),
    )
    .executeTakeFirst();
  return Number(borradas.numDeletedRows);
}

/**
 * El carrito sigue a la cuenta: las líneas y los teléfonos de `desde` pasan a `hacia`. Un teléfono
 * que ya latía en las dos se queda con su latido más reciente (la llave es mesa + huella).
 */
export async function moverElCarrito(
  tx: Transaccion,
  organizacionId: string,
  desde: string,
  hacia: string,
): Promise<void> {
  if (desde === hacia) return;
  await tx
    .updateTable('carrito_mesa_lineas')
    .set({ mesa_id: hacia })
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', '=', desde)
    .execute();
  await sql`
    insert into dispositivos_mesa (organizacion_id, mesa_id, dispositivo_huella, visto_en)
    select organizacion_id, ${hacia}::uuid, dispositivo_huella, visto_en
      from dispositivos_mesa
     where organizacion_id = ${organizacionId} and mesa_id = ${desde}
    on conflict (organizacion_id, mesa_id, dispositivo_huella)
    do update set visto_en = greatest(dispositivos_mesa.visto_en, excluded.visto_en)
  `.execute(tx);
  await tx
    .deleteFrom('dispositivos_mesa')
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', '=', desde)
    .execute();
}

/**
 * El aviso «Pedido listo para confirmar» de la mesa (una solicitud `ordenar` del portal) queda
 * resuelto por quien confirmó o borró el pedido: ya no espera a nadie.
 */
export async function resolverElAvisoDelPedido(
  tx: Transaccion,
  ambito: Ambito,
  mesaId: string,
  ahora: Date,
): Promise<void> {
  await tx
    .updateTable('solicitudes_qr')
    .set((eb) => ({
      estado: 'resuelta',
      atendida_en: eb.fn.coalesce('atendida_en', eb.val(ahora)),
      resuelta_en: ahora,
      empleado_atiende_id: eb.fn.coalesce('empleado_atiende_id', eb.val(ambito.empleoId)),
      updated_at: ahora,
    }))
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('mesa_id', '=', mesaId)
    .where('tipo', '=', 'ordenar')
    .where('estado', 'in', ['pendiente', 'atendida'])
    .execute();
}
