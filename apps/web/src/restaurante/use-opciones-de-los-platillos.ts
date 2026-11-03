'use client';

import { useQuery } from '@tanstack/react-query';

import { invocarComando } from '~/cliente/api';

import {
  CLAVE_DE_LAS_OPCIONES,
  RUTA_DE_LAS_OPCIONES,
  type OpcionesPorPlatillo,
} from './opciones-de-los-platillos';

const SIN_OPCIONES: OpcionesPorPlatillo = {};

/**
 * QA1-4 (DP-13.5) · Las opciones de toda la carta, en una lectura. `listas` es falso hasta que
 * llegan: el mesero no agrega un platillo antes, porque sin ellas no sabría si pide su relleno.
 */
export function useOpcionesDeLosPlatillos(): {
  readonly opciones: OpcionesPorPlatillo;
  readonly listas: boolean;
} {
  const consulta = useQuery({
    queryKey: CLAVE_DE_LAS_OPCIONES,
    queryFn: ({ signal }) =>
      invocarComando<OpcionesPorPlatillo>(RUTA_DE_LAS_OPCIONES, {}, { signal }),
    staleTime: 30_000,
  });
  return { opciones: consulta.data ?? SIN_OPCIONES, listas: consulta.data !== undefined };
}
