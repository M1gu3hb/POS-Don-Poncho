import { ZONA_DEL_NEGOCIO, fechaYHoraDelNegocio } from '@morphiqpos/domain/tiempo';

/**
 * DP-15.1 · «HOY» DEL TABLERO ES EL DÍA DEL NEGOCIO.
 *
 * `startOfDay(new Date())` usaba la medianoche del NAVEGADOR: un aparato con otra zona (o mal
 * puesto) contaba otro día que el restaurante. El día del negocio es el de la zona del negocio
 * (`ZONA_DEL_NEGOCIO`, America/Mexico_City). Puro: el reloj entra como argumento.
 *
 * La zona de CDMX no tiene horario de verano desde 2022, así que el día mide 24 h exactas; si la
 * zona del negocio cambiara por una con cambio de hora, habría que resolver ese día de 23/25 h.
 */

/** Lo máximo que pide el Tablero de una vez a `Venta.enRango`. */
export const TOPE_DE_VENTAS_DEL_DIA = 1000;

const MS_POR_DIA = 86_400_000;

/** «2026-11-14» en la zona del negocio. */
export function fechaDelNegocio(ahora: Date, zona: string = ZONA_DEL_NEGOCIO): string {
  return fechaYHoraDelNegocio(ahora, zona).slice(0, 10);
}

/** Milisegundos transcurridos desde la medianoche del negocio. */
function msDesdeLaMedianoche(ahora: Date, zona: string): number {
  const [, hora = '00:00:00'] = fechaYHoraDelNegocio(ahora, zona).split(' ');
  const [h = 0, m = 0, s = 0] = hora.split(':').map(Number);
  const msSueltos = ((ahora.getTime() % 1000) + 1000) % 1000;
  return ((h * 60 + m) * 60 + s) * 1000 + msSueltos;
}

/** El instante (ms) en que empezó el día del negocio que contiene a `ahora`. */
export function inicioDelDiaDelNegocio(ahora: Date, zona: string = ZONA_DEL_NEGOCIO): number {
  return ahora.getTime() - msDesdeLaMedianoche(ahora, zona);
}

/** Cuánto falta para que empiece el siguiente día del negocio. */
export function msHastaElSiguienteDia(ahora: Date, zona: string = ZONA_DEL_NEGOCIO): number {
  return MS_POR_DIA - msDesdeLaMedianoche(ahora, zona);
}

/**
 * El aviso cuando la lectura llegó justo al tope: lo que hay detrás del tope no se sumó y los
 * totales serían mudos. Por debajo del tope no hay nada que avisar.
 */
export function avisoDelTopeDeVentas(recibidas: number): string | null {
  return recibidas >= TOPE_DE_VENTAS_DEL_DIA
    ? `Se muestran las primeras ${String(TOPE_DE_VENTAS_DEL_DIA)} ventas; los totales pueden estar incompletos.`
    : null;
}
