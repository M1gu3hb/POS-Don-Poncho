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

/**
 * DP-16 · Antes de mandar el resto, UN toque de confirmación: «Se agotó X. ¿Envío lo demás?».
 * El mesero no manda a la cocina un pedido distinto del que armó sin enterarse.
 */
export function preguntaDeAgotados(nombres: readonly string[]): string {
  if (nombres.length === 1) return `Se agotó ${nombres[0] ?? ''}. ¿Envío lo demás?`;
  const ultimo = nombres.at(-1) ?? '';
  const anteriores = nombres.slice(0, -1).join(', ');
  return `Se agotaron ${anteriores} y ${ultimo}. ¿Envío lo demás?`;
}

/** Lo mínimo que se usa de `toast` de sonner (se sustituye en las pruebas). */
export type ToastConAcciones = (
  mensaje: string,
  opciones: {
    readonly duration: number;
    readonly action: { readonly label: string; readonly onClick: () => void };
    readonly cancel: { readonly label: string; readonly onClick: () => void };
    readonly onDismiss: () => void;
    readonly onAutoClose: () => void;
  },
) => unknown;

/** Pregunta con «Enviar» / «No enviar». Cerrar el aviso sin elegir cuenta como NO enviar. */
export function confirmarEnvio(toast: ToastConAcciones, pregunta: string): Promise<boolean> {
  return new Promise((resolver) => {
    toast(pregunta, {
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: 'Enviar',
        onClick: () => {
          resolver(true);
        },
      },
      cancel: {
        label: 'No enviar',
        onClick: () => {
          resolver(false);
        },
      },
      onDismiss: () => {
        resolver(false);
      },
      onAutoClose: () => {
        resolver(false);
      },
    });
  });
}
