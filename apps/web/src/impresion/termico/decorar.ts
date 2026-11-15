/**
 * LO QUE SE LE AÑADE A UN PAPEL AL IMPRIMIRLO (DP-20 · refuerzo §3). Sólo navegador.
 *
 * La marca «REIMPRESIÓN» (con la fecha y la hora) y el pie de cada copia («ORIGINAL — CLIENTE»,
 * «COPIA — NEGOCIO») no son del documento: son de ESTA salida. Se añaden a la copia que va a la
 * impresora —o al nodo en pantalla, mientras el navegador imprime— con el mismo estilo térmico.
 */
import type { AnchoDelPapel } from '../papel.ts';

import { letraTermica, LINEA_GRUESA, LINEA_TERMICA } from './estilo.ts';

export const MARCA_DE_SALIDA = 'data-marca-de-salida';

function parrafo(texto: string, estilo: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = texto;
  p.style.cssText = estilo;
  return p;
}

/** Arriba de todo: «REIMPRESIÓN» y cuándo. Para que un ticket viejo no se reuse. */
export function marcarReimpresion(lienzo: HTMLElement, cuando: string, papel: AnchoDelPapel): void {
  const letra = letraTermica(papel);
  const caja = document.createElement('div');
  caja.setAttribute(MARCA_DE_SALIDA, 'reimpresion');
  caja.style.cssText = `border:${LINEA_GRUESA};text-align:center;padding:6px 4px;margin:0 0 10px;`;
  caja.append(
    parrafo(
      'REIMPRESIÓN',
      `font-weight:900;font-size:${String(letra.fuerte)}px;letter-spacing:2px;margin:0;`,
    ),
    parrafo(cuando, `font-size:${String(letra.chica)}px;margin:0;`),
  );
  lienzo.prepend(caja);
}

/** Abajo de todo: de quién es esta copia. */
export function ponerPie(lienzo: HTMLElement, pie: string, papel: AnchoDelPapel): void {
  const letra = letraTermica(papel);
  const p = parrafo(
    pie,
    `text-align:center;font-weight:900;font-size:${String(letra.base)}px;` +
      `border-top:${LINEA_TERMICA};margin:10px 0 0;padding-top:8px;`,
  );
  p.setAttribute(MARCA_DE_SALIDA, 'pie');
  lienzo.append(p);
}

/** Quita lo añadido (cuando se decoró el nodo en pantalla para el diálogo del navegador). */
export function quitarMarcas(lienzo: Element): void {
  for (const marca of Array.from(lienzo.querySelectorAll(`[${MARCA_DE_SALIDA}]`))) marca.remove();
}
