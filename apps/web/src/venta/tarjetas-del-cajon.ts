/**
 * LAS DOS TARJETAS DE «MOVIMIENTOS» A LA MISMA ALTURA (DP-22 · hallazgo 26), sin pantalla.
 *
 * «Entregar el turno» (`CorteDeTurno.tsx`) y «Retirar» (`RetiroDeCaja.tsx`) van lado a lado en la
 * Caja de escritorio (`MovimientosDeCaja.tsx`, dos columnas desde `lg`). Sus textos de ayuda miden
 * distinto (tres renglones y dos, según el ancho), así que sus campos empezaban a distinta altura.
 *
 * Se reserva el alto de TRES renglones de ayuda en las dos (`AYUDA_DE_TRES_RENGLONES`: 3 × 1.25 rem de
 * `text-sm`): los encabezados miden lo mismo, los campos empiezan a la misma altura y no se toca ningún
 * texto. Se descartó `grid-rows-subgrid`: el iMin lleva Chromium 99 y el subgrid llega hasta el 117.
 * Los campos también miden lo mismo (`ALTO_DEL_CAMPO`).
 */
export const AYUDA_DE_TRES_RENGLONES = 'min-h-15';

/**
 * El alto de los campos de «Retirar» (`CampoDePesos` y su «A dónde va»: 1.25 × la altura del control).
 * «Entregar el turno» los traía de 1 ×: con las filas alineadas, las cajas seguían terminando a
 * distinta altura (503 contra 515 px en la medición del barrido). Se iguala por el `<input>` de
 * dentro, sin tocar el campo del sistema.
 */
export const ALTO_DEL_CAMPO = 'h-[calc(var(--altura-control)*1.25)]';
/** Lo mismo para el campo de dinero, cuyo `<input>` va dentro de su caja. */
export const ALTO_DEL_CAMPO_DE_DINERO = '[&_input]:h-[calc(var(--altura-control)*1.25)]';
