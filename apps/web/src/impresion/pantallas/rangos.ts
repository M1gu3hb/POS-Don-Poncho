/**
 * LOS RANGOS DEL FORMULARIO Y EL ENTERO TECLEADO (DP-20 · laboratorio). Puro.
 *
 * Los mismos límites que el esquema del perfil (`esquemaDelPerfil`); aquí se dicen en español,
 * campo por campo, para que un valor fuera de rango se rechace con su mensaje y no con un error de
 * esquema.
 */
import { FRANJA_MAXIMA } from '../termico/escpos.ts';

export type Rango = readonly [minimo: number, maximo: number];

export const RANGOS = {
  puerto: [1, 65_535],
  baudios: [1200, 921_600],
  puntos: [200, 1200],
  umbral: [1, 254],
  franjaFilas: [1, FRANJA_MAXIMA],
  bloqueBytes: [64, 65_536],
  pausaMs: [0, 2000],
  lineasAntesDelCorte: [0, 20],
  pulsoMs: [2, 510],
} as const satisfies Readonly<Record<string, Rango>>;

export const PUERTO_DE_RED_POR_OMISION = 9100;
export const BAUDIOS_POR_OMISION = 9600;
export const LARGO_MAXIMO_DEL_NOMBRE = 60;

export type Entero =
  { readonly ok: true; readonly valor: number } | { readonly ok: false; readonly mensaje: string };

/** Un entero tecleado: sólo dígitos, dentro del rango. Todo lo demás se rechaza con su mensaje. */
export function entero(texto: string, etiqueta: string, [minimo, maximo]: Rango): Entero {
  const limpio = texto.trim();
  const valor = /^\d+$/.test(limpio) ? Number(limpio) : Number.NaN;
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    return {
      ok: false,
      mensaje: `${etiqueta}: escribe un número entero entre ${String(minimo)} y ${String(maximo)}.`,
    };
  }
  return { ok: true, valor };
}
