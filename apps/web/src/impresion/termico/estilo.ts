/**
 * EL ESTILO DE IMPRESIÓN TÉRMICA (DP-20 · refuerzo §1.2). Puro.
 *
 * Una térmica quema o no quema: los grises, los degradados y las letras delgadas salen mal o no
 * salen. Por eso todo documento que va al rollo (ticket, precuenta, comanda, corte, Cierre) se
 * dibuja con estas reglas, y en pantalla se ve igual que en papel:
 *
 *   · negro puro sobre blanco;
 *   · una letra gruesa (peso 700) y nunca menor que la mínima legible;
 *   · separadores sólidos, no punteados;
 *   · medidas en PUNTOS de la impresora (8 por milímetro a 203 dpi): 1 px del lienzo = 1 punto.
 *
 * En pantalla el lienzo se achica con `zoom` para verse a su tamaño real en papel.
 */
import type { AnchoDelPapel } from '../papel.ts';

import { PAPEL, TINTA } from './colores-del-papel.ts';

export { PAPEL, TINTA };

/** 203 dpi son 8 puntos por milímetro (lo de casi toda térmica de tickets). */
export const PUNTOS_POR_MM = 8;

/** Cuántos px de pantalla ocupa un punto para que 576 puntos midan sus 72 mm. */
export const ESCALA_EN_PANTALLA = 96 / 25.4 / PUNTOS_POR_MM;

/** El ancho imprimible de siempre: 48 mm en el rollo de 58, 72 mm en el de 80. */
export function puntosDelPapel(ancho: AnchoDelPapel): number {
  return ancho === 58 ? 384 : 576;
}

/** Los puntos que manda el perfil del aparato, o los del rollo del negocio si no hay perfil. */
export function puntosDelLienzo(
  ancho: AnchoDelPapel,
  delPerfil: number | null | undefined,
): number {
  return typeof delPerfil === 'number' && delPerfil > 0 ? delPerfil : puntosDelPapel(ancho);
}

/** La letra más chica que una térmica de 203 dpi imprime legible, en puntos. */
export const LETRA_MINIMA = 21;

export interface LetraTermica {
  readonly chica: number;
  readonly base: number;
  readonly fuerte: number;
  readonly titulo: number;
  readonly total: number;
  readonly codigo: number;
}

/** El rollo angosto lleva la letra un poco más chica para que quepa el renglón. */
export function letraTermica(ancho: AnchoDelPapel): LetraTermica {
  return ancho === 58
    ? { chica: LETRA_MINIMA, base: 22, fuerte: 26, titulo: 30, total: 32, codigo: 46 }
    : { chica: 22, base: 24, fuerte: 28, titulo: 36, total: 36, codigo: 56 };
}

/** Fuentes del sistema, gruesas y sin remates: están en Windows y en Android sin descargar nada. */
export const FUENTE_TERMICA = "Arial, 'Helvetica Neue', Helvetica, Roboto, 'Noto Sans', sans-serif";

/** El separador: sólido y de 2 puntos (uno solo se pierde al quemar). */
export const LINEA_TERMICA = `2px solid ${TINTA}`;
export const LINEA_GRUESA = `4px solid ${TINTA}`;

/** El margen dentro del área imprimible, en puntos. */
export const RELLENO_TERMICO = 8;

/** Lo que mide el logo como máximo, en puntos. */
export function logoTermico(ancho: AnchoDelPapel): {
  readonly ancho: number;
  readonly alto: number;
} {
  return ancho === 58 ? { ancho: 200, alto: 110 } : { ancho: 280, alto: 140 };
}

/** El estilo del lienzo: lo que hace que el documento sea de papel. */
export function estiloDelLienzo(
  ancho: AnchoDelPapel,
  puntos: number,
): Record<string, string | number> {
  return {
    width: `${String(puntos)}px`,
    boxSizing: 'border-box',
    margin: '0 auto',
    padding: `${String(RELLENO_TERMICO)}px`,
    background: PAPEL,
    color: TINTA,
    fontFamily: FUENTE_TERMICA,
    fontWeight: 700,
    fontSize: `${String(letraTermica(ancho).base)}px`,
    lineHeight: 1.25,
    overflowWrap: 'anywhere',
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'left',
  };
}

/** El pie de cada copia (refuerzo §3): la primera es del cliente; las demás, del negocio. */
export function pieDeLaCopia(numero: number, total: number): string | null {
  if (total <= 1) return null;
  return numero === 1 ? 'ORIGINAL — CLIENTE' : 'COPIA — NEGOCIO';
}

/** «REIMPRESIÓN · 14 nov 2026 · 18:30», para que un ticket viejo no se reuse. */
export function rotuloDeReimpresion(cuando: Date): string {
  const fecha = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(cuando);
  const hora = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  }).format(cuando);
  return `${fecha} · ${hora}`;
}
