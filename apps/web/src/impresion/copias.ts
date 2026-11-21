/**
 * «COPIAS DEL TICKET DE VENTA» EN LA PANTALLA (DP-20 · refuerzo §3). Puro.
 *
 * Viven en `configuracion.valores.copias_de_impresion` (ticket, precuenta y corte: de 1 a 3, 1
 * por omisión). Las cambia el dueño o el administrador con `caja.fijar_copias_de_impresion`.
 */

export interface CopiasDeImpresion {
  readonly ticket: number;
  readonly precuenta: number;
  readonly corte: number;
}

export const COPIAS_MINIMAS = 1;
export const COPIAS_MAXIMAS = 3;
export const COPIAS_POR_OMISION: CopiasDeImpresion = { ticket: 1, precuenta: 1, corte: 1 };

export const CLAVE_DE_LAS_COPIAS = ['configuracion', 'copias_de_impresion'] as const;

function una(valor: unknown): number {
  return typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= COPIAS_MINIMAS &&
    valor <= COPIAS_MAXIMAS
    ? valor
    : COPIAS_MINIMAS;
}

/** Lo que diga la configuración; lo que falte o no se entienda vale 1. */
export function copiasLeidas(
  configuracion: { readonly copias_de_impresion?: unknown } | undefined | null,
): CopiasDeImpresion {
  const leido = configuracion?.copias_de_impresion;
  if (typeof leido !== 'object' || leido === null) return COPIAS_POR_OMISION;
  const { ticket, precuenta, corte } = leido as Record<string, unknown>;
  return { ticket: una(ticket), precuenta: una(precuenta), corte: una(corte) };
}

/** Los documentos que salen al rollo. */
export const DOCUMENTOS_TERMICOS = ['ticket', 'precuenta', 'corte', 'cierre'] as const;
export type DocumentoTermico = (typeof DOCUMENTOS_TERMICOS)[number];

export function esDocumentoTermico(valor: unknown): valor is DocumentoTermico {
  return typeof valor === 'string' && (DOCUMENTOS_TERMICOS as readonly string[]).includes(valor);
}

/** Cuántas copias lleva un documento. El Cierre del día va con las del corte. */
export function copiasDe(copias: CopiasDeImpresion, documento: DocumentoTermico): number {
  return documento === 'cierre' ? copias.corte : copias[documento];
}
