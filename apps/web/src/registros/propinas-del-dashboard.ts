import { endOfDay, startOfDay, subDays } from 'date-fns';

import {
  desgloseDeLasPropinas,
  totalesDeLasPropinas,
  type PropinasDelServidor,
} from './propinas-del-servidor.ts';

/**
 * LA TARJETA DE PROPINAS DEL DASHBOARD, CON LA SUMA DEL SERVIDOR. Puro.
 *
 * Leía las últimas 2 000 ventas pagadas del puente y sumaba en el navegador: pasado el tope las
 * propinas viejas desaparecían sin aviso, la misma falla que A23 cerró en Registros. Ahora pide a
 * `propinas.del_rango` (el MISMO comando que Registros, de dueño, administrador y gerente: son los
 * mismos que abren el Dashboard) tres rangos y sólo pinta lo que contesta; aquí no se suma dinero.
 *
 *   · hoy          → «Hoy»
 *   · la semana    → «Esta semana» y «Mesero top» (los últimos siete días, contando hoy)
 *   · el último año → «Pendientes» y «Liquidadas». Ya no son «de las últimas 2 000 ventas», que era
 *                    un corte arbitrario: son las del último año, que es lo más largo que el
 *                    servidor deja pedir (366 días) y lo que el diálogo de «Liquidar» alcanza.
 */

const DIAS_DE_LA_SEMANA = 7;
/**
 * Casi un año, contando hoy. El servidor rechaza más de 366 días (`DIAS_MAXIMOS_DE_RANGO`) y un
 * aparato con horario de verano suma una hora a ese cálculo: con 364 queda un día de margen.
 */
const DIAS_DEL_ANIO = 364;

export interface PeticionDelDashboard {
  readonly desde: string;
  readonly hasta: string;
  readonly estado: 'todas';
  readonly meseroId: null;
  /** Sólo importan los totales: del detalle basta un renglón (el mínimo que el servidor acepta). */
  readonly limite: 1;
}

export interface PeticionesDelDashboard {
  readonly hoy: PeticionDelDashboard;
  readonly semana: PeticionDelDashboard;
  readonly anio: PeticionDelDashboard;
}

function rangoHastaHoy(ahora: Date, dias: number): PeticionDelDashboard {
  return {
    desde: startOfDay(subDays(ahora, dias - 1)).toISOString(),
    hasta: endOfDay(ahora).toISOString(),
    estado: 'todas',
    meseroId: null,
    limite: 1,
  };
}

/** Los tres cuerpos de `/api/propinas/del-rango`, en hora local del aparato (como Registros). */
export function peticionesDelDashboard(ahora: Date = new Date()): PeticionesDelDashboard {
  return {
    hoy: rangoHastaHoy(ahora, 1),
    semana: rangoHastaHoy(ahora, DIAS_DE_LA_SEMANA),
    anio: rangoHastaHoy(ahora, DIAS_DEL_ANIO),
  };
}

export interface RespuestasDelDashboard {
  readonly hoy: PropinasDelServidor;
  readonly semana: PropinasDelServidor;
  readonly anio: PropinasDelServidor;
}

export interface ResumenDelDashboard {
  /** Hubo al menos una propina en el último año: si no, la tarjeta no se pinta. */
  readonly hayPropinas: boolean;
  readonly propinasHoy: number;
  readonly propinasSemana: number;
  readonly totalPendientes: number;
  readonly totalLiquidadas: number;
  readonly topMesero: { readonly mesero_nombre: string; readonly total: number } | null;
}

export function resumenDelDashboard(respuestas: RespuestasDelDashboard): ResumenDelDashboard {
  const anio = totalesDeLasPropinas(respuestas.anio);
  const primero = desgloseDeLasPropinas(respuestas.semana)[0];
  return {
    hayPropinas: respuestas.anio.numeroVentas > 0,
    propinasHoy: totalesDeLasPropinas(respuestas.hoy).total,
    propinasSemana: totalesDeLasPropinas(respuestas.semana).total,
    totalPendientes: anio.pendientes,
    totalLiquidadas: anio.liquidadas,
    topMesero:
      primero === undefined ? null : { mesero_nombre: primero.mesero_nombre, total: primero.total },
  };
}
