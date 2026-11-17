/**
 * DP-D157 · EL TELÉFONO OPCIONAL DEL PEDIDO PARA LLEVAR.
 *
 * La cajera lo teclea junto al nombre para poder llamar al cliente cuando el pedido está listo.
 * No es el teléfono de un cliente identificado (`clientes.telefono`, con ficha y lealtad): es una
 * etiqueta del pedido, igual que `nombre_pedido`, y por eso vive en la orden y no en el padrón.
 *
 * ── Qué se acepta ───────────────────────────────────────────────────────────
 * Dígitos, espacios, guiones y un «+» al INICIO (la lada internacional). De 7 a 15 dígitos —15 es el
 * máximo de E.164— y no más de 20 caracteres en total. Nada de paréntesis ni puntos: sólo lo que un
 * teléfono lleva de verdad, para que lo que llega a la base sea lo que se puede marcar.
 *
 * Es la ÚNICA definición: el servidor la aplica a lo que llega (R9: nunca se confía en el cliente) y
 * la pantalla la usa para avisar antes de enviar. La migración 194 repite el mismo contorno en un
 * `check` como última red.
 */

export const DIGITOS_MINIMOS_DEL_TELEFONO = 7;
export const DIGITOS_MAXIMOS_DEL_TELEFONO = 15;
export const LARGO_MAXIMO_DEL_TELEFONO = 20;

const SOLO_LO_DE_UN_TELEFONO = /^\+?[0-9][0-9 -]*$/;

export type TelefonoDelPedido =
  | {
      readonly ok: true;
      /** El teléfono ya limpio, o `null` si no se capturó. */
      readonly telefono: string | null;
    }
  | { readonly ok: false; readonly motivo: string };

/**
 * Limpia y valida lo que se capturó. Sin nada (o sólo espacios) es «sin teléfono», que es válido:
 * el dato es opcional.
 */
export function normalizarTelefonoDelPedido(crudo: string | null | undefined): TelefonoDelPedido {
  const limpio = (crudo ?? '').trim().replace(/\s+/g, ' ');
  if (limpio === '') return { ok: true, telefono: null };

  if (limpio.length > LARGO_MAXIMO_DEL_TELEFONO) {
    return {
      ok: false,
      motivo: `El teléfono es muy largo: hasta ${String(LARGO_MAXIMO_DEL_TELEFONO)} caracteres.`,
    };
  }
  if (!SOLO_LO_DE_UN_TELEFONO.test(limpio)) {
    return {
      ok: false,
      motivo: 'El teléfono sólo lleva números, espacios, guiones y un + al inicio.',
    };
  }
  const digitos = limpio.replace(/[^0-9]/g, '').length;
  if (digitos < DIGITOS_MINIMOS_DEL_TELEFONO || digitos > DIGITOS_MAXIMOS_DEL_TELEFONO) {
    return {
      ok: false,
      motivo: `El teléfono debe tener de ${String(DIGITOS_MINIMOS_DEL_TELEFONO)} a ${String(DIGITOS_MAXIMOS_DEL_TELEFONO)} dígitos.`,
    };
  }
  return { ok: true, telefono: limpio };
}
