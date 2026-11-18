/**
 * DP-D178 · La búsqueda de productos del pedido, sin que los acentos ni las mayúsculas estorben.
 *
 * Vive aquí, y no en cada pantalla, para que el mesero de la mesa y el catálogo del pedido de la
 * Caja busquen igual.
 */

/** Minúsculas y sin marcas de acento («Limón» → «limon»). */
export function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** ¿El nombre contiene lo buscado? Una búsqueda vacía deja pasar todo. */
export function coincideConLaBusqueda(
  nombre: string | null | undefined,
  busqueda: string,
): boolean {
  const q = sinAcentos(busqueda.trim());
  if (q === '') return true;
  if (nombre === null || nombre === undefined) return false;
  return sinAcentos(nombre).includes(q);
}
