import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';

import { rangoDelPeriodo, type RangoDePeriodo } from './periodo-de-registros.ts';

/**
 * A23 · LAS PROPINAS DE REGISTROS EN EL NAVEGADOR. Puro.
 *
 * `propinas.del_rango` suma el rango ENTERO en el servidor (centavos enteros, por mesero, sin el
 * tope de filas del puente). Aquí sólo se arma el rango que la persona eligió, se pide, y se lee lo
 * que contesta; no se suma dinero y no se agrupa nada. La lista de detalle sí viene topada: se dice.
 */

export type RangoDePropinas = 'today' | 'week' | 'quincena' | 'month' | 'custom';
export type EstadoDePropinas = 'todas' | 'pendientes' | 'liquidadas';

/** El rango como lo eligió la persona, en hora local. Una fecha rota cae a hoy, no a «Invalid Date». */
export function rangoDeLasPropinas(
  rango: RangoDePropinas,
  desde: string,
  hasta: string,
  ahora: Date = new Date(),
): RangoDePeriodo {
  if (rango === 'today') return { from: startOfDay(ahora), to: endOfDay(ahora) };
  if (rango === 'week') {
    return {
      from: startOfWeek(ahora, { weekStartsOn: 1 }),
      to: endOfWeek(ahora, { weekStartsOn: 1 }),
    };
  }
  if (rango === 'quincena') return { from: startOfDay(subDays(ahora, 14)), to: endOfDay(ahora) };
  if (rango === 'month') return { from: startOfMonth(ahora), to: endOfMonth(ahora) };
  // Personalizado: los días `yyyy-MM-dd` se leen en hora LOCAL (nunca `new Date('2026-11-10')`).
  return rangoDelPeriodo('custom', desde, hasta, ahora);
}

export interface PeticionDePropinas {
  readonly desde: string;
  readonly hasta: string;
  readonly estado: EstadoDePropinas;
  readonly meseroId: string | null;
}

/** El cuerpo de la petición. «Todos los meseros» (`__all__`) es sin mesero. */
export function peticionDeLasPropinas(
  rango: RangoDePeriodo,
  estado: EstadoDePropinas,
  meseroElegido: string,
): PeticionDePropinas {
  return {
    desde: rango.from.toISOString(),
    hasta: rango.to.toISOString(),
    estado,
    meseroId: meseroElegido === '__all__' || meseroElegido === '' ? null : meseroElegido,
  };
}

export interface PropinaDeVentaDelServidor {
  readonly ordenId: string;
  readonly serie: string;
  readonly folio: string | null;
  readonly cerradaEn: string;
  readonly mesaNumero: number | null;
  readonly meseroId: string | null;
  readonly meseroNombre: string;
  readonly metodoPago: string;
  readonly liquidada: boolean;
  readonly origen: string | null;
  readonly propinaCentavos: string;
}

export interface PropinasDelServidor {
  readonly desde: string;
  readonly hasta: string;
  readonly estado: EstadoDePropinas;
  readonly meseroId: string | null;
  readonly totalCentavos: string;
  readonly pendientesCentavos: string;
  readonly liquidadasCentavos: string;
  readonly numeroVentas: number;
  readonly meseros: readonly {
    readonly meseroId: string | null;
    readonly meseroNombre: string;
    readonly propinaCentavos: string;
    readonly numeroVentas: number;
  }[];
  readonly ventas: readonly PropinaDeVentaDelServidor[];
  readonly hayMasVentas: boolean;
}

const CENTAVOS_POR_PESO = 100;

/** Centavos enteros (texto del servidor) a pesos, sólo para pintar. */
const enPesos = (centavos: string): number => Number(centavos) / CENTAVOS_POR_PESO;

export interface TotalesDePropinas {
  readonly total: number;
  readonly pendientes: number;
  readonly liquidadas: number;
  readonly nVentas: number;
}

export function totalesDeLasPropinas(respuesta: PropinasDelServidor): TotalesDePropinas {
  return {
    total: enPesos(respuesta.totalCentavos),
    pendientes: enPesos(respuesta.pendientesCentavos),
    liquidadas: enPesos(respuesta.liquidadasCentavos),
    nVentas: respuesta.numeroVentas,
  };
}

/** Lo de cada mesero, en el orden del servidor (de más a menos), con la forma que ya pinta la tarjeta. */
export function desgloseDeLasPropinas(respuesta: PropinasDelServidor) {
  return respuesta.meseros.map((m) => ({
    mesero_id: m.meseroId,
    mesero_nombre: m.meseroNombre,
    total: enPesos(m.propinaCentavos),
    num_ventas: m.numeroVentas,
  }));
}

/** Si la lista de detalle viene topada, lo dice: los totales y el reparto por mesero sí cuentan todas. */
export function avisoDeLasPropinas(respuesta: PropinasDelServidor): string | null {
  if (!respuesta.hayMasVentas) return null;
  const mostradas = respuesta.ventas.length.toLocaleString('es-MX');
  const total = respuesta.numeroVentas.toLocaleString('es-MX');
  return (
    `Se muestran las ${mostradas} propinas más recientes de ${total}; ` +
    'los totales y lo de cada mesero sí cuentan todas. Elige un rango más corto para ver el detalle de las demás.'
  );
}
