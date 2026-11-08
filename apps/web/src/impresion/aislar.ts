/**
 * IMPRIMIR SÓLO EL DOCUMENTO, DESDE ARRIBA DE LA HOJA (DP-15 · F2, auditoría 2 M7).
 *
 * El ticket vive dentro de un diálogo (`position: fixed; transform`) y el CSS de impresión sólo lo
 * ESCONDÍA todo lo demás con `visibility: hidden`: lo escondido sigue ocupando lugar, así que la
 * página de la app ocupaba hojas enteras ANTES del ticket (hojas en blanco) y el ticket,
 * `position: absolute`, quedaba a 434 px del borde de su diálogo.
 *
 * Aquí se marca lo que hay que quitar del flujo (`display: none`): todo hermano de la ruta que
 * lleva del documento al `body`; y la ruta misma se marca para que el CSS le quite posición,
 * transformación y recortes. Se deshace entero al terminar.
 */

export const MARCA_SIN_IMPRIMIR = 'data-sin-imprimir';
export const MARCA_DE_LA_RUTA = 'data-ruta-impresion';
export const MARCA_DEL_OBJETIVO = 'data-objetivo-impresion';

const NO_ESTORBAN = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'NOSCRIPT']);

/** Aísla `objetivo` para imprimirlo. Devuelve la función que lo deshace. */
export function aislarParaImprimir(doc: Document, objetivo: Element): () => void {
  const tocados: { readonly el: Element; readonly marca: string }[] = [];
  const marcar = (el: Element, marca: string): void => {
    el.setAttribute(marca, '');
    tocados.push({ el, marca });
  };

  marcar(objetivo, MARCA_DEL_OBJETIVO);
  let actual: Element = objetivo;
  while (actual.parentElement !== null && actual !== doc.body) {
    const padre: Element = actual.parentElement;
    for (const hermano of Array.from(padre.children)) {
      if (hermano !== actual && !NO_ESTORBAN.has(hermano.tagName)) {
        marcar(hermano, MARCA_SIN_IMPRIMIR);
      }
    }
    if (padre !== doc.body && padre !== doc.documentElement) marcar(padre, MARCA_DE_LA_RUTA);
    actual = padre;
  }

  return () => {
    for (const { el, marca } of tocados) el.removeAttribute(marca);
  };
}

/** El primer documento de impresión VISIBLE que casa con el selector (no las copias ocultas). */
export function documentoAImprimir(doc: Document, selector: string): Element | null {
  const candidatos = Array.from(doc.querySelectorAll(selector));
  return (
    candidatos.find((el) => el.closest('[aria-hidden="true"]') === null) ?? candidatos[0] ?? null
  );
}
