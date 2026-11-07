import { ErrorApi } from '~/cliente/api';

/**
 * LO QUE LA PANTALLA DEL DESCUENTO SABE DEL PIN QUE ACABA DE AUTORIZAR (DP-14 ronda 2, medio 5).
 *
 * El servidor decide (`puedeAutorizar`, `venta/descuento-de-mostrador.ts`): quien autoriza tiene que
 * cubrir el descuento ENTERO con su propio tope, en pesos Y en porcentaje. La pantalla repite esa
 * regla —igual de exacta, en cruz y sin dividir— sólo para no dejar aplicar lo que el servidor va a
 * rechazar y para decir hasta dónde llega ese PIN. El tope viene del servidor
 * (`/api/identidad/supervisor`), nunca de la pantalla.
 */

export interface TopeDelPin {
  /** En centavos y en texto (un `bigint` no viaja en JSON). */
  readonly topeCentavos: string;
  /** En puntos base: 3000 = 30 %. */
  readonly topeBp: number;
}

const CIEN_POR_CIENTO_BP = 10_000n;

/** ¿Cubre este tope el descuento entero sobre esa base? Es `puedeAutorizar` del dominio. */
export function elTopeCubre(centavos: number, base: number, tope: TopeDelPin): boolean {
  if (base <= 0) return false;
  const descuento = BigInt(centavos);
  if (descuento > BigInt(tope.topeCentavos)) return false;
  return descuento * CIEN_POR_CIENTO_BP <= BigInt(tope.topeBp) * BigInt(base);
}

/** Lo que limita primero ESTE PIN en una cuenta: el porcentaje, los pesos, o nada (no autoriza). */
export type AlcanceDelPin =
  | { readonly tipo: 'porcentaje'; readonly bp: number }
  | { readonly tipo: 'pesos'; readonly centavos: number }
  | { readonly tipo: 'ninguno' };

/**
 * Hasta cuánto llega el PIN sobre esta base: lo que limita primero (el menor de los dos topes). Si
 * el porcentaje y los pesos dan lo mismo, manda el porcentaje. La pantalla lo pinta («Autoriza hasta
 * 30 %», «Autoriza hasta $2,000.00»); aquí no se formatea dinero para no tener otro formateador.
 */
export function hastaCuantoAutoriza(base: number, tope: TopeDelPin): AlcanceDelPin {
  const enPesos = BigInt(tope.topeCentavos);
  if (tope.topeBp <= 0 || enPesos <= 0n) return { tipo: 'ninguno' };
  const porPorcentaje = (BigInt(base) * BigInt(tope.topeBp)) / CIEN_POR_CIENTO_BP;
  return porPorcentaje <= enPesos
    ? { tipo: 'porcentaje', bp: tope.topeBp }
    : { tipo: 'pesos', centavos: Number(enPesos) };
}

/** 3000 → «30», 1250 → «12.5». */
export function porcentajeEnTexto(bp: number): string {
  return String(bp / 100);
}

/**
 * ¿El servidor rechazó la autorización misma? Por pasar del tope de quien autoriza, por vencida o
 * de otra cuenta u otro monto (`PUESTO_NO_OTORGABLE`), o por ya usada (`AUTORIZACION_USADA`): en
 * cualquiera de los tres hay que pedir el PIN otra vez.
 */
export function autorizacionInservible(error: unknown): boolean {
  if (!(error instanceof ErrorApi)) return false;
  const regla = error.error.datos?.['regla'];
  return regla === 'PUESTO_NO_OTORGABLE' || regla === 'AUTORIZACION_USADA';
}

/** El descuento que la cuenta ya tenía y este va a reemplazar, o `null` si no tenía. */
export function descuentoQueSeReemplaza(descuentoActualCentavos: number | null): number | null {
  return descuentoActualCentavos === null || descuentoActualCentavos <= 0
    ? null
    : descuentoActualCentavos;
}
