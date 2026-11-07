import 'server-only';

import { ErrorDominio } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { MAXIMO_EN_EL_CARRITO, carritoCaducado } from '../portal/carrito.ts';
import { PREFIJO_DEL_PEDIDO_LISTO } from '../portal/quien-envia.ts';

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

/**
 * Olvida lo que quedó sin enviar en el carrito de una mesa. Devuelve cuántas líneas.
 *
 * DP-14.1-3 · `hasta` (opcional): sólo lo anterior a ese momento —líneas creadas, teléfonos vistos—.
 * «Mesa limpia» lo pasa con el cierre de la cuenta para no borrar lo que la familia NUEVA armó con
 * la mesa en limpieza; su aviso «Pedido listo» sólo se resuelve si ya no queda nada en el carrito.
 * Sin `hasta`, todo (cobrar, cancelar, liberar sin cuenta, caducar, portal).
 */
export async function olvidarElCarritoDeLaMesa(
  tx: Transaccion,
  organizacionId: string,
  mesaId: string,
  ahora: Date,
  hasta?: Date,
): Promise<number> {
  const lineas = tx
    .deleteFrom('carrito_mesa_lineas')
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', '=', mesaId);
  const borradas = await (
    hasta === undefined ? lineas : lineas.where('created_at', '<=', hasta)
  ).executeTakeFirst();
  // Revisión de DP-13: sin carrito, su «Pedido listo para confirmar» ya no espera a nadie (el
  // cobro, cancelar, liberar, caducar: cualquier borrado en masa, no sólo quitar y enviar).
  if (hasta === undefined) await resolverElAvisoDelPedido(tx, organizacionId, mesaId, null, ahora);
  else await resolverElAvisoSiQuedoVacio(tx, organizacionId, mesaId, null, ahora);
  // QA2-006 (DP-13.5): y sus teléfonos. Sólo se mudaban con la cuenta: con el id firmado cada
  // teléfono nuevo es una fila, y la mesa acumulaba los de todas las familias (y la siguiente
  // contaba como «conectados» a los de la anterior). El que sigue en la mesa vuelve a latir.
  const telefonos = tx
    .deleteFrom('dispositivos_mesa')
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', '=', mesaId);
  await (hasta === undefined ? telefonos : telefonos.where('visto_en', '<=', hasta)).execute();
  return Number(borradas.numDeletedRows);
}

/** La cuenta se cerró: lo que quedó en el carrito de su mesa ya no es de nadie. */
export async function olvidarElCarritoDeLaCuenta(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
  ahora: Date,
): Promise<number> {
  const orden = await tx
    .selectFrom('ordenes')
    .select('mesa_id')
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', ordenId)
    .executeTakeFirst();
  if (orden?.mesa_id === null || orden?.mesa_id === undefined) return 0;
  return olvidarElCarritoDeLaMesa(tx, organizacionId, orden.mesa_id, ahora);
}

/** Se cerró la última caja: el día terminó y los carritos de la sucursal (y sus avisos) se van. */
export async function olvidarLosCarritosDeLaSucursal(
  tx: Transaccion,
  organizacionId: string,
  sucursalId: string,
  ahora: Date,
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
  await tx
    .updateTable('solicitudes_qr')
    .set({ estado: 'resuelta', resuelta_en: ahora, updated_at: ahora })
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', 'in', (eb) =>
      eb
        .selectFrom('mesas')
        .select('id')
        .where('organizacion_id', '=', organizacionId)
        .where('sucursal_id', '=', sucursalId),
    )
    .where('tipo', '=', 'ordenar')
    .where('estado', 'in', ['pendiente', 'atendida'])
    .where('notas', 'like', `${PREFIJO_DEL_PEDIDO_LISTO}%`)
    .execute();
  return Number(borradas.numDeletedRows);
}

/**
 * Revisión de DP-13 · Al abrir la cuenta, el carrito que una mesa SIN cuenta dejó hace más de las
 * horas de caducidad no es de la gente nueva: se borra (con su aviso). Lo reciente se queda: es el
 * pedido de quien la está abriendo.
 */
export async function caducarElCarritoAlAbrir(
  tx: Transaccion,
  organizacionId: string,
  mesaId: string,
  ahora: Date,
): Promise<void> {
  const fila = await tx
    .selectFrom('carrito_mesa_lineas')
    .select((eb) => eb.fn.max('created_at').as('ultima'))
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', '=', mesaId)
    .executeTakeFirst();
  const ultima = fila?.ultima ?? null;
  if (carritoCaducado(ultima === null ? null : new Date(ultima), null, ahora)) {
    await olvidarElCarritoDeLaMesa(tx, organizacionId, mesaId, ahora);
  }
}

/**
 * DP-13.3 (DP-D56) · Juntos, los dos carritos no pasan del tope de uno. Al unir mesas (o mudar la
 * cuenta a una mesa cuyo portal ya armaba algo) se sumaban sin límite y el carrito de la principal
 * quedaba por encima de lo que el comensal puede enviar de una vez. Si no caben, no se mueve nada:
 * el comando entero se deshace y se dice qué hacer.
 */
