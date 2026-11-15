/**
 * LO QUE DICE LA VISTA PREVIA DEL PAPEL QUE SALDRÍA (DP-20 · laboratorio). Puro.
 *
 * Mide el papel que leyó la impresora falsa: cuántos puntos y milímetros, cuántos bytes y dónde
 * cortó. Lo que se ve en la vista es lo que la impresora falsa leyó de los bytes, no una
 * maqueta.
 */
import type { PapelImpreso } from '../termico/emulador.ts';
import { conMiles } from './resultado-de-prueba.ts';

const MM_POR_PULGADA = 25.4;

export interface ResumenDeLaVista {
  readonly medidas: string;
  readonly bytes: string;
  readonly cortes: string;
  readonly cajon: string | null;
}

const enMilimetros = (puntos: number, dpi: number): string =>
  (Math.round(((puntos * MM_POR_PULGADA) / dpi) * 10) / 10).toFixed(1);

export function resumenDeLaVista(
  papel: Pick<PapelImpreso, 'ancho' | 'alto' | 'cortes' | 'pulsos'>,
  bytes: number,
  dpi: number,
): ResumenDeLaVista {
  const ancho = `${conMiles(papel.ancho)} puntos`;
  const medidas =
    `${ancho} de ancho × ${conMiles(papel.alto)} de alto ` +
    `(${enMilimetros(papel.ancho, dpi)} × ${enMilimetros(papel.alto, dpi)} mm)`;
  const primero = papel.cortes[0];
  const cortes =
    primero === undefined
      ? 'Sin cortes'
      : papel.cortes.length === 1
        ? `Corta una vez, ${primero.parcial ? 'parcial' : 'completo'}, en la fila ${conMiles(primero.fila)}`
        : `Corta ${String(papel.cortes.length)} veces (una por copia)`;
  return {
    medidas,
    bytes: `${conMiles(bytes)} bytes`,
    cortes,
    cajon:
      papel.pulsos.length === 0
        ? null
        : `Pulsa el cajón ${String(papel.pulsos.length)} ${papel.pulsos.length === 1 ? 'vez' : 'veces'}`,
  };
}
