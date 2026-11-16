import { coincideConElFolio, type ConFolios } from '@morphiqpos/domain/venta';

/**
 * DP-18 · Buscar un folio en Registros → Ventas: el buscador mira folio, código, cliente, cajera,
 * mesa, método, estado y fechas, así que un folio corto («2») coincide con casi todo; con la lista
 * pintando las 200 más recientes, la venta del folio 2 no salía (repetición del día 1, el dueño no
 * encontró los folios 2 y 6). Si lo buscado nombra un folio, la venta de ese folio va primero; el
 * resto conserva su orden.
 *
 * DP-21 · Bloque 6: «nombra un folio» es `coincideConElFolio`: con el prefijo del negocio,
 * «1001», «01001» y «DP-01001» son la misma cuenta (y «A-3» o «CC-2» lo de siempre).
 */
interface ConFolioDeVenta {
  readonly folio?: unknown;
  readonly serie?: unknown;
}

const comoFolio = (valor: unknown): string | number | null =>
  typeof valor === 'string' || typeof valor === 'number' ? valor : null;

const esElBuscado = (
  fila: ConFolioDeVenta,
  buscado: string,
  configuracion: ConFolios | null | undefined,
): boolean =>
  coincideConElFolio(
    buscado,
    typeof fila.serie === 'string' ? fila.serie : null,
    comoFolio(fila.folio),
    configuracion,
  );

export function primeroElFolioExacto<T extends ConFolioDeVenta>(
  filas: readonly T[],
  busqueda: string,
  configuracion?: ConFolios | null,
): readonly T[] {
  const buscado = busqueda.trim();
  if (buscado === '') return filas;
  const exactas = filas.filter((f) => esElBuscado(f, buscado, configuracion));
  if (exactas.length === 0) return filas;
  return [...exactas, ...filas.filter((f) => !esElBuscado(f, buscado, configuracion))];
}
