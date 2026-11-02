/**
 * MANTENER PRESIONADA UNA MESA (DP-12.2) · la decisión, pura.
 *
 * En tableta y teléfono, dejar el dedo sobre una mesa abre su globo («Ver mesa», «Ver QR de la
 * mesa»); con ratón, también el clic derecho. Un toque normal sigue abriendo la mesa como hoy, y
 * arrastrar el dedo (desplazarse por la página) no es mantener presionado.
 */

/** Lo que tarda en contar como «mantener»: lo de iOS y Android, sin sentirse lento. */
export const MS_PARA_MANTENER = 500;
/** Más que esto de movimiento y era un deslizamiento, no una pulsación. */
export const TOLERANCIA_PX = 10;

export interface Pulsacion {
  readonly mesaId: string;
  readonly x: number;
  readonly y: number;
  readonly inicio: number;
}

/** El dedo se movió demasiado: se cancela la pulsación. */
export function seDeslizo(pulsacion: Pulsacion, x: number, y: number): boolean {
  return Math.hypot(x - pulsacion.x, y - pulsacion.y) > TOLERANCIA_PX;
}

/** Ya pasó el tiempo para contar como mantener presionada. */
export function seMantuvo(pulsacion: Pulsacion, ahora: number): boolean {
  return ahora - pulsacion.inicio >= MS_PARA_MANTENER;
}

/** Dónde dibujar el globo: junto al dedo, sin salirse de la pantalla. */
export function lugarDelGlobo(
  x: number,
  y: number,
  pantalla: { readonly ancho: number; readonly alto: number },
  globo: { readonly ancho: number; readonly alto: number },
): { readonly left: number; readonly top: number } {
  const margen = 8;
  const left = Math.min(
    Math.max(margen, x - globo.ancho / 2),
    pantalla.ancho - globo.ancho - margen,
  );
  const arriba = y - globo.alto - 16;
  const top = arriba >= margen ? arriba : Math.min(y + 16, pantalla.alto - globo.alto - margen);
  return { left, top };
}
