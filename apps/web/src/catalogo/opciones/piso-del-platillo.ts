import { opcionesQueDejanSinPrecio, type GrupoParaRevisar } from '@morphiqpos/domain/catalogo';

import { precioAPesos, precioEsValido, type GrupoEditable } from './editor-de-grupos.ts';

/**
 * DP-18 · M6 · En el editor de opciones, antes de guardar: con estos grupos, ¿el platillo puede
 * quedar en $0 o menos? La regla es la del servidor (`opcionesQueDejanSinPrecio`), con el precio
 * del platillo que se está editando; el servidor revisa además los demás platillos que comparten el
 * grupo y lo vuelve a exigir al guardar.
 */
export interface PlatilloConPrecio {
  readonly nombre?: string;
  readonly tipo_venta?: string | null;
  /** Pesos, como los sirve el puente (`dinero`). */
  readonly precio_venta?: number | string | null;
  readonly precio_por_unidad_variable?: number | string | null;
  readonly cantidad_minima_variable?: number | string | null;
  readonly precio_por_porcion?: number | string | null;
  readonly presets_variable_qr?: unknown;
  readonly solo_presets_variable?: boolean | null;
}

const centavosDe = (pesos: number | string | null | undefined): bigint | null => {
  const n = Number(pesos);
  return pesos === null || pesos === undefined || !Number.isFinite(n)
    ? null
    : BigInt(Math.round(n * 100));
};

function pesoMasChico(p: PlatilloConPrecio): number | null {
  const presets = Array.isArray(p.presets_variable_qr)
    ? p.presets_variable_qr.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const minimo = Number(p.cantidad_minima_variable);
  const candidatos =
    p.solo_presets_variable === true && presets.length > 0 ? presets : [...presets, minimo];
  const validos = candidatos.filter((n) => Number.isFinite(n) && n > 0);
  return validos.length === 0 ? null : Math.min(...validos);
}

/** Lo menos que cuesta un renglón sin opciones (`null` si no hay un piso que revisar aquí). */
export function pisoDelPlatillo(p: PlatilloConPrecio): bigint | null {
  if (p.tipo_venta === 'porcion_contenedor') return centavosDe(p.precio_por_porcion);
  if (p.tipo_venta === 'variable_medida') {
    const peso = pesoMasChico(p);
    const porUnidad = centavosDe(p.precio_por_unidad_variable ?? p.precio_venta);
    return peso === null || porUnidad === null
      ? null
      : BigInt(Math.round(Number(porUnidad) * peso));
  }
  return centavosDe(p.precio_venta);
}

function paraRevisar(g: GrupoEditable): GrupoParaRevisar {
  const entero = (t: string) => (t.trim() === '' ? null : Number(t));
  return {
    nombre: g.nombre,
    tipo: g.tipo,
    obligatorio: g.obligatorio,
    minimo: g.tipo === 'multiple' ? entero(g.minimo) : null,
    maximo: g.tipo === 'multiple' ? entero(g.maximo) : null,
    opciones: g.opciones
      .filter((o) => precioEsValido(o.precio))
      .map((o) => ({
        nombre: o.nombre,
        deltaCentavos: BigInt(Math.round(Number(precioAPesos(o.precio)) * 100)),
        activa: o.activa,
      })),
  };
}

/** El aviso para no guardar, o `null` si el platillo nunca baja de un centavo con sus opciones. */
export function problemaDePrecio(
  platillo: PlatilloConPrecio,
  grupos: readonly GrupoEditable[],
): string | null {
  const piso = pisoDelPlatillo(platillo);
  if (piso === null) return null;
  return opcionesQueDejanSinPrecio(
    { nombre: platillo.nombre ?? 'el platillo', precioMinimoCentavos: piso },
    grupos.filter((g) => g.activo).map(paraRevisar),
  );
}
