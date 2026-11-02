/**
 * CÓMO SE VE UNA UNIÓN DE MESAS (DP-12.3) · la forma al fundirse y la vecina que «llama».
 *
 * Puro, para la pantalla: el servidor no necesita dibujar. Las medidas son las de `union.ts`.
 *
 *   · Al fundirse, la forma depende de la dirección: dos redondas lado a lado son una cápsula
 *     horizontal; una arriba de otra, vertical; dos cuadradas, un rectángulo; cuatro en 2 × 2, un
 *     cuadrado. Es la caja del grupo con el radio que le toca.
 *   · El imán es una animación de las OTRAS mesas, no del arrastre: la que va en el dedo lo sigue
 *     1:1, y la vecina más cercana se inclina y se estira hacia ella («ven para acá») cuanto más se
 *     acerca. Al soltarla a `IMAN` o menos, se funden (`atraer` las pega).
 */

import { IMAN, type MesaEnPlano } from './union.ts';

export interface MesaConForma extends MesaEnPlano {
  readonly forma: string | null | undefined;
}

export type Figura = 'capsula-horizontal' | 'capsula-vertical' | 'rectangulo' | 'cuadrado';

export interface FormaDeLaUnion {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
  /** El radio de las esquinas, en puntos del plano. */
  readonly radio: number;
  readonly figura: Figura;
}

/** Más alargado que esto (proporción) ya es una cápsula o un rectángulo, no un cuadrado. */
const CASI_CUADRADO = 1.15;
const RADIO_DE_CUADRADA = 12;
const RADIO_DE_RECTANGULAR = 14;

/** La caja que cubre a todas, con el radio de su figura. `null` sin mesas. */
export function formaDeLaUnion(mesas: readonly MesaConForma[]): FormaDeLaUnion | null {
  if (mesas.length === 0) return null;
  const x = Math.min(...mesas.map((m) => m.x));
  const y = Math.min(...mesas.map((m) => m.y));
  const ancho = Math.max(...mesas.map((m) => m.x + m.ancho)) - x;
  const alto = Math.max(...mesas.map((m) => m.y + m.alto)) - y;
  const horizontal = ancho > alto * CASI_CUADRADO;
  const vertical = alto > ancho * CASI_CUADRADO;
  const redondas = mesas.every((m) => (m.forma ?? 'redonda') === 'redonda');
  if (redondas && horizontal) {
    return { x, y, ancho, alto, radio: alto / 2, figura: 'capsula-horizontal' };
  }
  if (redondas && vertical) {
    return { x, y, ancho, alto, radio: ancho / 2, figura: 'capsula-vertical' };
  }
  if (!horizontal && !vertical) {
    const radio = redondas ? Math.min(ancho, alto) / 4 : RADIO_DE_CUADRADA;
    return { x, y, ancho, alto, radio, figura: 'cuadrado' };
  }
  return { x, y, ancho, alto, radio: RADIO_DE_RECTANGULAR, figura: 'rectangulo' };
}

/** Desde aquí la vecina empieza a «llamar»: el doble del imán. */
export const DISTANCIA_DE_LLAMADO = IMAN * 2;
/** Lo más que se inclina la vecina, en puntos, y lo más que se estira (proporción). */
export const INCLINACION_MAXIMA = 10;
export const ESTIRON_MAXIMO = 0.08;

function distancia(a: MesaEnPlano, b: MesaEnPlano): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.ancho, b.x + b.ancho));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.alto, b.y + b.alto));
  return Math.hypot(dx, dy);
}

export interface Llamado {
  /** La vecina que se inclina. */
  readonly id: string;
  /** Cuánto se mueve hacia la arrastrada, en puntos del plano. */
  readonly dx: number;
  readonly dy: number;
  /** Cuánto se estira en esa dirección (1 = nada). */
  readonly estiron: number;
  /** Soltada ahora, se fundirían. */
  readonly seFunden: boolean;
}

/**
 * La vecina más cercana a la mesa que va en el dedo, y cuánto se inclina hacia ella: nada a
 * `DISTANCIA_DE_LLAMADO`, todo al tocarse. `null` si ninguna está tan cerca.
 */
export function vecinaQueLlama(
  arrastrada: MesaEnPlano,
  otras: readonly MesaEnPlano[],
): Llamado | null {
  const cercana = otras
    .filter((o) => o.id !== arrastrada.id)
    .map((o) => ({ o, d: distancia(arrastrada, o) }))
    .filter(({ d }) => d <= DISTANCIA_DE_LLAMADO)
    .sort((p, q) => p.d - q.d)[0];
  if (cercana === undefined) return null;
  const { o, d } = cercana;
  const fuerza = 1 - d / DISTANCIA_DE_LLAMADO;
  const hx = arrastrada.x + arrastrada.ancho / 2 - (o.x + o.ancho / 2);
  const hy = arrastrada.y + arrastrada.alto / 2 - (o.y + o.alto / 2);
  const largo = Math.hypot(hx, hy) || 1;
  return {
    id: o.id,
    dx: (hx / largo) * INCLINACION_MAXIMA * fuerza,
    dy: (hy / largo) * INCLINACION_MAXIMA * fuerza,
    estiron: 1 + ESTIRON_MAXIMO * fuerza,
    seFunden: d <= IMAN,
  };
}
