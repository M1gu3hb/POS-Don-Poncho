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

/** El dedo se alejó demasiado del punto donde bajó (DP-13.4: también lo usa el globo). */
export function seAlejo(desde: { readonly x: number; readonly y: number }, x: number, y: number) {
  return Math.hypot(x - desde.x, y - desde.y) > TOLERANCIA_PX;
}

/** El dedo se movió demasiado: se cancela la pulsación. */
export function seDeslizo(pulsacion: Pulsacion, x: number, y: number): boolean {
  return seAlejo(pulsacion, x, y);
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

/**
 * DP-13.4 · LO QUE ESTÁ DENTRO DE UN GLOBO DE SOLICITUD NO ES LA MESA.
 *
 * En el plano, los globos de una mesa cuelgan DENTRO de su caja (`data-mesa-id`), así que
 * mantener presionado un globo contaba como mantener presionada la mesa y abría su menú en vez de
 * atender la solicitud. Todo lo que cuelga de la pila de globos lleva esta marca y se excluye.
 */
export const SELECTOR_DE_GLOBO = '[data-globo-de-solicitud]';

/** Lo que se pide de un elemento del documento (así se prueba sin navegador). */
export interface ElementoDelMapa {
  closest(selectores: string): ElementoDelMapa | null;
  getAttribute(nombre: string): string | null;
}

/** La mesa de lo que se tocó: la de su caja, y ninguna si lo tocado es un globo (o no es mesa). */
export function mesaDeLaPulsacion(destino: ElementoDelMapa | null): string | null {
  if (destino === null) return null;
  if (destino.closest(SELECTOR_DE_GLOBO) !== null) return null;
  return destino.closest('[data-mesa-id]')?.getAttribute('data-mesa-id') ?? null;
}
