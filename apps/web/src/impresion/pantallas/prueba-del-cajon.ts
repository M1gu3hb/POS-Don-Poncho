/**
 * LA PRUEBA DEL CAJÓN EN EL LABORATORIO (DP-21 · Bloque 7). Puro.
 *
 * «Este aparato tiene cajón de dinero» no es una casilla que se marca porque sí: se enciende
 * cuando la persona manda el pulso de prueba y confirma que el cajón se abrió («¿Se abrió el
 * cajón?» · Sí). Con «No» se queda apagado y se dice qué revisar. Y lo confirmado era de ESE pulso:
 * si después se cambia el pin, el modo o los tiempos, el interruptor se apaga y hay que volver a
 * probar.
 */
import type { FormularioDelPerfil } from './formulario.ts';

export const QUE_REVISAR_SI_NO_ABRIO =
  'Revisa que el cajón esté conectado a la impresora (el cable va a la entrada del cajón, no a la de la red), que no tenga el seguro puesto y que no esté ya abierto. Si todo está bien, prueba con el otro pin (2 o 5) o con el otro modo del pulso.';

export const CAMPOS_DEL_PULSO = [
  'cajonPin',
  'cajonModo',
  'cajonEncendidoMs',
  'cajonApagadoMs',
] as const;

export type CambioDelPulso = Partial<Pick<FormularioDelPerfil, (typeof CAMPOS_DEL_PULSO)[number]>>;

/** Cambiar el pulso invalida lo que se confirmó: el interruptor se apaga hasta volver a probar. */
export function conElPulso(
  formulario: FormularioDelPerfil,
  cambio: CambioDelPulso,
): FormularioDelPerfil {
  return { ...formulario, ...cambio, tieneCajon: false };
}

export function conElCajonApagado(formulario: FormularioDelPerfil): FormularioDelPerfil {
  return { ...formulario, tieneCajon: false };
}

export interface RespuestaDelCajon {
  readonly formulario: FormularioDelPerfil;
  /** Lo que se le dice a la persona; vacío si todo está bien. */
  readonly mensaje: string;
}

/** La respuesta a «¿Se abrió el cajón?». Sólo «Sí» enciende el interruptor. */
export function conLaRespuestaDelCajon(
  formulario: FormularioDelPerfil,
  seAbrio: boolean,
): RespuestaDelCajon {
  return seAbrio
    ? { formulario: { ...formulario, tieneCajon: true }, mensaje: '' }
    : { formulario: { ...formulario, tieneCajon: false }, mensaje: QUE_REVISAR_SI_NO_ABRIO };
}
