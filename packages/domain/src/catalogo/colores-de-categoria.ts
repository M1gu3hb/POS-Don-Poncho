/**
 * DP-24 · 3.4 · LA PALETA DE LAS CATEGORÍAS.
 *
 * `categorias.color` guarda la CLAVE de un color de esta paleta fija (`cat-1` … `cat-16`), nunca un
 * hex: los valores —en claro y en oscuro, con su contraste medido— viven como tokens en
 * `packages/ui/src/estilos/categorias.css`. Así una pantalla no inventa colores y el mismo color
 * se ve bien en los dos modos.
 *
 * El color nunca es el único medio para distinguir una categoría: la pestaña y la franja siempre
 * van con el nombre.
 */

export interface ColorDeCategoria {
  readonly clave: string;
  readonly nombre: string;
}

export const COLORES_DE_CATEGORIA: readonly ColorDeCategoria[] = [
  { clave: 'cat-1', nombre: 'Rojo' },
  { clave: 'cat-2', nombre: 'Naranja' },
  { clave: 'cat-3', nombre: 'Ámbar' },
  { clave: 'cat-4', nombre: 'Mostaza' },
  { clave: 'cat-5', nombre: 'Lima' },
  { clave: 'cat-6', nombre: 'Verde' },
  { clave: 'cat-7', nombre: 'Esmeralda' },
  { clave: 'cat-8', nombre: 'Turquesa' },
  { clave: 'cat-9', nombre: 'Cian' },
  { clave: 'cat-10', nombre: 'Celeste' },
  { clave: 'cat-11', nombre: 'Azul' },
  { clave: 'cat-12', nombre: 'Índigo' },
  { clave: 'cat-13', nombre: 'Violeta' },
  { clave: 'cat-14', nombre: 'Magenta' },
  { clave: 'cat-15', nombre: 'Rosa' },
  { clave: 'cat-16', nombre: 'Café' },
];

const CLAVES: ReadonlySet<string> = new Set(COLORES_DE_CATEGORIA.map((c) => c.clave));

/** La clave si es de la paleta; `null` («sin color») para cualquier otra cosa. */
export function claveDeColorDeCategoria(valor: string | null | undefined): string | null {
  return typeof valor === 'string' && CLAVES.has(valor) ? valor : null;
}

/** El primer color de la paleta que ninguna otra categoría usa (si se acaban, vuelve al primero). */
export function primerColorLibre(usados: readonly (string | null | undefined)[]): string {
  const enUso = new Set(usados.flatMap((u) => (typeof u === 'string' ? [u] : [])));
  return COLORES_DE_CATEGORIA.find((c) => !enUso.has(c.clave))?.clave ?? 'cat-1';
}
