/**
 * «IVA» DE LA CONFIGURACIÓN (DP-21 · Bloque 1). Puro.
 *
 * Vive en `configuracion.valores.impuesto` (la tasa en puntos base y si va incluida en el
 * precio): la misma clave con la que el servidor cotiza y cobra. Lo guardan el dueño o el
 * administrador con `configuracion.fijar_impuesto`.
 *
 * El campo de antes («IVA / Impuesto (%)») guardaba `iva_porcentaje`, que nadie leía. Esa clave
 * se retiró: aquí no se mira.
 */

export interface IvaDelNegocio {
  readonly puntosBase: number;
  readonly incluidoEnPrecio: boolean;
}

/** Con lo que cobra un negocio que nunca lo tocó: 16 % incluido en el precio. */
export const IVA_DE_UN_NEGOCIO_NUEVO: IvaDelNegocio = { puntosBase: 1600, incluidoEnPrecio: true };

/** Las tres tasas que el servidor sabe cobrar (las del dominio: 0, 800 y 1600 puntos base). */
export const OPCIONES_DE_IVA: readonly {
  readonly puntosBase: 0 | 800 | 1600;
  readonly nombre: string;
}[] = [
  { puntosBase: 0, nombre: 'Sin IVA' },
  { puntosBase: 800, nombre: '8 %' },
  { puntosBase: 1600, nombre: '16 %' },
];

/** La llave de la consulta: cuelga de `configuracion`, que se refresca al guardar. */
export const CLAVE_DEL_IVA = ['configuracion', 'impuesto'] as const;

export function tasaConocida(puntosBase: number): puntosBase is 0 | 800 | 1600 {
  return OPCIONES_DE_IVA.some((opcion) => opcion.puntosBase === puntosBase);
}

/** Lo que diga la configuración; lo que falte o no se entienda, lo de un negocio nuevo. */
export function ivaLeido(
  configuracion: { readonly impuesto?: unknown } | undefined | null,
): IvaDelNegocio {
  const leido = configuracion?.impuesto;
  if (typeof leido !== 'object' || leido === null) return IVA_DE_UN_NEGOCIO_NUEVO;
  const { puntosBase, incluidoEnPrecio } = leido as Record<string, unknown>;
  if (typeof puntosBase !== 'number' || !Number.isInteger(puntosBase) || puntosBase < 0) {
    return IVA_DE_UN_NEGOCIO_NUEVO;
  }
  return {
    puntosBase,
    incluidoEnPrecio:
      typeof incluidoEnPrecio === 'boolean'
        ? incluidoEnPrecio
        : IVA_DE_UN_NEGOCIO_NUEVO.incluidoEnPrecio,
  };
}

/** Elegir una tasa. Sin IVA no hay nada que incluir ni que sumar: queda «incluido». */
export function ivaConTasa(iva: IvaDelNegocio, puntosBase: 0 | 800 | 1600): IvaDelNegocio {
  return puntosBase === 0
    ? { puntosBase: 0, incluidoEnPrecio: true }
    : { puntosBase, incluidoEnPrecio: iva.incluidoEnPrecio };
}

/** El interruptor «Los precios ya incluyen el IVA». Sin IVA no se mueve. */
export function ivaConIncluido(iva: IvaDelNegocio, incluidoEnPrecio: boolean): IvaDelNegocio {
  return iva.puntosBase === 0 ? iva : { puntosBase: iva.puntosBase, incluidoEnPrecio };
}

export function ivaIgual(a: IvaDelNegocio, b: IvaDelNegocio): boolean {
  return a.puntosBase === b.puntosBase && a.incluidoEnPrecio === b.incluidoEnPrecio;
}

/** Lo que viaja a `configuracion.fijar_impuesto`, o `null` si la tasa no es de las tres. */
export function entradaDelIva(
  iva: IvaDelNegocio,
): { readonly puntosBase: 0 | 800 | 1600; readonly incluidoEnPrecio: boolean } | null {
  return tasaConocida(iva.puntosBase)
    ? { puntosBase: iva.puntosBase, incluidoEnPrecio: iva.incluidoEnPrecio }
    : null;
}

/** «16 %», «8 %», «15.5 %»: la tasa como se dice. */
export function tasaEnTexto(puntosBase: number): string {
  return `${(puntosBase / 100).toLocaleString('es-MX', { maximumFractionDigits: 2 })} %`;
}

/** Qué le pasa a una cuenta con este IVA, dicho para quien lo va a guardar. */
export function explicacionDelIva(iva: IvaDelNegocio): string {
  if (iva.puntosBase === 0) {
    return 'El IVA no se cobra y no aparece en ningún ticket, precuenta, corte ni reporte.';
  }
  const tasa = tasaEnTexto(iva.puntosBase);
  if (iva.incluidoEnPrecio) {
    return `El precio de la carta ya lleva el ${tasa}: no cambia el total. El ticket sólo dice cuánto de lo cobrado es «IVA incluido».`;
  }
  const ejemplo = (100 + iva.puntosBase / 100).toFixed(2);
  return `El ${tasa} se suma al precio de la carta: un platillo de $100.00 se cobra en $${ejemplo}.`;
}
