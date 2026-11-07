'use client';

import { useQuery } from '@tanstack/react-query';

import { invocarComando } from '~/cliente/api';

import {
  CLAVE_DE_LAS_OPCIONES,
  RUTA_DE_LAS_OPCIONES,
  TIEMPO_LIMITE_DE_LAS_OPCIONES_MS,
  guardarOpciones,
  leerOpcionesGuardadas,
  type OpcionesPorPlatillo,
} from './opciones-de-los-platillos';

const SIN_OPCIONES: OpcionesPorPlatillo = {};

/** La señal de la lectura más el tiempo límite: lo que llegue primero la corta. */
function conTiempoLimite(senal: AbortSignal): AbortSignal {
  const control = new AbortController();
  const cortar = () => {
    control.abort();
  };
  if (senal.aborted) cortar();
  else senal.addEventListener('abort', cortar, { once: true });
  setTimeout(cortar, TIEMPO_LIMITE_DE_LAS_OPCIONES_MS);
  return control.signal;
}

/**
 * La consulta de las opciones, para `useQuery` y para esperarla (`ensureQueryData`).
 *
 * DP-14.1-4 · Con tiempo límite (8 s) y sin reintentos automáticos: si falla o vence, quien la
 * pidió lo sabe en seguida y ofrece «Reintentar». Arranca con la última lectura buena del
 * navegador (marcada como vieja), así que una tableta que ya la leyó sigue sabiendo qué platillo
 * pide opciones aunque la red se corte; la lectura viva la sustituye en cuanto llega.
 */
export function consultaDeLasOpciones() {
  return {
    queryKey: CLAVE_DE_LAS_OPCIONES,
    queryFn: async ({ signal }: { readonly signal: AbortSignal }) => {
      const opciones = await invocarComando<OpcionesPorPlatillo>(
        RUTA_DE_LAS_OPCIONES,
        {},
        { signal: conTiempoLimite(signal) },
      );
      guardarOpciones(opciones);
      return opciones;
    },
    staleTime: 30_000,
    retry: false,
    initialData: leerOpcionesGuardadas,
    initialDataUpdatedAt: 0,
  };
}

/**
 * QA1-4 (DP-13.5) · Las opciones de toda la carta, en una lectura.
 *   · `listas`: hay un mapa (vivo o guardado): con él se sabe qué platillo pide opciones.
 *   · `frescas`: es la lectura viva de esta sesión. El editor de Productos lo exige: guardar
 *     reemplaza el juego entero y no debe partir de uno viejo.
 *   · `fallo`: la lectura viva falló o venció y no hay nada que enseñar en su lugar.
 */
export function useOpcionesDeLosPlatillos(): {
  readonly opciones: OpcionesPorPlatillo;
  readonly listas: boolean;
  readonly frescas: boolean;
  readonly fallo: boolean;
  readonly leyendo: boolean;
  readonly reintentar: () => void;
} {
  const consulta = useQuery(consultaDeLasOpciones());
  return {
    opciones: consulta.data ?? SIN_OPCIONES,
    listas: consulta.data !== undefined,
    frescas: consulta.data !== undefined && consulta.dataUpdatedAt > 0,
    fallo: consulta.isError,
    leyendo: consulta.isFetching,
    reintentar: () => {
      void consulta.refetch();
    },
  };
}
