'use client';

import { useQuery } from '@tanstack/react-query';

import { consultarPuente } from '~/cliente/api';

/**
 * «PERMITIR DESCUENTOS» EN LA PANTALLA (DP-14.2, decisión DP-D61).
 *
 * Apagados, el botón del descuento no aparece en ninguna pantalla (Caja, el cobro de la mesa). El
 * servidor los rechaza igual (`DESCUENTOS_APAGADOS`): esto sólo evita ofrecer lo que no se puede.
 * Sin el campo en la configuración vale SÍ, como en el servidor. `null` mientras se lee: el botón
 * no se pinta hasta saberlo, para no aparecer y desaparecer.
 */

export const CLAVE_DE_DESCUENTOS_PERMITIDOS = ['configuracion', 'descuentos_permitidos'] as const;

export function permitidosEn(
  configuracion: { readonly descuentos_permitidos?: unknown } | undefined,
): boolean {
  return configuracion?.descuentos_permitidos !== false;
}

async function leer(): Promise<boolean> {
  const [configuracion] = await consultarPuente<{ descuentos_permitidos?: unknown }>(
    'ConfiguracionNegocio',
    { limite: 1 },
  );
  return permitidosEn(configuracion);
}

export function useDescuentosPermitidos(): boolean | null {
  const consulta = useQuery({
    queryKey: CLAVE_DE_DESCUENTOS_PERMITIDOS,
    queryFn: leer,
    staleTime: 30_000,
  });
  return consulta.data ?? null;
}
