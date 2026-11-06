'use client';

import { useQuery } from '@tanstack/react-query';

import { invocarComando } from '~/cliente/api';

import {
  CLAVE_DE_LAS_OPCIONES,
  RUTA_DE_LAS_OPCIONES,
  type OpcionesPorPlatillo,
} from './opciones-de-los-platillos';

const SIN_OPCIONES: OpcionesPorPlatillo = {};

/** La consulta de las opciones, para `useQuery` y para esperarla (`ensureQueryData`). */
export function consultaDeLasOpciones() {
  return {
    queryKey: CLAVE_DE_LAS_OPCIONES,
    queryFn: ({ signal }: { readonly signal: AbortSignal }) =>
      invocarComando<OpcionesPorPlatillo>(RUTA_DE_LAS_OPCIONES, {}, { signal }),
    staleTime: 30_000,
  };
}

/**
 * QA1-4 (DP-13.5) · Las opciones de toda la carta, en una lectura. `listas` es falso hasta que
 * llegan: el mesero las espera antes de agregar, porque sin ellas no sabría si pide su relleno.
 */
export function useOpcionesDeLosPlatillos(): {
  readonly opciones: OpcionesPorPlatillo;
  readonly listas: boolean;
} {
  const consulta = useQuery(consultaDeLasOpciones());
  return { opciones: consulta.data ?? SIN_OPCIONES, listas: consulta.data !== undefined };
}
