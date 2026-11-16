/**
 * LOS PERIODOS DEL TABLERO (DP-21 · Bloque 13 · M7 y M8). Puro.
 *
 * «¿Cómo va tu semana?» pinta barras por cubeta: lunes a domingo (por omisión), las 24 horas de hoy,
 * los días del mes o los meses del año. Cada cubeta de la semana, de hoy y del mes se compara con la
 * suya de antes (el mismo día de la semana pasada, la misma hora del mismo día de la semana pasada, el
 * mismo número de día del mes pasado); el año, no.
 *
 * Todo son FECHAS DE CALENDARIO del negocio (`AAAA-MM-DD`, en `ZONA_DEL_NEGOCIO`): quien llama dice
 * qué día es «hoy» en esa zona y aquí sólo se cuenta en el calendario, así que el navegador no decide
 * qué día es. El servidor agrupa las ventas con estas mismas claves (`tablero.serie`).
 */

export type PeriodoDelTablero = 'hoy' | 'semana' | 'mes' | 'anio';
export const PERIODOS_DEL_TABLERO: readonly PeriodoDelTablero[] = ['hoy', 'semana', 'mes', 'anio'];

export type Agrupacion = 'hora' | 'dia' | 'mes';

export interface Cubeta {
  /** `HH`, `AAAA-MM-DD` o `AAAA-MM`: con la que el servidor agrupa. */
  readonly clave: string;
  readonly etiqueta: string;
  /** La cubeta contra la que se compara, o `null` si no existe (el 31 en un mes de 30, el año). */
  readonly claveReferencia: string | null;
}

export interface Rango {
  readonly desde: string;
  readonly hasta: string;
}

export interface PlanDelPeriodo {
  readonly periodo: PeriodoDelTablero;
  readonly agrupar: Agrupacion;
  readonly desde: string;
  readonly hasta: string;
  readonly referencia: Rango | null;
  readonly cubetas: readonly Cubeta[];
}

/** Los colores de cada serie: tokens del tema (claro, oscuro y motor viejo), nunca `color-mix`. */
export const tablaDeColores = {
  ventas: 'bg-primario',
  referencia: 'bg-borde-fuerte',
  gastos: 'bg-peligro',
  utilidad: 'bg-exito',
} as const;

const NOMBRE_DEL_DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;
const NOMBRE_DEL_MES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

const aUtc = (fecha: string): Date => {
  const [a = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};

const aTexto = (fecha: Date): string => fecha.toISOString().slice(0, 10);

const dos = (n: number): string => String(n).padStart(2, '0');

/** `fecha` más `dias` días de calendario. */
export function sumarDias(fecha: string, dias: number): string {
  const f = aUtc(fecha);
  f.setUTCDate(f.getUTCDate() + dias);
  return aTexto(f);
}

const diasDelMes = (anio: number, mes: number): number =>
  new Date(Date.UTC(anio, mes, 0)).getUTCDate();

function planDeLaSemana(hoy: string): PlanDelPeriodo {
  const dia = aUtc(hoy).getUTCDay();
  const lunes = sumarDias(hoy, -((dia + 6) % 7));
  const cubetas: Cubeta[] = Array.from({ length: 7 }, (_, i) => {
    const clave = sumarDias(lunes, i);
    return {
      clave,
      etiqueta: NOMBRE_DEL_DIA[aUtc(clave).getUTCDay()] ?? clave,
      claveReferencia: sumarDias(clave, -7),
    };
  });
  const domingo = sumarDias(lunes, 6);
  return {
    periodo: 'semana',
    agrupar: 'dia',
    desde: lunes,
    hasta: domingo,
    referencia: { desde: sumarDias(lunes, -7), hasta: sumarDias(domingo, -7) },
    cubetas,
  };
}

function planDeHoy(hoy: string): PlanDelPeriodo {
  const cubetas: Cubeta[] = Array.from({ length: 24 }, (_, hora) => ({
    clave: dos(hora),
    etiqueta: `${String(hora)}h`,
    claveReferencia: dos(hora),
  }));
  const pasada = sumarDias(hoy, -7);
  return {
    periodo: 'hoy',
    agrupar: 'hora',
    desde: hoy,
    hasta: hoy,
    referencia: { desde: pasada, hasta: pasada },
    cubetas,
  };
}

function planDelMes(hoy: string): PlanDelPeriodo {
  const [anio = 0, mes = 1] = hoy.split('-').map(Number);
  const anioPasado = mes === 1 ? anio - 1 : anio;
  const mesPasado = mes === 1 ? 12 : mes - 1;
  const total = diasDelMes(anio, mes);
  const totalPasado = diasDelMes(anioPasado, mesPasado);
  const cubetas: Cubeta[] = Array.from({ length: total }, (_, i) => {
    const dia = i + 1;
    return {
      clave: `${String(anio)}-${dos(mes)}-${dos(dia)}`,
      etiqueta: String(dia),
      claveReferencia:
        dia <= totalPasado ? `${String(anioPasado)}-${dos(mesPasado)}-${dos(dia)}` : null,
    };
  });
  return {
    periodo: 'mes',
    agrupar: 'dia',
    desde: `${String(anio)}-${dos(mes)}-01`,
    hasta: `${String(anio)}-${dos(mes)}-${dos(total)}`,
    referencia: {
      desde: `${String(anioPasado)}-${dos(mesPasado)}-01`,
      hasta: `${String(anioPasado)}-${dos(mesPasado)}-${dos(totalPasado)}`,
    },
    cubetas,
  };
}

function planDelAnio(hoy: string): PlanDelPeriodo {
  const anio = Number(hoy.slice(0, 4));
  const cubetas: Cubeta[] = Array.from({ length: 12 }, (_, i) => ({
    clave: `${String(anio)}-${dos(i + 1)}`,
    etiqueta: NOMBRE_DEL_MES[i] ?? String(i + 1),
    claveReferencia: null,
  }));
  return {
    periodo: 'anio',
    agrupar: 'mes',
    desde: `${String(anio)}-01-01`,
    hasta: `${String(anio)}-12-31`,
    referencia: null,
    cubetas,
  };
}

/** El plan del periodo, para el día del negocio `hoy` (`AAAA-MM-DD`). */
export function planDelPeriodo(periodo: PeriodoDelTablero, hoy: string): PlanDelPeriodo {
  switch (periodo) {
    case 'hoy':
      return planDeHoy(hoy);
    case 'semana':
      return planDeLaSemana(hoy);
    case 'mes':
      return planDelMes(hoy);
    case 'anio':
      return planDelAnio(hoy);
  }
}
