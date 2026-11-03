import { ErrorApi } from '~/cliente/api';

/**
 * CANCELAR CON LAS REGLAS DEL SERVIDOR, del lado de la pantalla (DP-13.2).
 *
 * El servidor decide (`restaurante/cancelar-con-permiso.ts`): con la cuenta ya pedida o la
 * precuenta impresa, quien no es gerente necesita su PIN, firmado para ESA cuenta. La pantalla no
 * lo adivina: cuando el servidor contesta que el puesto no alcanza (`PUESTO_NO_OTORGABLE`), el
 * mismo diálogo pide el PIN y vuelve a intentar con la autorización.
 *
 * Y el aviso de pérdida («la cocina ya preparó X») no se enseña a ciegas: antes de cancelar se
 * vuelve a leer la cocina; mientras, se espera, y si la lectura falla se dice que no se pudo
 * comprobar, en vez de callar como si nada se hubiera preparado.
 */

/** ¿El servidor rechazó porque hace falta el PIN de un gerente o del dueño? */
export function pideElPinDelSupervisor(error: unknown): boolean {
  return error instanceof ErrorApi && error.error.datos?.['regla'] === 'PUESTO_NO_OTORGABLE';
}

export type EstadoDeLaCocina = 'comprobando' | 'comprobada' | 'sin_comprobar';

export const NO_PUDE_COMPROBAR_LA_COCINA = 'No pude comprobar la cocina';
export const SI_NO_PUDE_COMPROBARLA =
  'Si ya preparó algo, queda como pérdida en el corte, con tu nombre y el motivo.';

/** Lo que el diálogo sabe de la cocina en este momento. */
export function estadoDeLaCocina(lectura: {
  /** Se está releyendo para este diálogo. */
  readonly comprobando: boolean;
  /** Ya hubo al menos una lectura, buena o mala. */
  readonly leida: boolean;
  /** El motivo de la última lectura fallida, o `null`. */
  readonly fallo: string | null;
}): EstadoDeLaCocina {
  if (lectura.comprobando || !lectura.leida) return 'comprobando';
  return lectura.fallo === null ? 'comprobada' : 'sin_comprobar';
}
