import { invocarComando } from '~/cliente/api';

import type {
  AperturaDeLaMesa,
  EstadoDelCarrito,
  ItemDelCarrito,
  ResultadoDelEnvio,
} from './carrito-de-la-mesa';

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

// Cada llamada escribe su ruta entera (DP-15): con el sufijo armado (`carrito${resto}`) la
// puerta del acople no podía cotejarla con las carpetas de `app/api/publico/qr/[token]/carrito`.
const qr = (token: string): string => encodeURIComponent(token);

/**
 * `null`: este negocio no acepta pedidos desde el teléfono. Sin `dispositivo` (`''`) el servidor le
 * emite uno al teléfono y lo trae en `dispositivoEmitido` (DP-13.3).
 */
export function leerElCarrito(
  token: string,
  dispositivo: string,
): Promise<EstadoDelCarrito | null> {
  return invocarComando<EstadoDelCarrito | null>(
    `/api/publico/qr/${qr(token)}/carrito`,
    dispositivo === '' ? {} : { dispositivo },
  );
}

export function agregarAlCarrito(
  token: string,
  dispositivo: string,
  item: ItemDelCarrito,
): Promise<EstadoDelCarrito> {
  return invocarComando<EstadoDelCarrito>(`/api/publico/qr/${qr(token)}/carrito/agregar`, {
    dispositivo,
    item,
  });
}

export function quitarDelCarrito(
  token: string,
  dispositivo: string,
  lineaId: string,
): Promise<EstadoDelCarrito> {
  return invocarComando<EstadoDelCarrito>(`/api/publico/qr/${qr(token)}/carrito/quitar`, {
    dispositivo,
    lineaId,
  });
}

/**
 * Manda el carrito a cocina. DP-13.3 · Con la mesa cerrada, `apertura` lleva los datos de abrirla: el
 * servidor la abre y manda el pedido en UNA transacción, no en dos llamadas.
 */
export function enviarElCarrito(
  token: string,
  dispositivo: string,
  {
    confirmado,
    notaGeneral,
    apertura,
  }: {
    readonly confirmado: boolean;
    readonly notaGeneral: string;
    readonly apertura?: AperturaDeLaMesa | undefined;
  },
): Promise<ResultadoDelEnvio> {
  return invocarComando<ResultadoDelEnvio>(`/api/publico/qr/${qr(token)}/carrito/enviar`, {
    dispositivo,
    confirmado,
    notaGeneral,
    ...(apertura === undefined ? {} : { apertura }),
  });
}

/** DP-12.2 · «Llamar a mi mesero para confirmar»: una solicitud con «Pedido listo para confirmar». */
export function llamarAlMesero(token: string, dispositivo: string): Promise<ResultadoDelLlamado> {
  return invocarComando<ResultadoDelLlamado>(`/api/publico/qr/${qr(token)}/carrito/llamar`, {
    dispositivo,
  });
}
