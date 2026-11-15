/**
 * LA TINTA Y EL PAPEL DE LA TÉRMICA (DP-20 · refuerzo §1.2).
 *
 * Una impresora térmica sólo tiene dos «colores»: quema o no quema. Estos dos valores no son
 * colores de la interfaz —no cambian con el estilo ni con el modo oscuro—: son el negro puro y el
 * blanco puro con que se dibuja todo lo que va al rollo, y de los que sale la imagen de 1 bit.
 * Viven SÓLO en este archivo (como los del QR impreso, `colores-del-qr.ts`).
 */

/** Lo que se quema. */
export const TINTA = '#000';

/** Lo que no. */
export const PAPEL = '#fff';
