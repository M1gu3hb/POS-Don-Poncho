/**
 * DP-16 · 2.2 · EL TIEMPO DE ESPERA, CON COLOR Y CON TEXTO.
 *
 * Verde mientras la comanda va a tiempo, ámbar cuando ya tarda y rojo cuando tarda de más. Los
 * umbrales son del negocio (`configuracion.valores`: `cocina_alerta_ambar_min` y
 * `cocina_alerta_roja_min`); sin escribir, 10 y 20 minutos. El color NUNCA va solo: la tarjeta
 * siempre dice también los minutos.
 */

export interface Umbrales {
  readonly ambarMin: number;
  readonly rojoMin: number;
}

export type NivelDeEspera = 'verde' | 'ambar' | 'rojo';

export const UMBRALES_POR_OMISION: Umbrales = { ambarMin: 10, rojoMin: 20 };
export const CLAVE_AMBAR = 'cocina_alerta_ambar_min';
export const CLAVE_ROJA = 'cocina_alerta_roja_min';
/** Cuatro horas: más allá no es una alerta de cocina, es un dato mal tecleado. */
export const MAXIMO_DE_MINUTOS = 240;

const MS_POR_MINUTO = 60_000;

function entero(valor: unknown): number | null {
  return typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= 1 &&
    valor <= MAXIMO_DE_MINUTOS
    ? valor
    : null;
}

/** Los umbrales de la configuración; lo que no es válido, o no deja el rojo después del ámbar, vale lo de siempre. */
export function umbralesDeCocina(
  config: Readonly<Record<string, unknown>> | null | undefined,
): Umbrales {
  const ambar = entero(config?.[CLAVE_AMBAR]) ?? UMBRALES_POR_OMISION.ambarMin;
  const rojo = entero(config?.[CLAVE_ROJA]) ?? UMBRALES_POR_OMISION.rojoMin;
  return rojo > ambar ? { ambarMin: ambar, rojoMin: rojo } : UMBRALES_POR_OMISION;
}

/** ¿Los dos minutos son enteros de 1 a 240 y el rojo queda después del ámbar? (lo que Configuración deja guardar) */
export function alertasValidas(ambar: unknown, roja: unknown): boolean {
  const a = entero(ambar);
  const r = entero(roja);
  return a !== null && r !== null && r > a;
}

export function nivelDeEspera(minutos: number | null, umbrales: Umbrales): NivelDeEspera {
  if (minutos === null) return 'verde';
  if (minutos >= umbrales.rojoMin) return 'rojo';
  if (minutos >= umbrales.ambarMin) return 'ambar';
  return 'verde';
}

/** Minutos completos desde `desde` hasta `ahora` (ms). Nunca negativos; fecha ilegible, null. */
export function minutosTranscurridos(
  desde: string | null | undefined,
  ahora: number,
): number | null {
  if (desde === null || desde === undefined) return null;
  const inicio = Date.parse(desde);
  if (!Number.isFinite(inicio)) return null;
  return Math.max(0, Math.floor((ahora - inicio) / MS_POR_MINUTO));
}

/** «Ahora», «18 min», «1 h», «1 h 5 min». */
export function textoDeEspera(minutos: number | null): string {
  if (minutos === null) return '—';
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `${String(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${String(horas)} h` : `${String(horas)} h ${String(resto)} min`;
}
