import type { Page } from '@playwright/test';

import type { AyudasEnPagina } from '../en-pagina.ts';
import type { Hallazgo } from '../tipos.ts';

/**
 * LA DISPOSICIÓN: lo que se ve desparejo aunque nada desborde.
 *
 *  · `fila-desigual` — tarjetas de una MISMA fila de una cuadrícula (o de una caja flexible que
 *    envuelve) con altos distintos (más de 1 px);
 *  · `campos-desalineados` — campos de una misma fila que no se alinean por su etiqueta ni por su caja
 *    (arriba y abajo, 1 px de tolerancia).
 */

export const TOLERANCIA_PX = 1;

export async function medirDisposicion(page: Page): Promise<Hallazgo[]> {
  return page.evaluate((tolerancia) => {
    const lib = (window as unknown as { __arnes: AyudasEnPagina }).__arnes;
    const hallazgos: Hallazgo[] = [];
    const raiz = lib.raiz();

    // 1 · tarjetas de una fila
    const esTarjeta = (e: Element, padre: Element): boolean => {
      const est = getComputedStyle(e);
      const c = e.getBoundingClientRect();
      if (c.width < 60 || c.height < 30 || lib.visible(e) === null) return false;
      const borde = Number.parseFloat(est.borderTopWidth) > 0;
      const sombra = est.boxShadow !== 'none';
      const fondo = est.backgroundColor !== getComputedStyle(padre).backgroundColor;
      return borde || sombra || fondo;
    };
    for (const padre of Array.from(raiz.querySelectorAll<HTMLElement>('*'))) {
      if (padre.children.length < 2 || lib.visible(padre) === null) continue;
      const est = getComputedStyle(padre);
      const rejilla = est.display === 'grid' || est.display === 'inline-grid';
      const envuelve = est.display.includes('flex') && est.flexWrap !== 'nowrap';
      if (!rejilla && !envuelve) continue;
      const tarjetas = Array.from(padre.children).filter((h) => esTarjeta(h, padre));
      const filas: { top: number; cajas: DOMRect[]; hijas: Element[] }[] = [];
      for (const h of tarjetas.sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
      )) {
        const caja = h.getBoundingClientRect();
        const fila = filas.find((f) => Math.abs(f.top - caja.top) < 4);
        if (fila === undefined) filas.push({ top: caja.top, cajas: [caja], hijas: [h] });
        else {
          fila.cajas.push(caja);
          fila.hijas.push(h);
        }
      }
      for (const fila of filas) {
        if (fila.cajas.length < 2) continue;
        const altos = fila.hijas.map((h) => (h as HTMLElement).offsetHeight);
        if (Math.max(...altos) - Math.min(...altos) > tolerancia) {
          hallazgos.push({
            tipo: 'fila-desigual',
            selector: lib.nombre(padre),
            texto: fila.hijas
              .slice(0, 3)
              .map((h) => lib.texto(h))
              .join(' | '),
            medidas: { altos: altos.map((a) => Math.round(a)).join(' / ') },
            detalle: 'las tarjetas de una misma fila no miden lo mismo',
          });
        }
      }
    }

    // 2 · campos de una fila
    const campos = Array.from(
      raiz.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea, [role="combobox"]',
      ),
    ).filter((c) => lib.visible(c) !== null);
    const etiquetaDe = (c: HTMLElement): Element | null => {
      const propias = (c as HTMLInputElement).labels?.[0];
      if (propias !== undefined) return propias;
      const id = c.getAttribute('aria-labelledby');
      if (id !== null) return document.getElementById(id.split(' ')[0] ?? '');
      return c.parentElement?.querySelector('label') ?? null;
    };
    const filasDeCampos: HTMLElement[][] = [];
    for (const campo of campos) {
      const caja = campo.getBoundingClientRect();
      const fila = filasDeCampos.find((f) => {
        const otra = f[0]?.getBoundingClientRect();
        if (otra === undefined) return false;
        const solape = Math.min(caja.bottom, otra.bottom) - Math.max(caja.top, otra.top);
        const lado = caja.left >= otra.right - 1 || caja.right <= otra.left + 1;
        return lado && solape > 0.4 * Math.min(caja.height, otra.height);
      });
      if (fila === undefined) filasDeCampos.push([campo]);
      else fila.push(campo);
    }
    for (const fila of filasDeCampos) {
      if (fila.length < 2) continue;
      const cajas = fila.map((c) => c.getBoundingClientRect());
      const tops = cajas.map((c) => c.top);
      const bajos = cajas.map((c) => c.bottom);
      const etiquetas = fila.map((c) => etiquetaDe(c)?.getBoundingClientRect().top ?? null);
      const conEtiqueta = etiquetas.filter((t): t is number => t !== null);
      const dispersion = (v: number[]): number => Math.max(...v) - Math.min(...v);
      const malCaja = dispersion(tops) > tolerancia || dispersion(bajos) > tolerancia;
      const malEtiqueta = conEtiqueta.length > 1 && dispersion(conEtiqueta) > tolerancia;
      if (malCaja || malEtiqueta) {
        hallazgos.push({
          tipo: 'campos-desalineados',
          selector: fila.map((c) => lib.nombre(c)).join(' | '),
          texto: fila.map((c) => lib.texto(etiquetaDe(c) ?? c)).join(' | '),
          medidas: {
            arriba: tops.map((t) => Math.round(t)).join(' / '),
            abajo: bajos.map((t) => Math.round(t)).join(' / '),
            etiquetas: conEtiqueta.map((t) => Math.round(t)).join(' / '),
          },
          detalle: 'los campos de una fila no se alinean por su etiqueta y su caja',
        });
      }
    }
    return hallazgos;
  }, TOLERANCIA_PX);
}
