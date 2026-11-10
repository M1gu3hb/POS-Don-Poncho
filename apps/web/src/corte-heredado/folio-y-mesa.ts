/**
 * DP-17 (QA de DP-16, H4) · EL FOLIO Y LA MESA COMO LOS ESCRIBE EL DOCUMENTO AL CERRAR.
 *
 * El servidor arma el folio con su serie (`o.serie || '-' || o.folio`: «A-3», «CC-2») y la mesa con
 * su nombre o «Mesa N» (`coalesce(m.nombre, 'Mesa ' || m.numero)`). El visor de Registros lee las
 * ventas por el puente y los escribe con estas mismas reglas: el corte dice lo mismo desde los dos
 * lados.
 */

interface ConFolio {
  readonly serie?: string | null;
  readonly folio?: string | number | null;
}

const conSerie = (registro: ConFolio): string | null => {
  const { serie, folio } = registro;
  if (folio === null || folio === undefined || String(folio).trim() === '') return null;
  const s = (serie ?? '').trim();
  return s === '' ? String(folio) : `${s}-${String(folio)}`;
};

/** «A-3»; un registro viejo sin serie, «3»; sin folio, «—». */
export function folioDeLaVenta(venta: ConFolio): string {
  return conSerie(venta) ?? '—';
}

/** «CC-2»; sin folio todavía, «sin folio» (como `folioDe` del documento). */
export function folioDelCorte(corte: ConFolio): string {
  return conSerie(corte) ?? 'sin folio';
}

/** «Mesa 4», o el nombre de la mesa si lo tiene; sin mesa, `null`. */
export function mesaDeLaVenta(venta: {
  readonly mesa_numero?: number | null;
  readonly mesa_nombre?: string | null;
}): string | null {
  const nombre = (venta.mesa_nombre ?? '').trim();
  if (nombre !== '') return nombre;
  return typeof venta.mesa_numero === 'number' ? `Mesa ${String(venta.mesa_numero)}` : null;
}
