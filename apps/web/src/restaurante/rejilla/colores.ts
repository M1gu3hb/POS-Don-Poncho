import { claveDeColorDeCategoria } from '@morphiqpos/domain/catalogo';

/**
 * DP-24 · 3.4 · El color de cada categoría y la franja de la tarjeta de un platillo (puro: se prueba aparte).
 */

export interface CategoriaConColor {
  readonly id: string;
  readonly color?: string | null;
}

/** La clave del color de la categoría de cada producto, para la franja de su tarjeta. */
export function coloresPorCategoria(
  categorias: readonly CategoriaConColor[],
): ReadonlyMap<string, string> {
  return new Map(
    categorias.flatMap((c) => {
      const clave = claveDeColorDeCategoria(c.color);
      return clave === null ? [] : [[c.id, clave] as const];
    }),
  );
}

/** Los atributos de la tarjeta de un platillo para que lleve la franja de su categoría. */
export function franjaDeLaCategoria(
  colores: ReadonlyMap<string, string>,
  categoriaId: string | null | undefined,
): { readonly className: string; readonly 'data-categoria-color'?: string } {
  const clave =
    categoriaId === null || categoriaId === undefined ? undefined : colores.get(categoriaId);
  return clave === undefined
    ? { className: '' }
    : { className: 'franja-de-categoria', 'data-categoria-color': clave };
}
