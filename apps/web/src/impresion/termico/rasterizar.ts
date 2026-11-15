/**
 * EL MISMO HTML DE LA PANTALLA, VUELTO IMAGEN (DP-20 · refuerzo §1.1). Sólo navegador.
 *
 * No hay plantilla aparte para el papel: se toma el nodo que ya pinta el ticket, se dibuja con
 * el MISMO motor del navegador (un SVG con `foreignObject`) al ancho exacto de la impresora en
 * puntos —1 px = 1 punto— y de ahí sale la imagen. Así cuadran los acentos, la ñ, los $, el logo
 * y la letra: lo que se ve es lo que se quema.
 *
 * Lo que este camino no admite, a propósito: pseudo-elementos (`::before`), fuentes web y
 * fondos por URL. El estilo térmico no usa ninguno.
 */
import { PAPEL } from './colores-del-papel.ts';
import type { ImagenRgba, Zona } from './mapa.ts';

export interface Dibujo {
  readonly imagen: ImagenRgba;
  /** Dónde quedaron las imágenes (el logo): ahí se trama en vez de aplicar el umbral. */
  readonly zonasDeImagen: readonly Zona[];
  /** Lo que no se pudo dibujar tal cual (un logo que no cargó). Nunca se calla. */
  readonly avisos: readonly string[];
}

const ESPERA_DE_IMAGEN_MS = 4000;
/** Un ticket de más de esto es un error de quien llama, no un ticket. */
const ALTO_MAXIMO = 30_000;

function esperarImagen(imagen: HTMLImageElement): Promise<boolean> {
  if (imagen.complete) return Promise.resolve(imagen.naturalWidth > 0);
  return new Promise((resolver) => {
    const reloj = setTimeout(() => {
      resolver(false);
    }, ESPERA_DE_IMAGEN_MS);
    const terminar = (bien: boolean) => () => {
      clearTimeout(reloj);
      resolver(bien);
    };
    imagen.addEventListener('load', terminar(true), { once: true });
    imagen.addEventListener('error', terminar(false), { once: true });
  });
}

async function comoDatos(origen: string): Promise<string> {
  if (origen.startsWith('data:')) return origen;
  const respuesta = await fetch(origen, { mode: 'cors', credentials: 'omit' });
  if (!respuesta.ok) throw new Error(`La imagen respondió ${String(respuesta.status)}.`);
  const contenido = await respuesta.blob();
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.addEventListener('load', () => {
      if (typeof lector.result === 'string') resolver(lector.result);
      else rechazar(new Error('No se pudo leer la imagen.'));
    });
    lector.addEventListener('error', () => {
      rechazar(lector.error ?? new Error('No se pudo leer la imagen.'));
    });
    lector.readAsDataURL(contenido);
  });
}

/** Todo el estilo calculado de un nodo, escrito en su atributo: la copia ya no depende de las hojas. */
function estiloCalculado(nodo: Element): string {
  const estilo = getComputedStyle(nodo);
  let texto = '';
  for (let i = 0; i < estilo.length; i += 1) {
    const propiedad = estilo.item(i);
    texto += `${propiedad}:${estilo.getPropertyValue(propiedad)};`;
  }
  return texto;
}

function zonaDe(nodo: Element, marco: DOMRect): Zona {
  const caja = nodo.getBoundingClientRect();
  return {
    x: caja.left - marco.left,
    y: caja.top - marco.top,
    ancho: caja.width,
    alto: caja.height,
  };
}

function cargarSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.addEventListener('load', () => {
      resolver(imagen);
    });
    imagen.addEventListener('error', () => {
      rechazar(new Error('El navegador no pudo dibujar el documento.'));
    });
    imagen.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/**
 * Dibuja `nodo` (ya montado en el documento, con su ancho en puntos) y devuelve sus pixeles.
 * El nodo no se toca: se trabaja sobre una copia.
 */
export async function dibujarNodo(nodo: HTMLElement): Promise<Dibujo> {
  const avisos: string[] = [];
  const imagenes = Array.from(nodo.querySelectorAll('img'));
  const cargadas = await Promise.all(imagenes.map(esperarImagen));

  const marco = nodo.getBoundingClientRect();
  const ancho = Math.round(marco.width);
  const alto = Math.ceil(marco.height);
  if (ancho <= 0 || alto <= 0) throw new Error('El documento no tiene nada que imprimir.');
  if (alto > ALTO_MAXIMO)
    throw new Error('El documento es demasiado largo para imprimirse como imagen.');

  const originales = [nodo, ...Array.from(nodo.querySelectorAll('*'))];
  const copia = nodo.cloneNode(true) as HTMLElement;
  const copias = [copia, ...Array.from(copia.querySelectorAll('*'))];
  copias.forEach((elemento, i) => {
    const original = originales[i];
    if (original === undefined) return;
    elemento.setAttribute('style', estiloCalculado(original));
    elemento.removeAttribute('class');
  });
  copia.style.margin = '0';

  const zonasDeImagen: Zona[] = [];
  const imagenesDeLaCopia = Array.from(copia.querySelectorAll('img'));
  await Promise.all(
    imagenes.map(async (imagen, i) => {
      const enLaCopia = imagenesDeLaCopia[i];
      if (enLaCopia === undefined) return;
      try {
        if (cargadas[i] !== true) throw new Error('No cargó.');
        enLaCopia.setAttribute('src', await comoDatos(imagen.currentSrc || imagen.src));
        enLaCopia.removeAttribute('srcset');
        enLaCopia.removeAttribute('crossorigin');
        if (!imagen.hasAttribute('data-sin-tramado')) zonasDeImagen.push(zonaDe(imagen, marco));
      } catch (error: unknown) {
        // Un ticket sin logo sirve; uno que no sale, no. Se quita la imagen y se dice.
        enLaCopia.remove();
        const motivo = error instanceof Error ? error.message : 'Motivo desconocido.';
        avisos.push(`Una imagen no se pudo imprimir (${motivo})`);
      }
    }),
  );
  for (const tramado of Array.from(nodo.querySelectorAll('[data-tramado]'))) {
    zonasDeImagen.push(zonaDe(tramado, marco));
  }

  const cuerpo = new XMLSerializer().serializeToString(copia);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(ancho)}" height="${String(alto)}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">${cuerpo}</foreignObject></svg>`;
  const dibujado = await cargarSvg(svg);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const pincel = lienzo.getContext('2d', { willReadFrequently: true });
  if (pincel === null) throw new Error('Este navegador no deja dibujar el documento.');
  pincel.fillStyle = PAPEL;
  pincel.fillRect(0, 0, ancho, alto);
  pincel.drawImage(dibujado, 0, 0, ancho, alto);
  const pixeles = pincel.getImageData(0, 0, ancho, alto);

  return { imagen: { ancho, alto, datos: pixeles.data }, zonasDeImagen, avisos };
}
