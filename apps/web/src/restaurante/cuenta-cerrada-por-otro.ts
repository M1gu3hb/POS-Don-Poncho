/**
 * DP-25 · Parte 3 · 3.5 · LA CUENTA QUE OTRO CERRÓ MIENTRAS EL MESERO LA TENÍA ABIERTA.
 *
 * Si otra persona cancela o cobra la cuenta de la mesa que el mesero tiene en pantalla, la ventana
 * seguía abierta sin decir nada y, si mandaba un platillo, el servidor respondía «Esa cuenta ya se
 * cerró». Ahora la pantalla lee el estado de LA CUENTA (no el de la mesa: la mesa cambia también
 * al abrirla o pasarla, y de ahí salían falsas alarmas) y, si ya no está viva, dice qué pasó.
 * Puro: sólo decide el texto y el tono según el estado de la cuenta.
 */

export interface AvisoDeCuentaCerrada {
  readonly tono: 'info' | 'atencion';
  readonly mensaje: string;
}

/** `parcialmente_pagada` sigue abierta en la Caja: no es un cierre. */
const COBRADAS: ReadonlySet<string> = new Set([
  'pagada',
  'reembolsada',
  'parcialmente_reembolsada',
]);

export function avisoDeCuentaCerrada(
  numeroMesa: number | string,
  estadoDeLaCuenta: string | null | undefined,
): AvisoDeCuentaCerrada | null {
  const delaMesa = `La cuenta de la mesa ${String(numeroMesa)}`;
  if (estadoDeLaCuenta === 'cancelada') {
    return { tono: 'atencion', mensaje: `${delaMesa} se canceló.` };
  }
  if (estadoDeLaCuenta === 'dividida') {
    return { tono: 'info', mensaje: `${delaMesa} se dividió en la Caja.` };
  }
  if (
    estadoDeLaCuenta !== null &&
    estadoDeLaCuenta !== undefined &&
    COBRADAS.has(estadoDeLaCuenta)
  ) {
    return { tono: 'info', mensaje: `${delaMesa} ya se cobró.` };
  }
  return null;
}
