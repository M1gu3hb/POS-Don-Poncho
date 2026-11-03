/**
 * «VER QR DE LA MESA» EN LA PANTALLA (DP-12.2, DP-13.4) · lo puro.
 *
 * El QR grande en la pantalla de la estación es para escanearlo con el teléfono del mesero; no
 * debe quedarse ahí cuando el mesero se va: si nadie lo cierra, se cierra solo al minuto. Y su
 * título dice SIEMPRE de qué mesa es, también mientras el diálogo se cierra.
 */

/** Cuánto se queda el QR en la pantalla si nadie lo cierra. */
export const MS_DEL_QR_EN_PANTALLA = 60_000;

/**
 * Cierra solo, pasado el tiempo. Devuelve cómo cancelarlo (al cerrarlo a mano o al desmontarse),
 * para que un cierre tardío no apague el QR de otra mesa abierta después.
 */
export function programarCierre(
  alCerrar: () => void,
  ms: number = MS_DEL_QR_EN_PANTALLA,
): () => void {
  const reloj = setTimeout(alCerrar, ms);
  return () => {
    clearTimeout(reloj);
  };
}

/** «QR de la mesa 5»; sin un número que decir, «QR de la mesa» (nunca «… undefined» ni un hueco). */
export function tituloDelQr(mesa: { readonly numero: number } | null): string {
  return mesa !== null && Number.isFinite(mesa.numero)
    ? `QR de la mesa ${String(mesa.numero)}`
    : 'QR de la mesa';
}
