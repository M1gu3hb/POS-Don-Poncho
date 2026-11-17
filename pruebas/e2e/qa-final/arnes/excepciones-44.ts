/**
 * LAS EXCEPCIONES AL BLANCO DE 44 PX, POR COMPONENTE.
 *
 * No hay un piso global (DP-D145: el `min-height` global aplastó las tarjetas de platillos del
 * mesero). El blanco de 44 px se exige por componente, y lo que no lo cumple por una razón de
 * verdad se anota AQUÍ, con la razón: un selector CSS (se compara con `closest`) y, si sólo vale
 * en una pantalla, el patrón de su nombre.
 *
 * Una excepción no es un permiso para dejar un botón chico: es lo que ya se discutió y se decidió
 * dejar. Si no hay razón que escribir, es un hallazgo. Las que salgan de una corrida sobre la app
 * van al informe, no se agregan aquí para que la corrida pase.
 */

export interface Excepcion44 {
  /** Un selector CSS: se exime todo lo que lo cumpla o esté dentro de algo que lo cumpla. */
  readonly selector: string;
  /** Sólo en las pantallas cuyo nombre cumple este patrón (sin patrón: en todas). */
  readonly pantalla?: RegExp;
  readonly razon: string;
}

export const EXCEPCIONES_44: readonly Excepcion44[] = [
  {
    selector: '[data-arnes-teclado]',
    razon: 'El teclado en pantalla emulado por el arnés no es de la app.',
  },
  {
    selector: '[data-blanco-extendido]',
    razon: 'Marca explícita de la app: su área de toque la da otro elemento (verificada a mano).',
  },
];

/** Las excepciones que valen en esta pantalla. */
export function excepcionesDe(
  pantalla: string,
  extra: readonly Excepcion44[] = [],
): readonly { readonly selector: string; readonly razon: string }[] {
  return [...EXCEPCIONES_44, ...extra]
    .filter((e) => e.pantalla === undefined || e.pantalla.test(pantalla))
    .map(({ selector, razon }) => ({ selector, razon }));
}
