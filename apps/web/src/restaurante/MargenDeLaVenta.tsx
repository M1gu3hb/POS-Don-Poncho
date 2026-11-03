import {
  RECETA_INCOMPLETA,
  SIN_RECETA,
  economiaDeLaVenta,
  textoDelMargen,
  type VentaParaElMargen,
} from './margen-de-las-ventas';

/**
 * EL MARGEN DE UNA VENTA EN EL HISTORIAL (DP-12.6): el porcentaje cuando el costo se conoce, y
 * «Margen —, sin receta» cuando la cuenta no tiene receta (antes decía «100 % margen»). Quien no
 * ve costos no ve nada. Una pieza aparte para que la pantalla heredada no cargue con la regla.
 */
export function MargenEnLaLista({
  venta,
  colorear,
}: {
  readonly venta: VentaParaElMargen;
  readonly colorear: boolean;
}) {
  const economia = economiaDeLaVenta(venta);
  if (economia.estado === 'oculto') return null;
  if (economia.estado === 'sin_receta' || economia.estado === 'receta_incompleta') {
    return (
      <p className="text-xs text-texto-sutil" data-margen={economia.estado}>
        Margen {economia.estado === 'sin_receta' ? SIN_RECETA : RECETA_INCOMPLETA}
      </p>
    );
  }
  if (economia.margen === null || economia.margen <= 0) return null;
  return (
    <p className={`text-xs ${colorear ? 'text-exito' : 'text-texto-sutil'}`}>
      {textoDelMargen(economia.margen)} margen
    </p>
  );
}
