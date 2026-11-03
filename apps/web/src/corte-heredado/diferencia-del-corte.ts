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
