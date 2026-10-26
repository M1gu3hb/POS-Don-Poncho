/**
 * EL LOGO DE LA CASA · La Tradicional Barbacoa de Don Poncho (DP-3).
 *
 * Es el que entregó Miguel (`logo-don-poncho.svg`), en dos formas dentro de
 * `apps/web/public/marca/`:
 *   · `don-poncho.svg` — el vector, para la pantalla: acceso, barra lateral y portal QR.
 *   · `don-poncho.png` — 600 px, para lo que se imprime o se vuelve PDF (ticket, corte):
 *     html2canvas pinta un PNG igual en todos los navegadores; un SVG, no siempre.
 *
 * Son el logo POR OMISIÓN: si el negocio sube otro desde Configuración, ése manda. Una ruta
 * que empieza por `/` se sirve desde `apps/web/public`, que la CSP permite (`img-src 'self'`).
 */
export const RUTA_DEL_LOGO = '/marca/don-poncho.svg';

/** El mismo logo en PNG, para el ticket y los PDF. */
export const RUTA_DEL_LOGO_IMPRIMIBLE = '/marca/don-poncho.png';

/** El logo por omisión como lo espera la configuración heredada. */
export const LOGO_POR_OMISION: string = RUTA_DEL_LOGO;
