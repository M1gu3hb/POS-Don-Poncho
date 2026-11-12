/**
 * CUÁNDO TERMINA UN DÍA SIMULADO.
 *
 * Los minutos cuentan desde la medianoche de LA FECHA DEL DÍA y no vuelven a cero: pasadas las
 * 24:00 siguen creciendo (1440, 1500…). Con la hora del reloj (`minutoDelDia`), un día que se
 * pasara de la medianoche dejaba de estar terminado y los bots seguían dando vueltas (DP-18, el
 * primer ensayo con todo el personal).
 */
export interface EstadoDelDia {
  /** Minutos simulados desde la medianoche de la fecha del día. */
  readonly minuto: number;
  /** Desde qué minuto puede terminar (las 19:00, o el fin del ensayo). */
  readonly cierre: number;
  /** A qué minuto termina pase lo que pase. */
  readonly tope: number;
  /** Grupos por llegar, mesas ocupadas y cuentas por cobrar. */
  readonly pendientes: number;
  /** La orden de parar (Ctrl+C). */
  readonly parar: boolean;
}

export function minutosDesdeLaMedianoche(fecha: string, ahora: Date): number {
  return (ahora.getTime() - new Date(`${fecha}T00:00:00-06:00`).getTime()) / 60_000;
}

export function diaTerminado(e: EstadoDelDia): boolean {
  if (e.parar || e.minuto >= e.tope) return true;
  return e.minuto >= e.cierre && e.pendientes === 0;
}
