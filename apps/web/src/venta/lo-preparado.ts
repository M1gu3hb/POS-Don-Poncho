/**
 * LA REGLA DE LO PREPARADO, EN LAS PALABRAS DE LA PANTALLA (DP-22).
 *
 * Lo que la cocina ya preparó no vuelve al anaquel: al cancelar la cuenta sale del almacén como
 * merma «Por cancelación» (DP-D57) y al devolver una venta cobrada no se repone (sólo lo que se
 * vende tal cual, por pieza, regresa). Lo que no se preparó nunca salió: el almacén baja al cobrar.
 * Una sola frase para las pantallas de cancelar y de devolver.
 */
export const LO_PREPARADO_NO_REGRESA = 'Lo que ya se preparó no regresa al inventario.';
