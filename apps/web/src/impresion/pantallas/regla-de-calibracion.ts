/**
 * LA REGLA DE CALIBRACIÓN (DP-20 · laboratorio). Puro: sólo dice dónde va cada marca.
 *
 * Una raya cada 8 puntos (1 mm a 203 dpi), un rótulo cada 80 (10 mm) con su número de punto, tres
 * marcas de borde en los anchos comunes (384, 512 y 576) y un cuadro de 80 × 80 puntos. Se imprime
 * y se lee en el papel hasta qué punto llega la impresora.
 */

export const PUNTOS_POR_MILIMETRO = 8;
export const PASO_DE_LA_REGLA = PUNTOS_POR_MILIMETRO;
export const ROTULO_CADA = 10 * PUNTOS_POR_MILIMETRO;
export const BORDES_A_PROBAR = [384, 512, 576] as const;
export const LADO_DEL_CUADRO = 10 * PUNTOS_POR_MILIMETRO;

export type LargoDeLaMarca = 'corta' | 'media' | 'larga';

export interface MarcaDeLaRegla {
  readonly x: number;
  readonly largo: LargoDeLaMarca;
  /** El número de punto, sólo en las largas (cada 10 mm). */
  readonly rotulo: string | null;
}

export function marcasDeLaRegla(puntos: number): readonly MarcaDeLaRegla[] {
  const marcas: MarcaDeLaRegla[] = [];
  for (let x = 0; x <= puntos; x += PASO_DE_LA_REGLA) {
    const larga = x % ROTULO_CADA === 0;
    marcas.push({
      x,
      largo: larga ? 'larga' : x % (ROTULO_CADA / 2) === 0 ? 'media' : 'corta',
      rotulo: larga ? String(x) : null,
    });
  }
  return marcas;
}

/** Los bordes comunes que caben en el ancho que se prueba. */
export function bordesDeLaRegla(puntos: number): readonly number[] {
  return BORDES_A_PROBAR.filter((borde) => borde <= puntos);
}

export const TEXTO_DEL_CUADRO = 'Este cuadro debe medir 10 × 10 mm a 203 dpi';
