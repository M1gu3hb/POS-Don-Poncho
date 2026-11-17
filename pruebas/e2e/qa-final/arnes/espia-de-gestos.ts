import type { Page } from '@playwright/test';

import { instalarAyudas, type AyudasEnPagina } from './en-pagina.ts';

/**
 * LO QUE UN GESTO DEJA EN LA PÁGINA: texto seleccionado y menú del sistema.
 *
 * Un espía en la página anota cada `contextmenu` en la fase de captura (antes que cualquier
 * oyente de la app, y aunque alguno corte la propagación) y su estado FINAL (`defaultPrevented`)
 * se lee cuando el gesto terminó: el evento es el mismo objeto.
 *
 * Dos cosas que un Chromium en una PC sin dedo no hace solo, y el arnés modela a la vista:
 *  · en Windows, mantener presionado sobre algo ES un clic derecho: se despacha un `contextmenu`
 *    con las coordenadas del dedo si el motor no lo mandó (`origen: 'simulado'`);
 *  · en Android, mantener presionado sobre texto SELECCIONABLE selecciona una palabra: se hace
 *    la selección que haría el sistema si la página lo permite (`user-select` distinto de `none`).
 * Cuando el motor sí las hace, se usa lo que hizo (`nativo`), y no se modela nada encima.
 */

export interface MenuVisto {
  readonly llego: boolean;
  /** `null` si no llegó ningún `contextmenu`. */
  readonly prevenido: boolean | null;
  readonly origen: 'nativo' | 'simulado' | null;
  readonly enCampo: boolean;
  readonly donde: string;
}

export interface SeleccionVista {
  readonly texto: string;
  readonly origen: 'nativa' | 'modelada' | null;
}

export async function armarEspia(page: Page): Promise<void> {
  await instalarAyudas(page);
  await page.evaluate(() => {
    const w = window as unknown as {
      __arnesEspia?: { menus: { ev: MouseEvent; simulado: boolean }[] };
    };
    if (w.__arnesEspia === undefined) {
      const espia = { menus: [] as { ev: MouseEvent; simulado: boolean }[] };
      w.__arnesEspia = espia;
      window.addEventListener(
        'contextmenu',
        (ev) => {
          espia.menus.push({ ev, simulado: !ev.isTrusted });
        },
        true,
      );
    }
    w.__arnesEspia.menus.length = 0;
    window.getSelection()?.removeAllRanges();
  });
}

/** Despacha el `contextmenu` que Windows manda al mantener presionado, si el motor no lo mandó. */
export async function simularMenuDeWindows(
  page: Page,
  punto: { x: number; y: number },
): Promise<boolean> {
  return page.evaluate(({ x, y }) => {
    const w = window as unknown as { __arnesEspia?: { menus: unknown[] } };
    if ((w.__arnesEspia?.menus.length ?? 0) > 0) return false;
    const destino = document.elementFromPoint(x, y) ?? document.body;
    destino.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 2,
        buttons: 2,
        clientX: x,
        clientY: y,
      }),
    );
    return true;
  }, punto);
}

/** Si el motor no seleccionó nada y la página lo permite, la palabra que seleccionaría Android. */
export async function modelarSeleccionDeAndroid(
  page: Page,
  punto: { x: number; y: number },
): Promise<boolean> {
  return page.evaluate(({ x, y }) => {
    const seleccion = window.getSelection();
    if (seleccion === null) return false;
    if (seleccion.toString() !== '') return false;
    const destino = document.elementFromPoint(x, y);
    if (destino === null) return false;
    const lib = (window as unknown as { __arnes: AyudasEnPagina }).__arnes;
    if (lib.enCampoDeTexto(destino)) return false;
    for (let e: Element | null = destino; e !== null; e = e.parentElement) {
      const est = getComputedStyle(e);
      const valor =
        est.userSelect === '' ? est.getPropertyValue('-webkit-user-select') : est.userSelect;
      if (valor === 'none') return false;
      if (valor === 'text' || valor === 'all') break;
    }
    // `caretPositionFromPoint` llegó a Chromium en el 128; los motores del iMin sólo traen el viejo.
    const doc = document as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    };
    const posicion = doc.caretPositionFromPoint?.(x, y) ?? null;
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- el único que hay antes del Chromium 128
    const rango = posicion === null ? document.caretRangeFromPoint(x, y) : document.createRange();
    if (rango === null) return false;
    if (posicion !== null) {
      rango.setStart(posicion.offsetNode, posicion.offset);
      rango.collapse(true);
    }
    seleccion.removeAllRanges();
    seleccion.addRange(rango);
    const modificable = seleccion as Selection & {
      modify?: (alter: string, direction: string, granularity: string) => void;
    };
    modificable.modify?.('move', 'backward', 'word');
    modificable.modify?.('extend', 'forward', 'word');
    return seleccion.toString().trim() !== '';
  }, punto);
}

export async function leerMenu(page: Page): Promise<MenuVisto> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __arnesEspia?: { menus: { ev: MouseEvent; simulado: boolean }[] };
      __arnes: AyudasEnPagina;
    };
    const ultimo = w.__arnesEspia?.menus.at(-1);
    if (ultimo === undefined) {
      return { llego: false, prevenido: null, origen: null, enCampo: false, donde: '' };
    }
    const destino = ultimo.ev.target instanceof Element ? ultimo.ev.target : null;
    return {
      llego: true,
      prevenido: ultimo.ev.defaultPrevented,
      origen: ultimo.simulado ? ('simulado' as const) : ('nativo' as const),
      enCampo: w.__arnes.enCampoDeTexto(destino),
      donde: destino === null ? '' : `${w.__arnes.nombre(destino)} «${w.__arnes.texto(destino)}»`,
    };
  });
}

export async function leerSeleccion(page: Page, modelada: boolean): Promise<SeleccionVista> {
  const texto = await page.evaluate(() => window.getSelection()?.toString().trim() ?? '');
  return { texto, origen: texto === '' ? null : modelada ? 'modelada' : 'nativa' };
}
