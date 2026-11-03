import 'server-only';

import { createHash } from 'node:crypto';

import { ErrorDominio, veConsolidado, type Ambito } from '@morphiqpos/contracts';
import { conTransaccion, type Transaccion } from '@morphiqpos/data';

import { banderasDe } from '../portal/banderas.ts';
import { aperturaDeLaCuenta, estadoDelCarrito, type EstadoDelCarrito } from '../portal/carrito.ts';
import { leerContextoDelNegocio } from '../portal/negocio.ts';

/**
 * EL CARRITO DEL PORTAL EN MODO MESERO (DP-12.2) · la lectura.
 *
 * El mesero llega a la mesa de dos formas: escanea el QR (desde «Mesas y pedidos», con su cámara)
 * o la abre en su pantalla. Las dos terminan aquí, DENTRO de su sesión: el rol y la sucursal salen
 * del ámbito del servidor, nunca de la petición, y un comensal no tiene cómo hacerse pasar por él
 * (las rutas públicas del portal no aceptan nada parecido).
 *
 * El QR se resuelve contra las mesas del negocio de la sesión. Si es de una mesa unida, lo que se
 * enseña es el carrito de la principal, como en el portal. Una mesa de otra sucursal no existe
 * para quien no ve lo consolidado (`veConsolidado`): mismo 404 que una que no existe.
 */

/** Lo que la pantalla del mesero sabe de la mesa del carrito. */
export interface MesaDelCarritoDelMesero {
  readonly id: string;
  readonly numero: number;
  readonly nombre: string | null;
  readonly estado: string;
  /** La cuenta viva de la mesa, si la hay: «Confirmar y enviar» la necesita. */
  readonly ordenId: string | null;
  /** DP-13.3 · Esa cuenta ya se pidió (`cuenta_solicitada`): para enviar hay que reabrirla. */
  readonly cuentaPedida: boolean;
  readonly sucursalId: string;
}

export interface CarritoParaElMesero {
  readonly mesa: MesaDelCarritoDelMesero;
  readonly carrito: EstadoDelCarrito;
}

/** La huella con la que el personal firma la ronda (`carritos_mesa`): 64 hex, nunca un teléfono. */
export function huellaDelPersonal(empleoId: string): string {
  return createHash('sha256').update(`personal:${empleoId}`, 'utf8').digest('hex');
}

const ESTADOS_DE_CUENTA_VIVA = [
  'borrador',
  'confirmada',
  'en_preparacion',
  'lista',
  'cuenta_solicitada',
] as const;

/**
 * La mesa del carrito, por id o por el token de su QR, ya resuelta a su principal y comprobada
 * contra el negocio y la sucursal de la sesión.
 */
export async function mesaDelCarritoParaElMesero(
  tx: Transaccion,
  ambito: Ambito,
  buscada: { readonly mesaId?: string; readonly qr?: string },
): Promise<MesaDelCarritoDelMesero> {
  let consulta = tx
    .selectFrom('mesas')
    .select(['id', 'unida_a_mesa_id'])
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('activa', '=', true);
  if (buscada.mesaId !== undefined) consulta = consulta.where('id', '=', buscada.mesaId);
  else if (buscada.qr !== undefined) consulta = consulta.where('qr_token', '=', buscada.qr);
  else throw new ErrorDominio('PUENTE_NO_ENCONTRADO', 'Falta la mesa.');
  const encontrada = await consulta.executeTakeFirst();
  const id = encontrada?.unida_a_mesa_id ?? encontrada?.id;

  const mesa =
    id === undefined
      ? undefined
      : await tx
          .selectFrom('mesas')
          .select(['id', 'numero', 'nombre', 'estado', 'orden_activa_id', 'sucursal_id'])
          .where('organizacion_id', '=', ambito.organizacionId)
          .where('id', '=', id)
          .executeTakeFirst();
  // DP-13.4 · Sin sucursal en la sesión, sólo quien consolida (dueño, administrador) ve todas; a
  // cualquier otro, falla cerrado: antes un mesero sin sucursal leía las mesas de todas.
  const deOtraSucursal =
    mesa !== undefined &&
    !veConsolidado(ambito.rol) &&
    (ambito.sucursalId === null || mesa.sucursal_id !== ambito.sucursalId);
  if (mesa === undefined || deOtraSucursal) {
    throw new ErrorDominio(
      'PUENTE_NO_ENCONTRADO',
      'Ese código no es de una mesa de este negocio, o la mesa ya no existe.',
    );
  }
  const viva = await tx
    .selectFrom('ordenes')
    .select(['id', 'estado'])
    .where('organizacion_id', '=', ambito.organizacionId)
    .where('mesa_id', '=', mesa.id)
    .where('estado', 'in', [...ESTADOS_DE_CUENTA_VIVA])
    .executeTakeFirst();
  return {
    id: mesa.id,
    numero: mesa.numero,
    nombre: mesa.nombre,
    estado: mesa.estado,
    ordenId: viva?.id ?? null,
    cuentaPedida: viva?.estado === 'cuenta_solicitada',
    sucursalId: mesa.sucursal_id,
  };
}

/** El carrito de la mesa como lo ve el personal: todas las líneas, con sus precios. */
export async function estadoDelCarritoParaElMesero(
  tx: Transaccion,
  ambito: Ambito,
  mesa: MesaDelCarritoDelMesero,
  ahora: Date,
): Promise<EstadoDelCarrito> {
  const negocio = await leerContextoDelNegocio(tx, ambito.organizacionId);
  const banderas = banderasDe(negocio?.valores);
  const delCarrito = {
    organizacionId: ambito.organizacionId,
    mesaId: mesa.id,
    empleadoAsignadoId: null,
  };
  return estadoDelCarrito(tx, delCarrito, huellaDelPersonal(ambito.empleoId), {
    desde: await aperturaDeLaCuenta(tx, delCarrito),
    ahora,
    // El mesero ve los precios aunque el portal no los enseñe: va a confirmar lo que se cobra.
    banderas: { ...banderas, mostrarPrecios: true },
  });
}

/** `GET /api/restaurante/carrito-de-la-mesa`: la mesa y su carrito, en una lectura. */
export async function leerElCarritoParaElMesero(
  ambito: Ambito,
  buscada: { readonly mesaId?: string; readonly qr?: string },
): Promise<CarritoParaElMesero> {
  return conTransaccion(async (tx) => {
    const mesa = await mesaDelCarritoParaElMesero(tx, ambito, buscada);
    return { mesa, carrito: await estadoDelCarritoParaElMesero(tx, ambito, mesa, new Date()) };
  });
}

/**
 * `GET /api/restaurante/qr-de-la-mesa` · «Ver QR de la mesa» (DP-12.2): la pantalla de la estación
 * se vuelve el QR de la mesa para escanearlo con el teléfono del mesero sin ir a la mesa física.
 * El token es el del QR pegado en la mesa: cualquiera sentado ahí lo tiene, y el personal también.
 */
export async function qrDeLaMesaParaElPersonal(
  ambito: Ambito,
  mesaId: string,
): Promise<{ readonly mesaId: string; readonly numero: number; readonly token: string | null }> {
  return conTransaccion(async (tx) => {
    const mesa = await mesaDelCarritoParaElMesero(tx, ambito, { mesaId });
    const fila = await tx
      .selectFrom('mesas')
      .select('qr_token')
      .where('organizacion_id', '=', ambito.organizacionId)
      .where('id', '=', mesa.id)
      .executeTakeFirst();
    return { mesaId: mesa.id, numero: mesa.numero, token: fila?.qr_token ?? null };
  });
}
