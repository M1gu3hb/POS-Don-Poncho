/**
 * QUIÉN MANDA A COCINA (DP-12.2).
 *
 * En el portal pide mucha gente a la vez y algo van a hacer mal: por omisión los comensales ARMAN
 * el carrito de su mesa (aunque esté cerrada) y el MESERO lo confirma y lo envía. El negocio puede
 * elegir que también los comensales envíen y, aparte, si pueden abrir su mesa al enviar. Los dos
 * interruptores viven en `configuracion.valores` y los lee el servidor (`banderas.ts`).
 *
 * Aquí, puro: qué botón y qué texto le tocan al comensal, y la nota del aviso que recibe el mesero.
 * El envío lo vuelve a decidir el servidor con estas mismas funciones (`carrito-comandos.ts`).
 */

/** `portal_qr_envia_a_cocina`: sólo el mesero (por omisión) o también los comensales. */
export const QUIEN_ENVIA = ['mesero', 'comensales'] as const;
export type QuienEnvia = (typeof QUIEN_ENVIA)[number];

/**
 * Lo que puede hacer el comensal con el carrito armado:
 *   · `llamar_mesero`: «Llamar a mi mesero para confirmar» (sólo el mesero envía);
 *   · `enviar`: la mesa está abierta y los comensales envían;
 *   · `abrir_y_enviar`: la mesa está cerrada y los comensales pueden abrirla al enviar;
 *   · `pedir_que_atiendan`: los comensales envían, pero la mesa está cerrada y no la pueden abrir:
 *     «Pide a tu mesero que te atienda para enviar tu pedido», con el mismo botón de llamarlo.
 *   · `cuenta_pedida` (DP-13.3): la cuenta ya se pidió. Nadie manda a cocina desde el teléfono: es un
 *     estado, no un error. «Tu cuenta ya se pidió: tu mesero lo revisa», con el botón de llamarlo.
 */
export type ComoSeEnvia =
  'llamar_mesero' | 'enviar' | 'abrir_y_enviar' | 'pedir_que_atiendan' | 'cuenta_pedida';

export interface ReglasDelEnvio {
  readonly quienEnvia: QuienEnvia;
  readonly comensalesAbrenMesa: boolean;
}

export function comoSeEnvia(
  reglas: ReglasDelEnvio,
  mesa: {
    readonly cuentaAbierta: boolean;
    /** Con la asignación encendida, una mesa sin mesero no se abre desde el QR (DP-9.2). */
    readonly faltaMesero: boolean;
    /** DP-13.3 · La cuenta ya está en `cuenta_solicitada`: manda sobre cualquier otra regla. */
    readonly cuentaPedida: boolean;
  },
): ComoSeEnvia {
  if (mesa.cuentaPedida) return 'cuenta_pedida';
  if (reglas.quienEnvia === 'mesero') return 'llamar_mesero';
  if (mesa.cuentaAbierta) return 'enviar';
  return reglas.comensalesAbrenMesa && !mesa.faltaMesero ? 'abrir_y_enviar' : 'pedir_que_atiendan';
}

/** El comensal puede mandar a cocina él mismo (con o sin abrir la mesa). */
export function comensalEnvia(como: ComoSeEnvia): boolean {
  return como === 'enviar' || como === 'abrir_y_enviar';
}

/**
 * Cuántos platillos lleva el carrito para la nota del aviso: las cantidades enteras cuentan cada
 * pieza (dos tacos son dos); lo que va por peso o en fracción cuenta como uno (medio kilo de
 * barbacoa es un platillo, no 0.5).
 */
export function platillosDelCarrito(cantidades: readonly string[]): number {
  return cantidades.reduce((suma, cantidad) => {
    const n = Number(cantidad);
    return suma + (Number.isInteger(n) && n > 0 ? n : 1);
  }, 0);
}

/**
 * Cómo empieza la nota del aviso del carrito. DP-13.2: es lo que distingue ESTE aviso de los demás
 * `ordenar` de la mesa (un «Quiero ordenar» del botón de atención), sin una columna nueva.
 */
export const PREFIJO_DEL_PEDIDO_LISTO = 'Pedido listo para confirmar';

/** La nota de la solicitud `ordenar` que ve el mesero: «Pedido listo para confirmar (3 platillos)». */
export function notaDelPedidoListo(platillos: number): string {
  return `${PREFIJO_DEL_PEDIDO_LISTO} (${String(platillos)} ${platillos === 1 ? 'platillo' : 'platillos'})`;
}

/** ¿Es el aviso del carrito? */
export function esAvisoDelPedido(notas: string | null | undefined): boolean {
  return (notas ?? '').startsWith(PREFIJO_DEL_PEDIDO_LISTO);
}
