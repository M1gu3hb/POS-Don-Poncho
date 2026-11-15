/**
 * LO QUE DICE UNA PRUEBA AL TERMINAR (DP-20 · laboratorio). Puro.
 *
 * El resultado que contesta la app (`Resultado`) o el fin de un trabajo (`FinDelTrabajo`), vuelto
 * una frase: «Impreso ✓ · 120 ms · 4,321 bytes», o el fallo con qué pasó y qué hacer.
 */
import type { Resultado } from '../puente/contrato.ts';
import { falloDelPuente, type FinDelTrabajo, type Fallo } from '../trabajos.ts';

export interface MedidasDeLaPrueba {
  readonly ms?: number | undefined;
  readonly bytes?: number | undefined;
}

export interface ResultadoDePrueba {
  readonly ok: boolean;
  readonly texto: string;
}

export type EstadoDePrueba =
  | { readonly fase: 'enviando' }
  | { readonly fase: 'listo'; readonly ok: boolean; readonly texto: string };

/** 4321 → «4,321», sin depender del idioma del aparato. */
export function conMiles(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function textoDeMedidas(medidas: MedidasDeLaPrueba): string {
  const partes: string[] = [];
  if (medidas.ms !== undefined) partes.push(`${conMiles(medidas.ms)} ms`);
  if (medidas.bytes !== undefined) partes.push(`${conMiles(medidas.bytes)} bytes`);
  return partes.length === 0 ? '' : ` · ${partes.join(' · ')}`;
}

const textoDelFallo = (fallo: Fallo): string => `${fallo.titulo}. ${fallo.queHacer}`;

export function resultadoDelFin(
  fin: FinDelTrabajo,
  medidas: MedidasDeLaPrueba = {},
): ResultadoDePrueba {
  if (!fin.ok) return { ok: false, texto: textoDelFallo(fin.fallo) };
  const palabra = fin.estado === 'impreso' ? 'Impreso ✓' : 'Enviado ✓';
  return { ok: true, texto: `${palabra}${textoDeMedidas(medidas)}` };
}

export function resultadoDelPuente(
  resultado: Resultado,
  medidas: MedidasDeLaPrueba = {},
): ResultadoDePrueba {
  if (!resultado.ok) {
    return { ok: false, texto: textoDelFallo(falloDelPuente(resultado.codigo, resultado.mensaje)) };
  }
  const palabra =
    resultado.estado === 'impreso'
      ? 'Impreso ✓'
      : resultado.estado === 'duplicado'
        ? 'Enviado ✓ (la app ya lo tenía)'
        : 'Enviado ✓';
  return {
    ok: true,
    texto: `${palabra}${textoDeMedidas({ ms: medidas.ms ?? resultado.ms, bytes: medidas.bytes ?? resultado.bytes })}`,
  };
}

/** Un fallo inesperado (la app no contestó, el dibujo falló): se dice, no se calla. */
export function resultadoDeUnError(error: unknown): ResultadoDePrueba {
  const detalle = error instanceof Error && error.message !== '' ? error.message : null;
  return { ok: false, texto: detalle ?? 'La prueba falló por algo inesperado. Reintenta.' };
}
