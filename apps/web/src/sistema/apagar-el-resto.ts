/**
 * DP-17 (QA de DP-16, D-H-09) · UNA VENTANA HECHA A MANO, MODAL PARA EL LECTOR DE PANTALLA.
 *
 * Deja `inert` todo lo que está junto a la capa de la ventana (ni foco, ni lector, ni clic) y
 * devuelve con qué volver a como estaba. Lo que ya estaba `inert` por otra razón no se toca al
 * volver. Las ventanas del sistema (Radix) ya lo hacen solas; esto es para las heredadas.
 *
 * DP-20.1 · EN UN MOTOR VIEJO. `inert` existe desde Chromium 102. Antes de eso, `nodo.inert = true`
 * es una propiedad cualquiera de JavaScript: no apaga nada y la ficha deja de ser modal sin que
 * nadie se entere. Ahí se consigue lo que se puede sin él: el lector no lee lo de atrás
 * (`aria-hidden`) y el dedo no lo toca (el atributo `inert`, que `app/globals.css` convierte en
 * `pointer-events: none` sólo en esos motores). Al cerrar, cada cosa vuelve a como estaba.
 */

/** Lo que hace falta de un nodo. En el navegador es un elemento; en la prueba, un objeto. */
export interface Apagable {
  inert: boolean;
  getAttribute?: (nombre: string) => string | null;
  setAttribute?: (nombre: string, valor: string) => void;
  removeAttribute?: (nombre: string) => void;
}

/** ¿Este motor conoce `inert`? Se le pregunta al propio nodo, no al nombre del navegador. */
const conoceInert = (nodo: object): boolean => 'inert' in nodo;

function apagarSinInert<T extends Apagable>(capa: T, hermanos: readonly T[]): () => void {
  const apagados = hermanos.filter((h) => h !== capa && h.getAttribute?.('inert') == null);
  const antes = apagados.map((h) => h.getAttribute?.('aria-hidden') ?? null);
  for (const h of apagados) {
    h.setAttribute?.('inert', '');
    h.setAttribute?.('aria-hidden', 'true');
  }
  return () => {
    apagados.forEach((h, i) => {
      h.removeAttribute?.('inert');
      const previo = antes[i] ?? null;
      if (previo === null) h.removeAttribute?.('aria-hidden');
      else h.setAttribute?.('aria-hidden', previo);
    });
  };
}

export function apagarElResto<T extends Apagable>(capa: T, hermanos: readonly T[]): () => void {
  if (!conoceInert(capa)) return apagarSinInert(capa, hermanos);
  const apagados = hermanos.filter((h) => h !== capa && !h.inert);
  for (const h of apagados) h.inert = true;
  return () => {
    for (const h of apagados) h.inert = false;
  };
}
