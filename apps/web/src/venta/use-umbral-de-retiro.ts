'use client';

import { useQuery } from '@tanstack/react-query';

import { consultarPuente } from '~/cliente/api';

import { CLAVE_DEL_UMBRAL_DE_RETIRO, umbralDeRetiroLeido } from './pin-en-retiros.ts';

/** DP-16 · El umbral de «pedir PIN en retiros», leído de la configuración del negocio. */
async function leer(): Promise<number | null> {
  const [configuracion] = await consultarPuente<{ retiro_pin_arriba_de_centavos?: unknown }>(
    'ConfiguracionNegocio',
    { limite: 1 },
  );
  return umbralDeRetiroLeido(configuracion);
}

/** `undefined` mientras se lee; `null` si no hay umbral. */
export function useUmbralDeRetiro(): number | null | undefined {
  const consulta = useQuery({
    queryKey: CLAVE_DEL_UMBRAL_DE_RETIRO,
    queryFn: leer,
    staleTime: 30_000,
  });
  return consulta.data;
}
