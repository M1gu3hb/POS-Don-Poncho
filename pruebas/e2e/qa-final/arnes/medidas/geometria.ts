import type { Page } from '@playwright/test';

import type { AyudasEnPagina } from '../en-pagina.ts';
import type { Hallazgo, Informativo } from '../tipos.ts';

/**
 * DESBORDE DE LA PÁGINA Y TEXTO CORTADO.
 *
 *  · `desborde` — la página se desplaza a lo ancho (`scrollWidth > clientWidth`): lo dicen los
 *    elementos que se salen por la derecha o la izquierda, no sólo el total;
 *  · `texto-cortado` — un contenedor que RECORTA (`overflow` hidden o clip) y con texto que se sale de
 *    su caja, medido con los rectángulos del propio texto. La elipsis intencional (`text-overflow:
 *    ellipsis` o `-webkit-line-clamp`) no es falla: sale aparte, como informativo.
 */

export interface MedidaDeGeometria {
  readonly hallazgos: Hallazgo[];
  readonly informativos: Informativo[];
}

export async function medirGeometria(page: Page): Promise<MedidaDeGeometria> {
  return page.evaluate(() => {
    const lib = (window as unknown as { __arnes: AyudasEnPagina }).__arnes;
    const hallazgos: Hallazgo[] = [];
    const informativos: Informativo[] = [];
    const raiz = lib.raiz();
    const de = document.documentElement;

    if (de.scrollWidth > de.clientWidth + 1) {
      const culpables = Array.from(document.body.querySelectorAll('*'))
        .filter((e) => {
          const c = e.getBoundingClientRect();
          return c.width > 0 && (c.right > de.clientWidth + 1 || c.left < -1) && !lib.recortada(e);
        })
        .slice(0, 3);
      hallazgos.push({
        tipo: 'desborde',
        selector: culpables.map((e) => lib.nombre(e)).join(' · ') || 'documento',
        texto: '',
        medidas: { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth },
        detalle: `la página se desplaza a lo ancho: ${culpables
          .map(
            (e) =>
              `${lib.nombre(e)} termina en ${String(Math.round(e.getBoundingClientRect().right))}`,
          )
          .join('; ')}`,
      });
    }

    /** ¿Algún renglón del texto de `e` se sale de su caja? */
    const textoSeSale = (e: Element): boolean => {
      const caja = e.getBoundingClientRect();
      const recorrido = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      const rango = document.createRange();
      for (let n = recorrido.nextNode(); n !== null; n = recorrido.nextNode()) {
        if ((n.textContent ?? '').trim() === '') continue;
        rango.selectNodeContents(n);
        for (const r of Array.from(rango.getClientRects())) {
          if (r.width < 1) continue;
          if (
            r.right > caja.right + 1 ||
            r.left < caja.left - 1 ||
            r.bottom > caja.bottom + 1 ||
            r.top < caja.top - 1
          ) {
            return true;
          }
        }
      }
      return false;
    };

    for (const e of Array.from(raiz.querySelectorAll<HTMLElement>('*'))) {
      if (e.closest('[aria-hidden="true"], [inert]') !== null) continue;
      if (e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement) continue;
      const est = getComputedStyle(e);
      const recortaX = est.overflowX === 'hidden' || est.overflowX === 'clip';
      const recortaY = est.overflowY === 'hidden' || est.overflowY === 'clip';
      const elipsis = est.textOverflow === 'ellipsis';
      const clamp = est.getPropertyValue('-webkit-line-clamp');
      const conClamp = clamp !== '' && clamp !== 'none';
      if (!(recortaX || recortaY || elipsis || conClamp)) continue;
      // Lo de lectores de pantalla (`sr-only`, 1 px) se recorta a propósito.
      if (e.clientWidth <= 2 || e.clientHeight <= 2) continue;
      if (est.display === 'none' || est.visibility === 'hidden') continue;
      if ((e.textContent ?? '').trim() === '') continue;
      const excesoX = e.scrollWidth - e.clientWidth;
      const excesoY = e.scrollHeight - e.clientHeight;
      const donde = lib.nombre(e);
      const texto = lib.texto(e);
      if ((elipsis && excesoX > 1) || (conClamp && excesoY > 1)) {
        informativos.push({
          tipo: 'elipsis-intencional',
          selector: donde,
          texto,
          detalle: conClamp ? `line-clamp ${clamp}` : 'text-overflow: ellipsis',
        });
        continue;
      }
      const sobra = (recortaX && excesoX > 1 && !elipsis) || (recortaY && excesoY > 1 && !conClamp);
      if (sobra && textoSeSale(e)) {
        hallazgos.push({
          tipo: 'texto-cortado',
          selector: donde,
          texto,
          medidas: {
            scrollWidth: e.scrollWidth,
            clientWidth: e.clientWidth,
            scrollHeight: e.scrollHeight,
            clientHeight: e.clientHeight,
          },
          detalle: 'el contenedor recorta texto sin elipsis',
        });
      }
    }
    return { hallazgos, informativos };
  });
}
