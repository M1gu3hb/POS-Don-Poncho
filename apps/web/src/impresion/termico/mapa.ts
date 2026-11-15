/**
 * LA IMAGEN QUE ENTIENDE UNA TÉRMICA (DP-20 · refuerzo §1). Puro.
 *
 * Una térmica sólo sabe quemar o no quemar cada punto: no hay grises. Todo lo que se imprime
 * «idéntico a la pantalla» pasa por aquí: el ticket dibujado al ancho exacto de la impresora
 * (en puntos) se vuelve un mapa de 1 bit, y ese mapa es lo que se codifica, lo que enseña la
 * vista previa y lo que las pruebas comparan punto por punto.
 */

export interface MapaDeBits {
  /** Ancho y alto en puntos de la impresora. */
  readonly ancho: number;
  readonly alto: number;
  /** Un byte por punto, por filas: 1 = negro (se quema), 0 = blanco. */
  readonly puntos: Uint8Array;
}

/** Lo que entrega un `<canvas>`: cuatro bytes por pixel (rojo, verde, azul, opacidad). */
export interface ImagenRgba {
  readonly ancho: number;
  readonly alto: number;
  readonly datos: Uint8ClampedArray | Uint8Array;
}

/** Un rectángulo dentro de la imagen, en puntos. */
export interface Zona {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

export function mapaVacio(ancho: number, alto: number): MapaDeBits {
  if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho <= 0 || alto < 0) {
    throw new RangeError(
      `Medidas inválidas para un mapa de bits: ${String(ancho)} × ${String(alto)}.`,
    );
  }
  return { ancho, alto, puntos: new Uint8Array(ancho * alto) };
}

export function puntoEn(mapa: MapaDeBits, x: number, y: number): 0 | 1 {
  if (x < 0 || y < 0 || x >= mapa.ancho || y >= mapa.alto) return 0;
  return mapa.puntos[y * mapa.ancho + x] === 1 ? 1 : 0;
}

/** Los bytes de cada fila, con el bit más alto a la izquierda (como los pide ESC/POS). */
export function bytesPorFila(ancho: number): number {
  return Math.ceil(ancho / 8);
}

/** Las filas `desde` … `desde + cuantas − 1`, empaquetadas a 8 puntos por byte. */
export function empaquetarFilas(mapa: MapaDeBits, desde: number, cuantas: number): Uint8Array {
  const porFila = bytesPorFila(mapa.ancho);
  const salida = new Uint8Array(porFila * cuantas);
  for (let fila = 0; fila < cuantas; fila += 1) {
    for (let x = 0; x < mapa.ancho; x += 1) {
      if (puntoEn(mapa, x, desde + fila) === 1) {
        const indice = fila * porFila + (x >> 3);
        salida[indice] = (salida[indice] ?? 0) | (0x80 >> (x & 7));
      }
    }
  }
  return salida;
}

/** Cuántos puntos difieren entre dos mapas; `null` si no miden lo mismo. */
export function puntosDistintos(a: MapaDeBits, b: MapaDeBits): number | null {
  if (a.ancho !== b.ancho || a.alto !== b.alto) return null;
  let distintos = 0;
  for (let i = 0; i < a.puntos.length; i += 1) {
    if (a.puntos[i] !== b.puntos[i]) distintos += 1;
  }
  return distintos;
}

/** Cuántos puntos negros tiene (para saber si un ticket salió en blanco). */
export function puntosNegros(mapa: MapaDeBits): number {
  let negros = 0;
  for (const punto of mapa.puntos) negros += punto;
  return negros;
}

/** El mapa como imagen de pantalla (negro puro sobre blanco), para la vista previa. */
export function aRgba(mapa: MapaDeBits): ImagenRgba {
  const datos = new Uint8ClampedArray(mapa.ancho * mapa.alto * 4);
  for (let i = 0; i < mapa.puntos.length; i += 1) {
    const tono = mapa.puntos[i] === 1 ? 0 : 255;
    datos[i * 4] = tono;
    datos[i * 4 + 1] = tono;
    datos[i * 4 + 2] = tono;
    datos[i * 4 + 3] = 255;
  }
  return { ancho: mapa.ancho, alto: mapa.alto, datos };
}
