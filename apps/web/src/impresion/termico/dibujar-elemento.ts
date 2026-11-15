/**
 * DEL DOCUMENTO DE LA PANTALLA AL MAPA DE 1 BIT (DP-20 · refuerzo §1.1). Sólo navegador.
 *
 * El mismo documento que se ve —el nodo que ya está en pantalla, o el componente que lo pinta—
 * se monta FUERA de la vista, al ancho exacto de la impresora en puntos (1 px = 1 punto), se
 * dibuja y se convierte a negro puro. No hay plantilla aparte para el papel.
 */
import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import type { MapaDeBits } from './mapa.ts';
import { aMonocromo } from './monocromo.ts';
import { dibujarNodo } from './rasterizar.ts';

export interface ElementoDibujado {
  readonly mapa: MapaDeBits;
  readonly avisos: readonly string[];
}

export interface MedidasDelDibujo {
  /** El ancho imprimible de la impresora, en puntos. */
  readonly puntos: number;
  readonly umbral: number;
}

/** Una pieza a imprimir: un componente, o una copia de un nodo que ya está en pantalla. */
export type Pieza =
  | ReactElement
  | {
      readonly nodo: HTMLElement;
      /** Lo que se le añade a ESTA copia antes de dibujarla (la marca de reimpresión, el pie). */
      readonly preparar?: (copia: HTMLElement) => void;
    };

function unCuadro(): Promise<void> {
  return new Promise((resolver) => {
    requestAnimationFrame(() => {
      resolver();
    });
  });
}

function crearAnfitrion(puntos: number): HTMLDivElement {
  const anfitrion = document.createElement('div');
  anfitrion.setAttribute('aria-hidden', 'true');
  anfitrion.setAttribute('data-lienzo-de-impresion', '');
  anfitrion.style.cssText =
    `position:fixed;left:-100000px;top:0;width:${String(puntos)}px;` +
    'background:#fff;color:#000;pointer-events:none;zoom:1;';
  document.body.appendChild(anfitrion);
  return anfitrion;
}

async function dibujarEnAnfitrion(
  anfitrion: HTMLElement,
  medidas: MedidasDelDibujo,
): Promise<ElementoDibujado> {
  await unCuadro();
  const nodo = anfitrion.firstElementChild;
  if (!(nodo instanceof HTMLElement)) throw new Error('El documento salió vacío.');
  const dibujo = await dibujarNodo(nodo);
  if (dibujo.imagen.ancho > medidas.puntos) {
    throw new Error(
      `El documento mide ${String(dibujo.imagen.ancho)} puntos y la impresora ${String(medidas.puntos)}.`,
    );
  }
  const mapa = aMonocromo(dibujo.imagen, {
    umbral: medidas.umbral,
    zonasConTramado: dibujo.zonasDeImagen,
  });
  return { mapa, avisos: dibujo.avisos };
}

/** Dibuja una copia de un nodo que ya está en pantalla, al ancho de la impresora. */
async function dibujarCopia(
  nodo: HTMLElement,
  medidas: MedidasDelDibujo,
  preparar: ((copia: HTMLElement) => void) | undefined,
): Promise<ElementoDibujado> {
  const anfitrion = crearAnfitrion(medidas.puntos);
  try {
    const copia = nodo.cloneNode(true) as HTMLElement;
    // La copia mide lo que la impresora, sin el `zoom` con que se achica en pantalla.
    copia.style.width = `${String(medidas.puntos)}px`;
    copia.style.maxWidth = 'none';
    copia.style.margin = '0';
    copia.style.setProperty('zoom', '1');
    preparar?.(copia);
    anfitrion.appendChild(copia);
    return await dibujarEnAnfitrion(anfitrion, medidas);
  } finally {
    anfitrion.remove();
  }
}

async function dibujarElemento(
  elemento: ReactElement,
  medidas: MedidasDelDibujo,
): Promise<ElementoDibujado> {
  const anfitrion = crearAnfitrion(medidas.puntos);
  const raiz = createRoot(anfitrion);
  try {
    flushSync(() => {
      raiz.render(elemento);
    });
    return await dibujarEnAnfitrion(anfitrion, medidas);
  } finally {
    raiz.unmount();
    anfitrion.remove();
  }
}

export function dibujarPieza(pieza: Pieza, medidas: MedidasDelDibujo): Promise<ElementoDibujado> {
  return 'nodo' in pieza
    ? dibujarCopia(pieza.nodo, medidas, pieza.preparar)
    : dibujarElemento(pieza, medidas);
}

/** El mapa como PNG (para la vista previa y para imprimir por el driver de Windows). */
export function mapaComoPng(mapa: MapaDeBits): string {
  const lienzo = document.createElement('canvas');
  lienzo.width = mapa.ancho;
  lienzo.height = Math.max(1, mapa.alto);
  const pincel = lienzo.getContext('2d');
  if (pincel === null) throw new Error('Este navegador no deja dibujar la vista previa.');
  const pixeles = pincel.createImageData(mapa.ancho, Math.max(1, mapa.alto));
  for (let i = 0; i < mapa.puntos.length; i += 1) {
    const tono = mapa.puntos[i] === 1 ? 0 : 255;
    pixeles.data[i * 4] = tono;
    pixeles.data[i * 4 + 1] = tono;
    pixeles.data[i * 4 + 2] = tono;
    pixeles.data[i * 4 + 3] = 255;
  }
  pincel.putImageData(pixeles, 0, 0);
  return lienzo.toDataURL('image/png');
}
