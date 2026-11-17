import type { Page } from '@playwright/test';

import { puntoDe, type Objetivo, type Punto } from './dedos.ts';
import {
  armarEspia,
  leerMenu,
  leerSeleccion,
  type MenuVisto,
  type SeleccionVista,
} from './espia-de-gestos.ts';
import type { Hallazgo } from './tipos.ts';

/**
 * LO QUE CADA GESTO DEVUELVE. Un gesto cumple si no dejó texto seleccionado (fuera de un campo de
 * texto) y no sacó el menú del sistema (el `contextmenu` no llegó, o llegó con `defaultPrevented`;
 * dentro de un campo de texto el menú SÍ es legítimo).
 */

export type NombreDeGesto =
  | 'toque'
  | 'toque-doble'
  | 'pulsacion-larga'
  | 'deslizar'
  | 'arrastrar'
  | 'pellizco'
  | 'menu-contextual';

export interface ResultadoDeGesto {
  readonly gesto: NombreDeGesto;
  readonly donde: string;
  readonly enCampo: boolean;
  readonly seleccion: SeleccionVista;
  readonly menu: MenuVisto;
  /** Lo que falló, en una frase cada cosa. Vacío = el gesto cumplió. */
  readonly problemas: readonly string[];
  readonly extra: Readonly<Record<string, number | string | boolean | null>>;
}

export async function dondeCae(
  page: Page,
  p: Punto,
): Promise<{ nombre: string; enCampo: boolean }> {
  return page.evaluate(({ x, y }) => {
    const lib = (
      window as unknown as {
        __arnes: {
          nombre(e: Element): string;
          texto(e: Element): string;
          enCampoDeTexto(e: Element | null): boolean;
        };
      }
    ).__arnes;
    const e = document.elementFromPoint(x, y);
    return e === null
      ? { nombre: `(${String(x)},${String(y)}) sin elemento`, enCampo: false }
      : { nombre: `${lib.nombre(e)} «${lib.texto(e)}»`, enCampo: lib.enCampoDeTexto(e) };
  }, p);
}

/** Cierra un gesto: lee selección y menú y arma el resultado con lo que no cumplió. */
export async function concluir(
  page: Page,
  gesto: NombreDeGesto,
  punto: Punto,
  modelada: boolean,
  extra: ResultadoDeGesto['extra'] = {},
): Promise<ResultadoDeGesto> {
  const { nombre, enCampo } = await dondeCae(page, punto);
  const seleccion = await leerSeleccion(page, modelada);
  const menu = await leerMenu(page);
  const problemas: string[] = [];
  if (!enCampo && seleccion.texto !== '') {
    problemas.push(
      `quedó texto seleccionado («${seleccion.texto.slice(0, 40)}», ${seleccion.origen ?? ''})`,
    );
  }
  if (!enCampo && menu.llego && menu.prevenido !== true) {
    problemas.push(
      `salió el menú del sistema (contextmenu sin prevenir, ${menu.origen ?? ''}) en ${menu.donde}`,
    );
  }
  return { gesto, donde: nombre, enCampo, seleccion, menu, problemas, extra };
}

/** Trae el blanco a la vista, arma el espía y devuelve el punto donde cae el dedo. */
export async function prepararGesto(page: Page, objetivo: Objetivo): Promise<Punto> {
  const punto = await puntoDe(objetivo);
  await armarEspia(page);
  return punto;
}

/** Un resultado de gesto como hallazgos (uno por problema), listos para el informe. */
export function hallazgosDeGesto(r: ResultadoDeGesto): Hallazgo[] {
  return r.problemas.map((problema): Hallazgo => {
    const tipo = problema.startsWith('quedó texto')
      ? 'gesto-seleccion'
      : problema.includes('menú')
        ? 'gesto-menu'
        : 'gesto-desplazamiento';
    return {
      tipo,
      selector: r.donde,
      texto: r.seleccion.texto,
      medidas: { gesto: r.gesto, ...r.extra },
      detalle: problema,
    };
  });
}

/** Lanza si el gesto no cumplió. */
export function exigirGesto(r: ResultadoDeGesto): void {
  if (r.problemas.length > 0) {
    throw new Error(`El gesto «${r.gesto}» en ${r.donde} no cumplió: ${r.problemas.join('; ')}.`);
  }
}
