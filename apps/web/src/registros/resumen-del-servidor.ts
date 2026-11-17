import { format } from 'date-fns';

import type { EconomiaDelPeriodo } from '~/restaurante/margen-de-las-ventas';

import type { RangoDePeriodo } from './periodo-de-registros.ts';

/**
 * H3 · EL RESUMEN DE REGISTROS EN EL NAVEGADOR. Puro.
 *
 * Lo que llega de `registros.resumen` (agregado en el servidor: el periodo entero, en centavos
 * enteros, sin el tope de filas del puente) se vuelve lo que las tarjetas del resumen pintan. Aquí no
 * se suma dinero: el servidor ya lo sumó. Sólo se pide con los días del rango y se lee.
 */

export interface ResumenDelServidor {
  readonly desde: string;
  readonly hasta: string;
  readonly ventas: {
    readonly cuentas: number;
    readonly ventasCentavos: string;
    readonly ventaConCostoCentavos: string;
    readonly costoCentavos: string;
    readonly utilidadBrutaCentavos: string;
    readonly sinReceta: number;
    readonly recetaIncompleta: number;
  };
  readonly propinasCentavos: string;
  readonly compras: { readonly cantidad: number; readonly totalCentavos: string };
  readonly gastos: { readonly cantidad: number; readonly totalCentavos: string };
  readonly netoCentavos: string;
}

const CENTAVOS_POR_PESO = 100;
const PORCIENTO = 100;

/** Centavos enteros (texto del servidor) a pesos, sólo para pintar. */
const enPesos = (centavos: string): number => Number(centavos) / CENTAVOS_POR_PESO;

/** Los días del rango (hora local, como los eligió la persona) que se le piden al servidor. */
export function peticionDelResumen(rango: RangoDePeriodo): { desde: string; hasta: string } {
  return { desde: format(rango.from, 'yyyy-MM-dd'), hasta: format(rango.to, 'yyyy-MM-dd') };
}

export interface TotalesDelResumen {
  readonly ingresos: number;
  readonly nVentas: number;
  readonly nCompras: number;
  readonly nGastos: number;
  readonly propinas: number;
  readonly compras: number;
  readonly gastos: number;
  readonly neto: number;
  /** `null` si ninguna cuenta del periodo tiene costo completo: no existe, no es cero. */
  readonly utilidad: number | null;
}

function sinCostoConocido(resumen: ResumenDelServidor): boolean {
  const { cuentas, sinReceta, recetaIncompleta } = resumen.ventas;
  return cuentas > 0 && cuentas - sinReceta - recetaIncompleta <= 0;
}

export function totalesDelResumen(resumen: ResumenDelServidor): TotalesDelResumen {
  return {
    ingresos: enPesos(resumen.ventas.ventasCentavos),
    nVentas: resumen.ventas.cuentas,
    nCompras: resumen.compras.cantidad,
    nGastos: resumen.gastos.cantidad,
    propinas: enPesos(resumen.propinasCentavos),
    compras: enPesos(resumen.compras.totalCentavos),
    gastos: enPesos(resumen.gastos.totalCentavos),
    neto: enPesos(resumen.netoCentavos),
    utilidad: sinCostoConocido(resumen) ? null : enPesos(resumen.ventas.utilidadBrutaCentavos),
  };
}

/** La economía del periodo, con la forma que ya pintan «Utilidad bruta» y su margen. */
export function economiaDelResumen(resumen: ResumenDelServidor): EconomiaDelPeriodo {
  const { ventas } = resumen;
  const fuera = ventas.sinReceta + ventas.recetaIncompleta;
  const base = {
    ingresos: enPesos(ventas.ventasCentavos),
    ingresosConCosto: enPesos(ventas.ventaConCostoCentavos),
    conCosto: ventas.cuentas - fuera,
    sinReceta: ventas.sinReceta,
    recetaIncompleta: ventas.recetaIncompleta,
  };
  if (sinCostoConocido(resumen)) {
    return { estado: 'sin_receta', ...base, costo: null, utilidad: null, margen: null };
  }
  const conCosto = Number(ventas.ventaConCostoCentavos);
  return {
    estado: fuera > 0 ? 'parcial' : 'conocido',
    ...base,
    costo: enPesos(ventas.costoCentavos),
    utilidad: enPesos(ventas.utilidadBrutaCentavos),
    margen: conCosto > 0 ? (Number(ventas.utilidadBrutaCentavos) * PORCIENTO) / conCosto : null,
  };
}
