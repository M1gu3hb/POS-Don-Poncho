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

/**
 * DP-14.6-7 · «Comprobando la cocina…» tiene tiempo límite. Si la lectura no contesta en 8 s el
 * diálogo deja de esperar: dice que no pudo comprobarla, ofrece «Reintentar» y, como no se sabe qué
 * ya salió, la cancelación se hace con el PIN de un gerente, dueño o administrador, y el diálogo
 * manda `sinComprobarLaCocina`: el servidor cuenta TODO lo vivo como ya hecho (pérdida en el corte
 * y merma en el almacén) y exige esa autorización (`restaurante/cancelar-con-permiso.ts`).
 */
export const TIEMPO_LIMITE_DE_LA_COCINA_MS = 8_000;

/** El estado de la cocina una vez pasado (o no) el tiempo límite de la comprobación. */
export function cocinaTrasElTiempo(
  cocina: EstadoDeLaCocina | undefined,
  vencido: boolean,
): EstadoDeLaCocina | undefined {
  return vencido && cocina === 'comprobando' ? 'sin_comprobar' : cocina;
}

/**
 * ¿Cancelar exige ya el PIN de un gerente porque la cocina no se pudo comprobar? Igual si la
 * lectura falló de inmediato que si no contestó a tiempo.
 */
export function exigePinPorLaCocina(
  cocina: EstadoDeLaCocina | undefined,
  vencido: boolean,
): boolean {
  return cocina === 'sin_comprobar' || (vencido && cocina === 'comprobando');
}
