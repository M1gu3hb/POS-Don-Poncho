'use client';

import { useCallback, useRef, useState } from 'react';

import {
  resultadoDeUnError,
  type EstadoDePrueba,
  type ResultadoDePrueba,
} from './resultado-de-prueba.ts';

export interface CorredorDePruebas {
  /** El estado de cada prueba por su clave: «enviando» o su resultado. */
  readonly estados: Readonly<Record<string, EstadoDePrueba>>;
  /** Hay una prueba corriendo: todos los botones esperan (una impresora, un trabajo a la vez). */
  readonly ocupado: boolean;
  /** Corre la tarea si no hay otra en curso; un segundo toque no cuenta. */
  correr(clave: string, tarea: () => Promise<ResultadoDePrueba>): Promise<void>;
}

/**
 * UNA PRUEBA A LA VEZ (DP-20 · laboratorio). Cada botón pasa por «Enviando…» y termina con su
 * resultado; mientras una corre, ninguna otra acepta toques. Un fallo inesperado se enseña, no se
 * calla.
 */
export function useCorredorDePruebas(): CorredorDePruebas {
  const [estados, setEstados] = useState<Readonly<Record<string, EstadoDePrueba>>>({});
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);

  const correr = useCallback(
    async (clave: string, tarea: () => Promise<ResultadoDePrueba>): Promise<void> => {
      if (enCurso.current) return;
      enCurso.current = true;
      setOcupado(true);
      setEstados((antes) => ({ ...antes, [clave]: { fase: 'enviando' } }));
      let resultado: ResultadoDePrueba;
      try {
        resultado = await tarea();
      } catch (error: unknown) {
        resultado = resultadoDeUnError(error);
      }
      setEstados((antes) => ({
        ...antes,
        [clave]: { fase: 'listo', ok: resultado.ok, texto: resultado.texto },
      }));
      enCurso.current = false;
      setOcupado(false);
    },
    [],
  );

  return { estados, ocupado, correr };
}
