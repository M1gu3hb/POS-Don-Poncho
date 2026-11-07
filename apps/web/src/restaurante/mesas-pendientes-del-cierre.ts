/**
 * LAS MESAS QUE BLOQUEAN EL CIERRE DEL DÍA, y cuáles se pueden soltar desde ahí (DP-14.6, medio 9).
 *
 * El diálogo del cierre (`MesasPendientesCierreDialog.jsx`) sólo avisaba y mandaba a otra pantalla.
 * Una mesa EN LIMPIEZA no tiene dinero pendiente —se cobró y sólo falta recogerla— y una mesa que
 * dice estar ocupada sin tener cuenta es una huérfana: las dos se sueltan con `liberar_mesa`, que
 * además se NIEGA si la cuenta tiene consumo sin cobrar. Lo demás (una cuenta por cobrar) se cobra
 * o se cancela en su pantalla, no se «marca libre».
 */

export interface MesaPendienteDelCierre {
  readonly id: string;
  readonly estado?: string | null;
  readonly venta_activa_id?: string | null;
}

/** ¿Se puede «Marcar libre» desde el diálogo? Sin dinero pendiente: limpieza, o sin cuenta. */
export function sePuedeMarcarLibre(mesa: MesaPendienteDelCierre): boolean {
  const estado = mesa.estado ?? 'libre';
  if (estado === 'libre') return false;
  return estado === 'limpieza' || (mesa.venta_activa_id ?? null) === null;
}

/**
 * «Con venta activa» sólo si de verdad hay algo por cobrar: la mesa en limpieza conserva el id de
 * su cuenta ya cobrada (para saber de dónde viene), y decir «venta activa» de ella confunde.
 */
export function tieneVentaPorCobrar(mesa: MesaPendienteDelCierre): boolean {
  return (mesa.estado ?? 'libre') !== 'limpieza' && (mesa.venta_activa_id ?? null) !== null;
}
