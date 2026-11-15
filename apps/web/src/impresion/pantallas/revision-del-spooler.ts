/**
 * LA REVISIÓN DEL SPOOLER DE WINDOWS (DP-20 · laboratorio). Puro.
 *
 * Antes de imprimir en crudo, la app de Windows le pregunta al spooler si la impresora está lista
 * (sin papel, tapa abierta, fuera de línea): así el error se dice en la pantalla en vez de dejar
 * el ticket atorado en la cola. Pero hay drivers que dicen «fuera de línea» de una impresora que
 * sí está conectada, y entonces no saldría nada. Para ese aparato la revisión se apaga
 * (`ajustes.verificarSpooler = false`). Encendida mientras nadie diga lo contrario.
 */

export const AJUSTE_DE_LA_REVISION = 'verificarSpooler';

export function revisaElSpooler(
  ajustes: Readonly<Record<string, unknown>> | null | undefined,
): boolean {
  return ajustes?.[AJUSTE_DE_LA_REVISION] !== false;
}

/** Sólo aplica a la impresora instalada en Windows que recibe los bytes en crudo. */
export function aplicaLaRevision(conexion: string): boolean {
  return conexion === 'spooler';
}
