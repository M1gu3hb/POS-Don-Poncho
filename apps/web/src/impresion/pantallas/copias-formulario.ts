/**
 * «COPIAS DEL TICKET DE VENTA…» EN OPERACIÓN (DP-20 · refuerzo §3). Puro.
 *
 * Tres números de 1 a 3 que se guardan juntos. Lo que no se entiende (0, 4, texto) no entra.
 */
import { COPIAS_MAXIMAS, COPIAS_MINIMAS, type CopiasDeImpresion } from '../copias.ts';

export type DocumentoConCopias = keyof CopiasDeImpresion;

export const DOCUMENTOS_CON_COPIAS: readonly {
  readonly clave: DocumentoConCopias;
  readonly nombre: string;
}[] = [
  { clave: 'ticket', nombre: 'Copias del ticket de venta' },
  { clave: 'precuenta', nombre: 'Copias de la precuenta' },
  { clave: 'corte', nombre: 'Copias del corte' },
];

export const OPCIONES_DE_COPIAS: readonly number[] = Array.from(
  { length: COPIAS_MAXIMAS - COPIAS_MINIMAS + 1 },
  (_, i) => COPIAS_MINIMAS + i,
);

/** Cambia un documento. Si el texto no es un entero de 1 a 3, devuelve las MISMAS copias. */
export function copiasConCambio(
  copias: CopiasDeImpresion,
  documento: DocumentoConCopias,
  texto: string,
): CopiasDeImpresion {
  const valor = /^\d+$/.test(texto.trim()) ? Number(texto) : Number.NaN;
  if (!Number.isInteger(valor) || valor < COPIAS_MINIMAS || valor > COPIAS_MAXIMAS) return copias;
  return { ...copias, [documento]: valor };
}

export function copiasIguales(a: CopiasDeImpresion, b: CopiasDeImpresion): boolean {
  return a.ticket === b.ticket && a.precuenta === b.precuenta && a.corte === b.corte;
}