async function exigirQueQuepanJuntos(
  tx: Transaccion,
  organizacionId: string,
  desde: string,
  hacia: string,
): Promise<void> {
  // Las filas y no un `count(*)`: son a lo más dos carritos llenos (120), y así lo lee también
  // la base falsa de las pruebas de unidad.
  const lineas = await tx
    .selectFrom('carrito_mesa_lineas')
    .select('id')
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', 'in', [desde, hacia])
    .execute();
  if (lineas.length > MAXIMO_EN_EL_CARRITO) {
    throw new ErrorDominio(
      'QR_CARRITO_LLENO',
      `Juntos, los pedidos del portal de esas mesas pasarían de ${String(MAXIMO_EN_EL_CARRITO)} cosas: que una de ellas envíe (o vacíe) el suyo primero.`,
    );
  }
}

/**
 * El carrito sigue a la cuenta: las líneas y los teléfonos de `desde` pasan a `hacia`. Un teléfono
 * que ya latía en las dos se queda con su latido más reciente (la llave es mesa + huella).
 *
 * DP-13.3 · Y sus solicitudes pendientes («Pedido listo para confirmar», «Llamar al mesero»…):
 * el QR de `desde` ya cae en `hacia`, y un aviso que se queda en una mesa oculta nadie lo atiende.
 * Una sola pendiente por mesa y tipo (`solicitudes_qr_una_pendiente`): si `hacia` ya tenía una del
 * mismo tipo, la de `desde` se da por resuelta.
 */
export async function moverElCarrito(
  tx: Transaccion,
  organizacionId: string,
  desde: string,
  hacia: string,
  ahora: Date,
): Promise<void> {
  if (desde === hacia) return;
  await exigirQueQuepanJuntos(tx, organizacionId, desde, hacia);
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
  await moverLasSolicitudes(tx, organizacionId, desde, hacia, ahora);
}

async function moverLasSolicitudes(
  tx: Transaccion,
  organizacionId: string,
  desde: string,
  hacia: string,
  ahora: Date,
): Promise<void> {
  await sql`
    update solicitudes_qr s
       set estado = 'resuelta', resuelta_en = ${ahora}
     where s.organizacion_id = ${organizacionId}
       and s.mesa_id = ${desde}
       and s.estado = 'pendiente'
       and exists (
         select 1 from solicitudes_qr p
          where p.organizacion_id = s.organizacion_id
            and p.mesa_id = ${hacia}
            and p.estado = 'pendiente'
            and p.tipo = s.tipo
       )
  `.execute(tx);
  await tx
    .updateTable('solicitudes_qr')
    .set({ mesa_id: hacia })
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', '=', desde)
    .where('estado', '=', 'pendiente')
    .execute();
}

/**
 * EL CANDADO DEL CARRITO DE LA MESA: la fila de `carritos_mesa` con `for update` (y creada si no
 * la hay). Lo toman todos los que cambian el carrito o su aviso —enviar, llamar al mesero, el
 * mesero—, así que dos de ellos nunca se cruzan. Devuelve la ronda.
 */
export async function candadoDelCarrito(
  tx: Transaccion,
  organizacionId: string,
  mesaId: string,
): Promise<number> {
  await tx
    .insertInto('carritos_mesa')
    .values({ organizacion_id: organizacionId, mesa_id: mesaId })
    .onConflict((oc) => oc.columns(['organizacion_id', 'mesa_id']).doNothing())
    .execute();
  const { ronda } = await tx
    .selectFrom('carritos_mesa')
    .select('ronda')
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', '=', mesaId)
    .forUpdate()
    .executeTakeFirstOrThrow();
  return ronda;
}

/**
 * El aviso «Pedido listo para confirmar» de la mesa queda resuelto: el pedido salió o se borró, y
 * ya no espera a nadie. DP-13.2: sólo ESE aviso (su nota lo dice), no los demás `ordenar` de la
 * mesa; los de rondas anteriores ya se resolvieron al enviarse. `empleoId` es `null` cuando lo
 * resuelve el comensal.
 */
export async function resolverElAvisoDelPedido(
  tx: Transaccion,
  organizacionId: string,
  mesaId: string,
  empleoId: string | null,
  ahora: Date,
): Promise<number> {
  const filas = await tx
    .updateTable('solicitudes_qr')
    .set((eb) => ({
      estado: 'resuelta',
      atendida_en: eb.fn.coalesce('atendida_en', eb.val(ahora)),
      resuelta_en: ahora,
      empleado_atiende_id: eb.fn.coalesce('empleado_atiende_id', eb.val(empleoId)),
      updated_at: ahora,
    }))
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', '=', mesaId)
    .where('tipo', '=', 'ordenar')
    .where('estado', 'in', ['pendiente', 'atendida'])
    .where('notas', 'like', `${PREFIJO_DEL_PEDIDO_LISTO}%`)
    .executeTakeFirst();
  return Number(filas.numUpdatedRows);
}

/** DP-13.2 · Si el carrito de la mesa quedó vacío —por quien sea—, su aviso ya no espera a nadie. */
export async function resolverElAvisoSiQuedoVacio(
  tx: Transaccion,
  organizacionId: string,
  mesaId: string,
  empleoId: string | null,
  ahora: Date,
): Promise<void> {
  const queda = await tx
    .selectFrom('carrito_mesa_lineas')
    .select('id')
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_id', '=', mesaId)
    .executeTakeFirst();
  if (queda === undefined)
    await resolverElAvisoDelPedido(tx, organizacionId, mesaId, empleoId, ahora);
}
