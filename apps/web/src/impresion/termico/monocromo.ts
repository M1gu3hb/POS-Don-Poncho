/**
 * DE COLOR A 1 BIT (DP-20 · refuerzo §1.2). Puro.
 *
 * Dos reglas, porque el texto y el logo quieren cosas opuestas:
 *
 *   · EL TEXTO VA CON UMBRAL: cada punto es negro o blanco según su luz. Así las letras salen
 *     con el borde limpio. Con tramado, una letra delgada se deshace en puntos sueltos.
 *   · EL LOGO VA CON TRAMADO (Floyd–Steinberg): los grises de una imagen se reparten en puntos
 *     para que se lea el dibujo. Sólo dentro de las zonas que se le dicen (los `<img>`).
 */
import type { ImagenRgba, MapaDeBits, Zona } from './mapa.ts';

/** Debajo de esta luz (0 = negro, 255 = blanco) el punto se quema. Más alto = letra más gruesa. */
export const UMBRAL_POR_OMISION = 150;

export interface OpcionesDeMonocromo {
  readonly umbral?: number;
  /** Dónde van las imágenes: ahí se trama en lugar de aplicar el umbral. */
  readonly zonasConTramado?: readonly Zona[];
}

/** La luz de un pixel sobre papel blanco: lo transparente es papel. */
export function luzDelPixel(rojo: number, verde: number, azul: number, opacidad: number): number {
  const luz = 0.299 * rojo + 0.587 * verde + 0.114 * azul;
  return 255 - ((255 - luz) * opacidad) / 255;
}

function limitar(zona: Zona, ancho: number, alto: number): Zona {
  const x = Math.max(0, Math.floor(zona.x));
  const y = Math.max(0, Math.floor(zona.y));
  const derecha = Math.min(ancho, Math.ceil(zona.x + zona.ancho));
  const abajo = Math.min(alto, Math.ceil(zona.y + zona.alto));
  return { x, y, ancho: Math.max(0, derecha - x), alto: Math.max(0, abajo - y) };
}

/** Floyd–Steinberg dentro de la zona; el error no se sale de ella. */
function tramar(luces: Float32Array, puntos: Uint8Array, ancho: number, zona: Zona): void {
  const { x: x0, y: y0, ancho: w, alto: h } = zona;
  const repartir = (x: number, y: number, parte: number): void => {
    if (x < x0 || x >= x0 + w || y >= y0 + h) return;
    const i = y * ancho + x;
    luces[i] = (luces[i] ?? 0) + parte;
  };
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      const i = y * ancho + x;
      const luz = luces[i] ?? 255;
      const negro = luz < 128;
      puntos[i] = negro ? 1 : 0;
      const error = luz - (negro ? 0 : 255);
      repartir(x + 1, y, (error * 7) / 16);
      repartir(x - 1, y + 1, (error * 3) / 16);
      repartir(x, y + 1, (error * 5) / 16);
      repartir(x + 1, y + 1, error / 16);
    }
  }
}

export function aMonocromo(imagen: ImagenRgba, opciones: OpcionesDeMonocromo = {}): MapaDeBits {
  const { ancho, alto, datos } = imagen;
  if (datos.length !== ancho * alto * 4) {
    throw new RangeError('La imagen no trae cuatro bytes por pixel.');
  }
  const umbral = opciones.umbral ?? UMBRAL_POR_OMISION;
  const luces = new Float32Array(ancho * alto);
  const puntos = new Uint8Array(ancho * alto);
  for (let i = 0; i < luces.length; i += 1) {
    const luz = luzDelPixel(
      datos[i * 4] ?? 255,
      datos[i * 4 + 1] ?? 255,
      datos[i * 4 + 2] ?? 255,
      datos[i * 4 + 3] ?? 0,
    );
    luces[i] = luz;
    puntos[i] = luz < umbral ? 1 : 0;
  }
  for (const zona of opciones.zonasConTramado ?? []) {
    tramar(luces, puntos, ancho, limitar(zona, ancho, alto));
  }
  return { ancho, alto, puntos };
}
