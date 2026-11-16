import type { Page } from '@playwright/test';

import type { Recuadro } from './dos-motores.ts';

/**
 * DP-20.1 · DÓNDE QUEDA CADA COSA Y DE QUÉ COLOR, EN CADA MOTOR.
 *
 * La otra mitad de `dos-motores.ts`: lo que no se puede medir bien por pixeles —la tinta y los
 * bordes finos— se mide por lo que el navegador CALCULÓ para cada elemento. Dos motores que pintan
 * la misma página tienen que dejar cada cosa en el mismo sitio y con los mismos colores.
 *
 * El color se pasa por un lienzo de un pixel: el motor viejo dice `rgba(243, 241, 206, 0.7)` y el
 * moderno `oklab(0.95 -0.01 0.04 / 0.7)` para lo mismo, y comparados como texto nunca cuadrarían.
 * Del lienzo salen cuatro números (rojo, verde, azul premultiplicados y alfa) que sí se comparan.
 */

/** Rojo, verde y azul premultiplicados por el alfa, y el alfa: de 0 a 255. */
export type Color = readonly [number, number, number, number];

export interface Medida extends Recuadro {
  /** El camino del elemento en el documento: `div:0>main:1>button:3`. */
  readonly camino: string;
  readonly etiqueta: string;
  readonly texto: string;
  readonly esDialogo: boolean;
  /** Es un botón, va dentro de uno o comparte fila con uno (ver `desplazados`). */
  readonly enFilaDeBoton: boolean;
  readonly tinta: Color;
  readonly fondo: Color;
  /** El borde de arriba, o `null` si el elemento no tiene borde. */
  readonly borde: Color | null;
  readonly opacidad: number;
  readonly peso: string;
  /** DP-21 · Bloque 15: el contorno (anillo de foco), o `null` si no tiene. */
  readonly contorno: Color | null;
  /** DP-21 · Bloque 15: el color de la primera sombra (el anillo de `ring-*` va ahí), o `null`. */
  readonly sombra: Color | null;
  /** DP-21 · Bloque 15: el texto seleccionado (`::selection`); sólo de lo marcado `data-muestra-de="seleccion"`. */
  readonly seleccion: { readonly tinta: Color; readonly fondo: Color } | null;
}

