import { centavos, formatear } from '../dinero/index.ts';

/**
 * LO QUE SE DICE DEL EFECTIVO QUE SALE DE LA CAJA (DP-21 · Bloque 11 · A11 y H4). Puro.
 *
 * Se queda la regla DP-D115 (un gasto o una compra en efectivo sale del cajón de la caja abierta y,
 * sin caja abierta, no se registra); lo que cambia es que se VE: de qué caja sale, qué hacer si no
 * salió de ahí y un aviso, antes de guardar, si el pago dejaría el efectivo esperado en negativo.
 * Las frases viven aquí para que la Caja, Compras y gastos y sus pruebas digan lo mismo.
 */

export type MetodoDeGasto = 'efectivo' | 'tarjeta' | 'transferencia';

/** «Pagado en efectivo de Caja principal», «Pagado con tarjeta», «Pagado por transferencia». */
export function frasePagado(metodo: string, nombreDeLaCaja: string | null): string {
  if (metodo === 'efectivo') {
    return nombreDeLaCaja === null || nombreDeLaCaja === ''
      ? 'Pagado en efectivo'
      : `Pagado en efectivo de ${nombreDeLaCaja}`;
  }
  if (metodo === 'tarjeta') return 'Pagado con tarjeta';
  if (metodo === 'transferencia') return 'Pagado por transferencia';
  return `Pagado: ${metodo}`;
}

export const SI_NO_SALIO_DE_LA_CAJA =
  '¿No salió de la caja? Regístralo como transferencia o tarjeta';

/** De qué caja sale el efectivo: la de este aparato, o, si no tiene, la única otra abierta. */
export function fraseDeDondeSale(nombreDeLaCaja: string, esDeEsteAparato: boolean): string {
  return esDeEsteAparato
    ? `Sale del cajón de ${nombreDeLaCaja}`
    : `Este aparato no tiene caja propia: sale del cajón de ${nombreDeLaCaja}`;
}

/**
 * El aviso de antes de guardar, o `null` si el efectivo esperado alcanza. Aviso, no bloqueo: quien
 * lo registra puede haber pagado de otro bolsillo.
 */
export function avisoDeEfectivoNegativo(
  esperadoCentavos: bigint,
  montoCentavos: bigint,
): string | null {
  if (esperadoCentavos - montoCentavos >= 0n) return null;
  const hay = esperadoCentavos > 0n ? esperadoCentavos : 0n;
  return `La caja sólo tiene ${formatear(centavos(hay), 'MXN')}. ¿Lo pagaste de la caja? Si no, regístralo con transferencia o tarjeta`;
}

/** El renglón del corte: lo que sacaron los gastos y las compras en efectivo. */
export const RENGLON_DE_COMPRAS_Y_GASTOS = 'Compras y gastos pagados de la caja';
