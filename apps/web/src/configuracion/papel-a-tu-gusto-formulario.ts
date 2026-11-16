import {
  AVISO_SIN_FOLIO,
  completarPapel,
  seEnsena,
  type IdDeCampo,
  type PapelATuGusto,
  type PapelDeVenta,
} from '@morphiqpos/domain/venta';

/**
 * «EL TICKET Y LA PRECUENTA A TU GUSTO» EN LA PANTALLA (DP-21 · Bloque 12). Puro.
 *
 * Viven en `configuracion.valores.papel_a_tu_gusto`; los guarda el dueño o el administrador con
 * `caja.fijar_papel_a_tu_gusto`. La regla (qué renglones hay, qué nunca se quita) vive en
 * `@morphiqpos/domain/venta`; aquí sólo se lee lo guardado y se arma lo que se elige.
 */

/** La llave de la consulta: cuelga de `configuracion`, que se refresca al guardar. */
export const CLAVE_DEL_PAPEL = ['configuracion', 'papel_a_tu_gusto'] as const;

/** Lo que dice la configuración; lo que falte o no se entienda sale (el papel de siempre). */
export function papelLeido(
  configuracion: { readonly papel_a_tu_gusto?: unknown } | undefined | null,
): PapelATuGusto {
  const crudo = configuracion?.papel_a_tu_gusto;
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) {
    return completarPapel(undefined);
  }
  return completarPapel(crudo as Parameters<typeof completarPapel>[0]);
}

/** El papel con un renglón encendido o apagado; el original no se toca. */
export function papelConCambio(
  papel: PapelATuGusto,
  cual: PapelDeVenta,
  campo: IdDeCampo,
  sale: boolean,
): PapelATuGusto {
  return { ...papel, [cual]: { ...papel[cual], [campo]: sale } };
}

/** Los avisos de lo que se eligió: hoy, uno solo, el del ticket sin folio. */
export function avisosDelPapel(papel: PapelATuGusto): readonly string[] {
  return seEnsena(papel, 'ticket', 'folio') ? [] : [AVISO_SIN_FOLIO];
}
