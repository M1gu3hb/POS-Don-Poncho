import type { Page } from '@playwright/test';

/**
 * LAS AYUDAS QUE CORREN DENTRO DE LA PÁGINA.
 *
 * Lo que se pasa a `page.evaluate` se serializa: no puede usar nada del módulo. Así que las
 * ayudas comunes (nombre legible, visibilidad, recorte, campo de texto) se instalan UNA vez por
 * documento en `window.__arnes` y cada medición las toma de ahí. Se reinstalan en cada revisión:
 * una navegación borra la página, y esto es barato.
 */

export interface AyudasEnPagina {
  /** `button#id «texto»`: un selector que una persona reconoce. */
  nombre(e: Element): string;
  texto(e: Element): string;
  /** La caja del elemento si se ve (no oculto, no recortado, dentro de la ventana); si no, `null`. */
  visible(e: Element): DOMRect | null;
  /** ¿Lo recorta un contenedor? (su centro cae fuera de la caja de un ancestro que recorta). */
  recortada(e: Element): boolean;
  /** Donde el menú del sistema se queda: lo que se teclea se copia, se corta y se pega. */
  enCampoDeTexto(e: Element | null): boolean;
  /** La raíz que se mide: el diálogo abierto si lo hay (lo de atrás está tapado a propósito). */
  raiz(): ParentNode;
}

export const SELECTOR_DE_CAMPO_DE_TEXTO =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="hidden"]), textarea, [contenteditable]:not([contenteditable="false"])';

const construirAyudas = (selectorDeCampo: string): void => {
  const texto = (e: Element): string =>
    (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const nombre = (e: Element): string => {
    const rol = e.getAttribute('role');
    const id = e.id !== '' ? `#${e.id}` : '';
    return `${e.tagName.toLowerCase()}${rol === null ? '' : `[${rol}]`}${id}`;
  };
  const recortada = (e: Element): boolean => {
    const c = e.getBoundingClientRect();
    const [x, y] = [c.left + c.width / 2, c.top + c.height / 2];
    for (let p = e.parentElement; p !== null && p !== document.body; p = p.parentElement) {
      const est = getComputedStyle(p);
      if (est.overflowX === 'visible' && est.overflowY === 'visible') continue;
      const pc = p.getBoundingClientRect();
      if (x < pc.left || x > pc.right || y < pc.top || y > pc.bottom) return true;
    }
    return false;
  };
  const visible = (e: Element): DOMRect | null => {
    const est = getComputedStyle(e);
    if (est.visibility === 'hidden' || est.display === 'none' || Number(est.opacity) === 0) {
      return null;
    }
    const c = e.getBoundingClientRect();
    if (c.width < 1 || c.height < 1) return null;
    if (c.bottom < 0 || c.right < 0 || c.top > innerHeight || c.left > innerWidth) return null;
    if (e.closest('[aria-hidden="true"], [inert]') !== null) return null;
    return recortada(e) ? null : c;
  };
  const enCampoDeTexto = (e: Element | null): boolean => e?.closest(selectorDeCampo) != null;
  const raiz = (): ParentNode => {
    const abiertos = Array.from(
      document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"]'),
    ).filter((d) => {
      const c = d.getBoundingClientRect();
      return c.width > 0 && c.height > 0 && getComputedStyle(d).visibility !== 'hidden';
    });
    // El último abierto es el de encima.
    return abiertos.at(-1) ?? document.body;
  };
  Object.defineProperty(window, '__arnes', {
    value: { nombre, texto, visible, recortada, enCampoDeTexto, raiz },
    configurable: true,
    enumerable: false,
  });
};

export async function instalarAyudas(page: Page): Promise<void> {
  await page.evaluate(construirAyudas, SELECTOR_DE_CAMPO_DE_TEXTO);
}
