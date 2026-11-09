/**
 * EL PAPEL DEL TICKET, 58 O 80 MM (DP-15 · F2, auditoría 2 M7). Puro.
 *
 * El negocio elige el rollo de su impresora térmica (`ancho_papel_ticket`). De ahí salen la
 * página que se le dice al navegador (`@page`), el ancho del ticket y su letra:
 *
 *   · 80 mm: página de 80, margen de 4 → el ticket mide 72 y, con 2 de relleno, el texto útil 68.
 *   · 58 mm: página de 58, margen de 3 → el ticket mide 52 y, con 2 de relleno, el texto útil 48.
 */

export type AnchoDelPapel = 58 | 80;

export const ANCHO_POR_OMISION: AnchoDelPapel = 80;
export const ANCHOS_DEL_PAPEL: readonly AnchoDelPapel[] = [58, 80];

/** Lo que valga —58, '58'— se entiende; lo demás es el rollo de siempre, el de 80. */
export function anchoDelPapel(valor: unknown): AnchoDelPapel {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  return n === 58 ? 58 : ANCHO_POR_OMISION;
}

export interface MedidasDelTicket {
  readonly papelMm: AnchoDelPapel;
  readonly margenMm: number;
  /** El ancho de la caja del ticket (papel − 2 márgenes). */
  readonly cajaMm: number;
  readonly rellenoMm: number;
  /** Donde cabe el texto: caja − 2 rellenos. */
  readonly utilMm: number;
  /** Tamaño base de letra en px; el de 58 es más chico para que no se parta cada renglón. */
  readonly letraPx: number;
}

export function medidasDelTicket(ancho: AnchoDelPapel): MedidasDelTicket {
  const margenMm = ancho === 58 ? 3 : 4;
  const rellenoMm = 2;
  const cajaMm = ancho - margenMm * 2;
  return {
    papelMm: ancho,
    margenMm,
    cajaMm,
    rellenoMm,
    utilMm: cajaMm - rellenoMm * 2,
    letraPx: ancho === 58 ? 9.5 : 11,
  };
}

export type ModoDeImpresion = 'thermal' | 'letter';

/** La regla `@page` que `print.js` inyecta antes de imprimir. */
export function paginaDeImpresion(modo: ModoDeImpresion, ancho: AnchoDelPapel): string {
  if (modo === 'letter') return '@page { size: A4; margin: 12mm; }';
  const { papelMm, margenMm } = medidasDelTicket(ancho);
  return `@page { size: ${String(papelMm)}mm auto; margin: ${String(margenMm)}mm; }`;
}

/** El ancho que dice un nodo del ticket por su clase (`thermal-58` / `thermal-80`). */
export function anchoDeLasClases(clases: string | readonly string[]): AnchoDelPapel {
  const lista = typeof clases === 'string' ? clases.split(/\s+/) : clases;
  return lista.includes('thermal-58') ? 58 : ANCHO_POR_OMISION;
}
