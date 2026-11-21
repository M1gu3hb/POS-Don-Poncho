/**
 * DP-24 · 3.1 · UN SOLO ORDEN DEL MENÚ.
 *
 * El portal QR, la rejilla del mesero, la de la Caja y el buscador ordenan igual: primero la
 * categoría (por su `orden`), luego el lugar del producto dentro de ella (`orden_en_categoria`) y,
 * a igualdad, por nombre. Un producto que nadie ordenó (`orden_en_categoria` nulo) va al final de su
 * categoría, por nombre: mientras nadie ordene, el menú se ve igual que antes (por nombre).
 *
 * Puro y sin mutar lo que recibe: lo comparten el servidor (el portal) y las pantallas.
 */

export interface CategoriaOrdenable {
  readonly id: string;
  readonly nombre?: string | null;
  readonly orden?: number | null;
}

export interface ProductoOrdenable {
  readonly id: string;
  readonly nombre?: string | null;
  readonly categoria_id?: string | null;
  readonly orden_en_categoria?: number | null;
}

/** Compara textos como se ordena en español: sin distinguir mayúsculas, con las tildes en su sitio. */
const alfabeto = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

const alFinal = (n: number | null | undefined): number =>
  typeof n === 'number' && Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;

/** −1, 0 o 1 sin restar infinitos (∞ − ∞ es NaN). */
const comparar = (a: number, b: number): number => (a === b ? 0 : a < b ? -1 : 1);

/** Las categorías en su orden: por `orden`, las sin orden al final, y a igualdad por nombre. */
export function ordenarCategorias<C extends CategoriaOrdenable>(categorias: readonly C[]): C[] {
  return [...categorias].sort(
    (a, b) =>
      comparar(alFinal(a.orden), alFinal(b.orden)) ||
      alfabeto.compare(a.nombre ?? '', b.nombre ?? '') ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Los productos en el orden del menú. Los de una categoría que no existe (o sin categoría) van al
 * final de todo, en su propio orden.
 */
export function ordenarMenu<P extends ProductoOrdenable>(
  productos: readonly P[],
  categorias: readonly CategoriaOrdenable[],
): P[] {
  const lugar = new Map(ordenarCategorias(categorias).map((c, i) => [c.id, i]));
  const deLaCategoria = (p: P): number =>
    p.categoria_id === null || p.categoria_id === undefined
      ? Number.POSITIVE_INFINITY
      : (lugar.get(p.categoria_id) ?? Number.POSITIVE_INFINITY);
  return [...productos].sort(
    (a, b) =>
      comparar(deLaCategoria(a), deLaCategoria(b)) ||
      comparar(alFinal(a.orden_en_categoria), alFinal(b.orden_en_categoria)) ||
      alfabeto.compare(a.nombre ?? '', b.nombre ?? '') ||
      a.id.localeCompare(b.id),
  );
}

/** Sube o baja un lugar el elemento `id`. En la orilla, o si no está, deja la lista igual. */
export function moverEnLaLista(
  ids: readonly string[],
  id: string,
  hacia: 'arriba' | 'abajo',
): string[] {
  const lista = [...ids];
  const i = lista.indexOf(id);
  const j = hacia === 'arriba' ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= lista.length) return lista;
  const a = lista[i];
  const b = lista[j];
  if (a === undefined || b === undefined) return lista;
  lista[i] = b;
  lista[j] = a;
  return lista;
}

/** `true` si las dos listas traen lo mismo en el mismo orden. */
export function mismoOrden(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