/** Lo que se ve en la pantalla, elemento por elemento. Lo que toca una zona de `tapar` no cuenta. */
export async function medidasDeLoVisible(
  page: Page,
  tapar: readonly Recuadro[] = [],
): Promise<Medida[]> {
  return page.evaluate(
    (zonasTapadas) => {
      const lienzo = document.createElement('canvas');
      lienzo.width = 1;
      lienzo.height = 1;
      const pincel = lienzo.getContext('2d');
      if (pincel === null) throw new Error('sin lienzo 2d');
      const vistos = new Map<string, [number, number, number, number]>();
      const color = (texto: string): [number, number, number, number] => {
        const ya = vistos.get(texto);
        if (ya !== undefined) return ya;
        pincel.clearRect(0, 0, 1, 1);
        pincel.fillStyle = '#000';
        pincel.fillStyle = texto;
        pincel.fillRect(0, 0, 1, 1);
        const [r = 0, g = 0, b = 0, a = 0] = pincel.getImageData(0, 0, 1, 1).data;
        const leido: [number, number, number, number] = [
          Math.round((r * a) / 255),
          Math.round((g * a) / 255),
          Math.round((b * a) / 255),
          a,
        ];
        vistos.set(texto, leido);
        return leido;
      };
      // El color de la primera sombra: el que viene antes de las medidas, `rgb(0, 0, 0) 0px 0px 0px 3px`.
      const colorDeLaSombra = (sombra: string): [number, number, number, number] | null => {
        if (sombra === 'none') return null;
        const m = /^(\w+\([^)]*\)|#[0-9a-f]+|[a-z]+)\s/i.exec(sombra);
        if (m?.[1] === undefined) return null;
        const c = color(m[1]);
        // Una sombra transparente (la de `ring-0`, `shadow-none`) no se ve: el moderno la informa y el
        // viejo no, y no es una diferencia de color.
        return c[3] === 0 ? null : c;
      };
      const camino = (elemento: Element): string => {
        const tramos: string[] = [];
        for (
          let e: Element | null = elemento;
          e !== null && e !== document.body;
          e = e.parentElement
        ) {
          const padre: Element | null = e.parentElement;
          const indice = padre === null ? 0 : Array.prototype.indexOf.call(padre.children, e);
          tramos.unshift(`${e.tagName.toLowerCase()}:${String(indice)}`);
        }
        return tramos.join('>');
      };

      // `zoom` (la vista previa del ticket): hasta Chromium 127 la caja de lo que va dentro se
      // informa SIN el zoom, y desde el 128 con él. Se pinta igual; lo que cambia es el número. Esas
      // cajas no se comparan (los pixeles de esa zona, sí).
      const todos = Array.from(document.body.querySelectorAll('*'));
      const conZoom = todos.filter((e) => {
        const zoom = getComputedStyle(e).getPropertyValue('zoom');
        return zoom !== '' && zoom !== '1' && zoom !== 'normal';
      });

      const medidas = [];
      for (const elemento of todos) {
        if (elemento.closest('svg') !== null && elemento.tagName.toLowerCase() !== 'svg') continue;
        if (conZoom.some((z) => z === elemento || z.contains(elemento))) continue;
        const caja = elemento.getBoundingClientRect();
        if (caja.width < 1 || caja.height < 1) continue;
        if (caja.bottom < 0 || caja.right < 0 || caja.top > innerHeight || caja.left > innerWidth)
          continue;
        // Lo que vive DENTRO de una zona tapada (un reloj, un folio) cambia de corrida a corrida.
        const dentroDeLoTapado = zonasTapadas.some(
          (z) =>
            caja.left >= z.x - 1 &&
            caja.top >= z.y - 1 &&
            caja.right <= z.x + z.ancho + 1 &&
            caja.bottom <= z.y + z.alto + 1,
        );
        if (dentroDeLoTapado) continue;
        // Y lo que CONTIENE una zona tapada mide según lo que haya dentro: tampoco se compara.
        const contieneLoTapado = zonasTapadas.some(
          (z) =>
            caja.left <= z.x + 1 &&
            caja.top <= z.y + 1 &&
            caja.right >= z.x + z.ancho - 1 &&
            caja.bottom >= z.y + z.alto - 1,
        );
        if (contieneLoTapado) continue;
        const estilo = getComputedStyle(elemento);
        if (estilo.visibility === 'hidden' || estilo.display === 'none') continue;
        const rol = elemento.getAttribute('role');
        medidas.push({
          camino: camino(elemento),
          etiqueta: elemento.tagName.toLowerCase(),
          texto: (elemento.children.length === 0 ? (elemento.textContent ?? '') : '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 40),
          esDialogo: rol === 'dialog' || rol === 'alertdialog',
          enFilaDeBoton:
            elemento.closest('button') !== null ||
            elemento.querySelector(':scope > button') !== null ||
            Array.from(elemento.parentElement?.children ?? []).some((h) => h.tagName === 'BUTTON'),
          x: Math.round(caja.left),
          y: Math.round(caja.top),
          ancho: Math.round(caja.width),
          alto: Math.round(caja.height),
          tinta: color(estilo.color),
          fondo: color(estilo.backgroundColor),
          borde: Number.parseFloat(estilo.borderTopWidth) > 0 ? color(estilo.borderTopColor) : null,
          opacidad: Number(estilo.opacity),
          peso: estilo.fontWeight,
          contorno:
            estilo.outlineStyle !== 'none' && Number.parseFloat(estilo.outlineWidth) > 0
              ? color(estilo.outlineColor)
              : null,
          sombra: colorDeLaSombra(estilo.boxShadow),
          seleccion:
            elemento.getAttribute('data-muestra-de') === 'seleccion'
              ? {
                  tinta: color(getComputedStyle(elemento, '::selection').color),
                  fondo: color(getComputedStyle(elemento, '::selection').backgroundColor),
                }
              : null,
        });
      }
      return medidas;
    },
    [...tapar],
  );
}

export interface Desplazamiento {
  readonly camino: string;
  readonly texto: string;
  readonly esDialogo: boolean;
  /**
   * La única diferencia de acomodo que se acepta, y se cuenta aparte: sin `:has()` (Chromium < 105)
   * el botón del sistema no sabe que lleva icono y deja 5 px más de margen a cada lado
   * (`has-[>svg]:px-…` en `packages/ui/src/primitivas/button.tsx`). El botón sale hasta 10 px más
   * ancho y lo que comparte su fila se corre lo mismo; arriba y abajo no cambia nada.
   */
  readonly porBotonConIcono: boolean;
  readonly viejo: Recuadro | null;
  readonly moderno: Recuadro;
}

const caja = (m: Medida): Recuadro => ({ x: m.x, y: m.y, ancho: m.ancho, alto: m.alto });

/** Lo más que ensancha un botón el no saber que lleva icono: 5 px por lado. */
const ANCHO_DE_MAS_SIN_HAS = 10;

/** Lo que el motor viejo deja en otro sitio (o no pinta), con `tolerancia` pixeles de margen. */
export function desplazados(
  viejo: readonly Medida[],
  moderno: readonly Medida[],
  tolerancia = 2,
): Desplazamiento[] {
  const delViejo = new Map(viejo.map((m) => [m.camino, m]));
  const fuera: Desplazamiento[] = [];
  for (const m of moderno) {
    const v = delViejo.get(m.camino);
    const igual =
      v !== undefined &&
      Math.abs(v.x - m.x) <= tolerancia &&
      Math.abs(v.y - m.y) <= tolerancia &&
      Math.abs(v.ancho - m.ancho) <= tolerancia &&
      Math.abs(v.alto - m.alto) <= tolerancia;
    if (igual) continue;
    const porBotonConIcono =
      v !== undefined &&
      m.enFilaDeBoton &&
      !m.esDialogo &&
      Math.abs(v.y - m.y) <= tolerancia &&
      Math.abs(v.alto - m.alto) <= tolerancia &&
      Math.abs(v.ancho - m.ancho) <= ANCHO_DE_MAS_SIN_HAS &&
      Math.abs(v.x - m.x) <= 2 * ANCHO_DE_MAS_SIN_HAS;
    fuera.push({
      camino: m.camino,
      texto: m.texto,
      esDialogo: m.esDialogo,
      porBotonConIcono,
      viejo: v === undefined ? null : caja(v),
      moderno: caja(m),
    });
  }
  return fuera;
}

export interface DiferenciaDeEstilo {
  readonly camino: string;
  readonly texto: string;
  readonly que:
    | 'tinta'
    | 'fondo'
    | 'borde'
    | 'opacidad'
    | 'peso'
    | 'contorno'
    | 'sombra'
    | 'seleccion (texto)'
    | 'seleccion (fondo)';
  readonly viejo: string;
  readonly moderno: string;
}

const mismoColor = (a: Color | null, b: Color | null, tolerancia: number): boolean => {
  if (a === null || b === null) return a === b;
  return a.every((canal, i) => Math.abs(canal - (b[i] ?? 0)) <= tolerancia);
};
const decir = (c: Color | null): string => (c === null ? 'sin borde' : `rgba*(${c.join(', ')})`);

/**
 * Los elementos que el motor viejo pinta de otro color (texto, fondo o borde), con otra opacidad o
 * con otro peso de letra. `tolerancia` va por canal, de 0 a 255: el lienzo redondea.
 */
export function diferenciasDeEstilo(
  viejo: readonly Medida[],
  moderno: readonly Medida[],
  tolerancia = 4,
): DiferenciaDeEstilo[] {
  const delViejo = new Map(viejo.map((m) => [m.camino, m]));
  const diferencias: DiferenciaDeEstilo[] = [];
  for (const m of moderno) {
    const v = delViejo.get(m.camino);
    if (v === undefined) continue;
    const anotar = (que: DiferenciaDeEstilo['que'], deViejo: string, deModerno: string): void => {
      diferencias.push({
        camino: m.camino,
        texto: m.texto,
        que,
        viejo: deViejo,
        moderno: deModerno,
      });
    };
    if (!mismoColor(v.tinta, m.tinta, tolerancia)) anotar('tinta', decir(v.tinta), decir(m.tinta));
    if (!mismoColor(v.fondo, m.fondo, tolerancia)) anotar('fondo', decir(v.fondo), decir(m.fondo));
    if (!mismoColor(v.borde, m.borde, tolerancia)) anotar('borde', decir(v.borde), decir(m.borde));
    if (!mismoColor(v.contorno, m.contorno, tolerancia))
      anotar('contorno', decir(v.contorno), decir(m.contorno));
    if (!mismoColor(v.sombra, m.sombra, tolerancia))
      anotar('sombra', decir(v.sombra), decir(m.sombra));
    if (m.seleccion !== null) {
      if (!mismoColor(v.seleccion?.tinta ?? null, m.seleccion.tinta, tolerancia))
        anotar('seleccion (texto)', decir(v.seleccion?.tinta ?? null), decir(m.seleccion.tinta));
      if (!mismoColor(v.seleccion?.fondo ?? null, m.seleccion.fondo, tolerancia))
        anotar('seleccion (fondo)', decir(v.seleccion?.fondo ?? null), decir(m.seleccion.fondo));
    }
    if (Math.abs(v.opacidad - m.opacidad) > 0.02)
      anotar('opacidad', String(v.opacidad), String(m.opacidad));
    if (v.peso !== m.peso) anotar('peso', v.peso, m.peso);
  }
  return diferencias;
}
