/**
 * DP-15.1 · LO AGOTADO SE APARTA DEL PEDIDO, y lo demás se envía (el mesero, sin pura pantalla).
 *
 * `restaurante.enviar_pedido` es una sola transacción y, si un platillo se agotó entre que el mesero
 * lo tocó y que lo mandó (la cocina lo marca desde otra pantalla), rechaza TODO con
 * `PRODUCTO_AGOTADO`. Con el pedido de una mesa de ocho eso era volver a armarlo.
 *
 * ── Por qué en la pantalla y no en el servidor ───────────────────────────
 * El error del servidor no dice CUÁLES (`comando()` sólo manda la regla; los nombres se quedan en
 * el mensaje), y cambiarlo tocaría a todos los clientes. La pantalla ya sabe leer el menú con su
 * bandera `agotado_hoy` (la del servidor, no el reloj de la tableta): al recibir el rechazo relee
 * el menú, aparta lo que ahora sale agotado, lo dice, y reintenta con el resto. Si el menú releído
 * no muestra nada agotado, no adivina: deja el error del servidor tal cual.
 */

export interface RenglonDelPedido {
  readonly id: string;
  readonly nombre: string;
  readonly [campo: string]: unknown;
}

export interface PlatilloDelMenu {
  readonly id: string;
  readonly agotado_hoy?: boolean | null;
}

export function apartarAgotados<R extends RenglonDelPedido>(
  carrito: readonly R[],
  menu: readonly PlatilloDelMenu[],
): { readonly quedan: readonly R[]; readonly apartados: readonly string[] } {
  const agotados = new Set(menu.filter((p) => p.agotado_hoy === true).map((p) => p.id));
  const quedan = carrito.filter((renglon) => !agotados.has(renglon.id));
  const apartados = [
    ...new Set(carrito.filter((renglon) => agotados.has(renglon.id)).map((r) => r.nombre)),
  ];
  return { quedan, apartados };
}

export function avisoDeAgotados(nombres: readonly string[]): string {
  if (nombres.length === 1) return `${nombres[0] ?? ''} se agotó, lo quitamos del pedido`;
  const ultimo = nombres.at(-1) ?? '';
  const anteriores = nombres.slice(0, -1).join(', ');
  return `${anteriores} y ${ultimo} se agotaron, los quitamos del pedido`;
}

/** ¿El servidor rechazó el envío porque algo se agotó? Mira la regla, no el texto del mensaje. */
export function esRechazoPorAgotado(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const datos = (error as { datos?: unknown }).datos;
  if (typeof datos !== 'object' || datos === null) return false;
  return (datos as { regla?: unknown }).regla === 'PRODUCTO_AGOTADO';
}
