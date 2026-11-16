import type { Cubeta, PlanDelPeriodo } from '@morphiqpos/domain/tablero';

/**
 * EL ARMADO DE «¿CÓMO VA TU SEMANA?» (DP-21 · Bloque 13). Puro: sin base de datos.
 *
 * Recibe lo que el servidor sumó por cubeta (centavos enteros, por día del negocio) y arma las filas
 * del tablero: cada cubeta con sus ventas, sus cuentas, su ticket promedio, su costo y utilidad, y,
 * donde hay con qué compararla, la cubeta de antes y la diferencia. Una cubeta sin ventas sale en
 * CERO: el negocio a veces sólo abre en fin de semana.
 *
 * Todo en `bigint` de centavos; sale como texto (el navegador no suma dinero en coma flotante).
 */

/** Lo que se sumó de las cuentas vendidas de UNA cubeta. */
export interface SumaDeVentas {
  readonly cuentas: number;
  readonly ventasCentavos: bigint;
  /** La venta de las cuentas con costo conocido, y su costo: de ahí sale la utilidad. */
  readonly ventaConCostoCentavos: bigint;
  readonly costoCentavos: bigint;
  readonly sinReceta: number;
  readonly recetaIncompleta: number;
}

export const SIN_VENTAS: SumaDeVentas = {
  cuentas: 0,
  ventasCentavos: 0n,
  ventaConCostoCentavos: 0n,
  costoCentavos: 0n,
  sinReceta: 0,
  recetaIncompleta: 0,
};

export interface DeLaReferencia {
  readonly ventasCentavos: string;
  readonly cuentas: number;
  readonly ticketPromedioCentavos: string;
}

export interface FilaDelTablero {
  readonly clave: string;
  readonly etiqueta: string;
  readonly ventasCentavos: string;
  readonly cuentas: number;
  readonly ticketPromedioCentavos: string;
  /** `null` por hora: los gastos son del día, no de una hora. */
  readonly gastosCentavos: string | null;
  readonly costoCentavos: string;
  /** Sólo de las cuentas con costo conocido. */
  readonly utilidadBrutaCentavos: string;
  readonly referencia: DeLaReferencia | null;
  /** Ventas menos las de la referencia; `null` sin referencia. */
  readonly diferenciaCentavos: string | null;
}

export interface TotalesDelTablero {
  readonly ventasCentavos: string;
  readonly cuentas: number;
  readonly ticketPromedioCentavos: string;
  readonly costoCentavos: string;
  /** La venta de las cuentas con costo conocido: la base del margen. */
  readonly ventaConCostoCentavos: string;
  readonly utilidadBrutaCentavos: string;
  readonly gastosCentavos: string;
  readonly utilidadNetaCentavos: string;
  readonly sinReceta: number;
  readonly recetaIncompleta: number;
  /** Ninguna cuenta del periodo tiene costo completo: costo, utilidad y margen no existen. */
  readonly sinCostoConocido: boolean;
  readonly referencia: DeLaReferencia | null;
}

/** El ticket promedio, redondeado al centavo más cercano (mitades hacia arriba). */
export function ticketPromedio(ventasCentavos: bigint, cuentas: number): bigint {
  if (cuentas <= 0) return 0n;
  const n = BigInt(cuentas);
  return (ventasCentavos * 2n + n) / (n * 2n);
}

function deLaReferencia(suma: SumaDeVentas): DeLaReferencia {
  return {
    ventasCentavos: suma.ventasCentavos.toString(),
    cuentas: suma.cuentas,
    ticketPromedioCentavos: ticketPromedio(suma.ventasCentavos, suma.cuentas).toString(),
  };
}

function fila(
  cubeta: Cubeta,
  suma: SumaDeVentas,
  referencia: SumaDeVentas | null,
  gastos: bigint | null,
): FilaDelTablero {
  return {
    clave: cubeta.clave,
    etiqueta: cubeta.etiqueta,
    ventasCentavos: suma.ventasCentavos.toString(),
    cuentas: suma.cuentas,
    ticketPromedioCentavos: ticketPromedio(suma.ventasCentavos, suma.cuentas).toString(),
    gastosCentavos: gastos === null ? null : gastos.toString(),
    costoCentavos: suma.costoCentavos.toString(),
    utilidadBrutaCentavos: (suma.ventaConCostoCentavos - suma.costoCentavos).toString(),
    referencia: referencia === null ? null : deLaReferencia(referencia),
    diferenciaCentavos:
      referencia === null ? null : (suma.ventasCentavos - referencia.ventasCentavos).toString(),
  };
}

export interface Armado {
  readonly filas: readonly FilaDelTablero[];
  readonly totales: TotalesDelTablero;
}

/**
 * @param actual lo sumado por clave de cubeta del periodo;
 * @param deAntes lo sumado por clave de cubeta de la referencia (vacío si no hay);
 * @param gastos lo gastado por clave de cubeta (`null` si el periodo no los parte, como por hora);
 * @param gastosTotal lo gastado en todo el periodo.
 */
export function armarElTablero(
  plan: PlanDelPeriodo,
  actual: ReadonlyMap<string, SumaDeVentas>,
  deAntes: ReadonlyMap<string, SumaDeVentas>,
  gastos: ReadonlyMap<string, bigint> | null,
  gastosTotal: bigint,
  totalDeAntes: SumaDeVentas | null,
): Armado {
  const filas = plan.cubetas.map((c) =>
    fila(
      c,
      actual.get(c.clave) ?? SIN_VENTAS,
      plan.referencia === null || c.claveReferencia === null
        ? null
        : (deAntes.get(c.claveReferencia) ?? SIN_VENTAS),
      gastos === null ? null : (gastos.get(c.clave) ?? 0n),
    ),
  );
  let ventas = 0n;
  let costo = 0n;
  let conCosto = 0n;
  let cuentas = 0;
  let sinReceta = 0;
  let incompleta = 0;
  for (const s of actual.values()) {
    ventas += s.ventasCentavos;
    costo += s.costoCentavos;
    conCosto += s.ventaConCostoCentavos;
    cuentas += s.cuentas;
    sinReceta += s.sinReceta;
    incompleta += s.recetaIncompleta;
  }
  const utilidadBruta = conCosto - costo;
  return {
    filas,
    totales: {
      ventasCentavos: ventas.toString(),
      cuentas,
      ticketPromedioCentavos: ticketPromedio(ventas, cuentas).toString(),
      costoCentavos: costo.toString(),
      ventaConCostoCentavos: conCosto.toString(),
      utilidadBrutaCentavos: utilidadBruta.toString(),
      gastosCentavos: gastosTotal.toString(),
      utilidadNetaCentavos: (utilidadBruta - gastosTotal).toString(),
      sinReceta,
      recetaIncompleta: incompleta,
      sinCostoConocido: sinReceta + incompleta > 0 && conCosto === 0n,
      referencia: totalDeAntes === null ? null : deLaReferencia(totalDeAntes),
    },
  };
}
