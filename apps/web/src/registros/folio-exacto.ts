/**
 * DP-18 · Buscar un folio en Registros → Ventas: el buscador mira folio, código, cliente, cajera,
 * mesa, método, estado y fechas, así que un folio corto («2») coincide con casi todo; con la lista
 * pintando las 200 más recientes, la venta del folio 2 no salía (repetición del día 1, el dueño no
 * encontró los folios 2 y 6). Si lo buscado es un número, la venta de ese folio va primero; el resto
 * conserva su orden.
 */
const folioDe = (f: { readonly folio?: unknown }): string =>
  typeof f.folio === 'string' || typeof f.folio === 'number' ? String(f.folio) : '';

export function primeroElFolioExacto<T extends { readonly folio?: unknown }>(
  filas: readonly T[],
  busqueda: string,
): readonly T[] {
  const buscado = busqueda.trim();
  if (!/^\d+$/.test(buscado)) return filas;
  const exactas = filas.filter((f) => folioDe(f) === buscado);
  if (exactas.length === 0) return filas;
  return [...exactas, ...filas.filter((f) => folioDe(f) !== buscado)];
}
