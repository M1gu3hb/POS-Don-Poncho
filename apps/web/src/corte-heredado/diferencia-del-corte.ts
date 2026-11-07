/**
 * QA1-8 (DP-13.5) · LA DIFERENCIA DE EFECTIVO DE UN CORTE, sea el que acaba de armar la caja al
 * cerrar (`diferencia_efectivo`, de su arqueo) o el que llega del puente desde Registros
 * (`diferencia_al_cerrar`, la foto que guardó el cierre). Nula si ninguno la trae: un cierre viejo
 * sin la foto no se pinta como «$0.00 de diferencia».
 */
export interface CorteConDiferencia {
  readonly diferencia_efectivo?: number | null;
  readonly diferencia_al_cerrar?: number | null;
}

export function diferenciaDelCorte(corte: CorteConDiferencia | null | undefined): number | null {
  return corte?.diferencia_efectivo ?? corte?.diferencia_al_cerrar ?? null;
}

/**
 * DP-14.6 · El EFECTIVO ESPERADO al cierre, para que el PDF del corte lo traiga. El que acaba de
 * armar la caja lo trae (`efectivo_esperado`); el de Registros no (el puente lo descarta) y se
 * deduce de lo que sí guardó el cierre: lo contado menos la diferencia. Sin ninguno, nulo.
 */
export interface CorteConEsperado extends CorteConDiferencia {
  readonly efectivo_esperado?: number | null;
  readonly efectivo_contado?: number | null;
}

export function efectivoEsperadoDelCorte(
  corte: CorteConEsperado | null | undefined,
): number | null {
  if (corte === null || corte === undefined) return null;
  if (typeof corte.efectivo_esperado === 'number') return corte.efectivo_esperado;
  const diferencia = diferenciaDelCorte(corte);
  if (typeof corte.efectivo_contado !== 'number' || diferencia === null) return null;
  return Math.round((corte.efectivo_contado - diferencia) * 100) / 100;
}

/** Un dato del papel: el importe, o un guion si no hay dato (nunca «$0.00» por un nulo). */
export function dineroODato(
  valor: number | null | undefined,
  formato: (pesos: number) => string,
): string {
  return typeof valor === 'number' && Number.isFinite(valor) ? formato(valor) : '—';
}
