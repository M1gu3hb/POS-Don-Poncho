import { invocarComando } from '~/cliente/api';

import type { EstadoDelCarrito, ItemDelCarrito, ResultadoDelEnvio } from './carrito-de-la-mesa';

/** Lo que contesta «Llamar a mi mesero para confirmar» (DP-12.2). */
export interface ResultadoDelLlamado {
  readonly solicitudId: string;
  readonly platillos: number;
  readonly yaAvisado: boolean;
}

/**
 * Las llamadas del carrito compartido (DP-9.5). El sondeo deja el latido del teléfono y trae el
 * carrito; agregar, quitar y enviar son comandos del portal, con su idempotencia.
 */

const ruta = (token: string, resto = '') =>
  `/api/publico/qr/${encodeURIComponent(token)}/carrito${resto}`;

/** `null`: este negocio no acepta pedidos desde el teléfono. */
export function leerElCarrito(
  token: string,
  dispositivo: string,
): Promise<EstadoDelCarrito | null> {
  return invocarComando<EstadoDelCarrito | null>(ruta(token), { dispositivo });
}

export function agregarAlCarrito(
  token: string,
  dispositivo: string,
  item: ItemDelCarrito,
): Promise<EstadoDelCarrito> {
  return invocarComando<EstadoDelCarrito>(ruta(token, '/agregar'), { dispositivo, item });
}

export function quitarDelCarrito(
  token: string,
  dispositivo: string,
  lineaId: string,
): Promise<EstadoDelCarrito> {
  return invocarComando<EstadoDelCarrito>(ruta(token, '/quitar'), { dispositivo, lineaId });
}

export function enviarElCarrito(
  token: string,
  dispositivo: string,
  { confirmado, notaGeneral }: { readonly confirmado: boolean; readonly notaGeneral: string },
): Promise<ResultadoDelEnvio> {
  return invocarComando<ResultadoDelEnvio>(ruta(token, '/enviar'), {
    dispositivo,
    confirmado,
    notaGeneral,
  });
}

/** DP-12.2 · «Llamar a mi mesero para confirmar»: una solicitud con «Pedido listo para confirmar». */
export function llamarAlMesero(token: string, dispositivo: string): Promise<ResultadoDelLlamado> {
  return invocarComando<ResultadoDelLlamado>(ruta(token, '/llamar'), { dispositivo });
}
