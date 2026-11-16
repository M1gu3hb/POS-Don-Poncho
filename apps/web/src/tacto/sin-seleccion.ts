/**
 * LA PULSACIÓN LARGA NO SELECCIONA NADA (DP-21 · Bloque 9 · M4).
 *
 * En un aparato táctil, dejar el dedo sobre una mesa seleccionaba el texto de su botón y sacaba el
 * «copiar, seleccionar todo» del sistema, que tapaba los botones. Son dos cosas, y van aquí juntas:
 *
 *  · el CSS (`sin-seleccion.css`) quita la selección y el menú táctil de todo el POS, menos los
 *    campos de texto; se prende con la marca `data-pos-tactil` del `<html>`, que sólo existe
 *    mientras el armazón del POS está montado, así que el portal del comensal queda fuera;
 *  · un único oyente de `contextmenu` cancela el menú nativo en todo el POS, menos en los campos
 *    de texto (ahí «pegar» sí hace falta).
 *
 * Sin DOM a la vista (el `Document` entra por parámetro, con sólo lo que se usa) para probarlo
 * con objetos planos.
 */

/** La marca del `<html>` que enciende las reglas de `sin-seleccion.css`. */
export const ATRIBUTO_DEL_POS = 'data-pos-tactil';

/** Donde el menú del sistema se queda: lo que se teclea se copia, se corta y se pega. */
const CAMPOS_DE_TEXTO = 'input, textarea, [contenteditable]:not([contenteditable="false"])';

interface ConClosest {
  closest(selector: string): unknown;
}

const tieneClosest = (destino: unknown): destino is ConClosest =>
  typeof destino === 'object' &&
  destino !== null &&
  typeof (destino as { closest?: unknown }).closest === 'function';

/** ¿El clic derecho / la pulsación larga cayó en un campo de texto (o dentro de uno editable)? */
export function elMenuNativoSeQueda(destino: EventTarget | null): boolean {
  return tieneClosest(destino) && destino.closest(CAMPOS_DE_TEXTO) !== null;
}

/** Lo único que se usa del documento. */
export interface DocumentoDelPos {
  addEventListener(tipo: 'contextmenu', oyente: (e: Event) => void): void;
  removeEventListener(tipo: 'contextmenu', oyente: (e: Event) => void): void;
  readonly documentElement: {
    setAttribute(nombre: string, valor: string): void;
    removeAttribute(nombre: string): void;
  };
}

/**
 * Monta el oyente único y la marca del POS. Devuelve cómo desmontarlos. El oyente NO detiene la
 * propagación: el mapa de mesas escucha el clic derecho de un ratón (`usePulsacionLarga`) para abrir
 * su globo, y eso sigue funcionando.
 */
export function montarSinMenuNativo(documento: DocumentoDelPos): () => void {
  const alAbrirseElMenu = (e: Event): void => {
    if (!elMenuNativoSeQueda(e.target)) e.preventDefault();
  };
  documento.documentElement.setAttribute(ATRIBUTO_DEL_POS, '');
  documento.addEventListener('contextmenu', alAbrirseElMenu);
  return () => {
    documento.removeEventListener('contextmenu', alAbrirseElMenu);
    documento.documentElement.removeAttribute(ATRIBUTO_DEL_POS);
  };
}
