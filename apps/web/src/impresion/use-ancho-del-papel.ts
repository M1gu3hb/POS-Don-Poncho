'use client';

import { useQuery } from '@tanstack/react-query';

import { consultarPuente } from '~/cliente/api';

import { anchoDelPapel, type AnchoDelPapel } from './papel.ts';

/**
 * «ANCHO DEL PAPEL DEL TICKET» EN LA PANTALLA (DP-15 · F2).
 *
 * Lo elige el negocio en Configuración (`ancho_papel_ticket`, 58 u 80 mm). Lo usan la precuenta
 * (que además se lo manda al servidor al imprimir) y, por su clase, el ticket heredado. Mientras
 * se lee, el rollo de siempre: 80.
 */

export const CLAVE_DEL_ANCHO_DEL_PAPEL = ['configuracion', 'ancho_papel_ticket'] as const;

async function leer(): Promise<AnchoDelPapel> {
  const [configuracion] = await consultarPuente<{ ancho_papel_ticket?: unknown }>(
    'ConfiguracionNegocio',
    { limite: 1 },
  );
  return anchoDelPapel(configuracion?.ancho_papel_ticket);
}

export function useAnchoDelPapel(): AnchoDelPapel {
  const consulta = useQuery({
    queryKey: CLAVE_DEL_ANCHO_DEL_PAPEL,
    queryFn: leer,
    staleTime: 30_000,
  });
  return consulta.data ?? anchoDelPapel(undefined);
}
