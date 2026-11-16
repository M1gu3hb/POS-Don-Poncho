'use client';

import { avisoDeEfectivoNegativo } from '@morphiqpos/domain/gastos';
import { useQuery } from '@tanstack/react-query';

import { invocarComando } from '~/cliente/api';

/**
 * DE QUÉ CAJA SALDRÍA EL EFECTIVO (DP-21 · Bloque 11 · A11 y H4).
 *
 * Lo dice el servidor (`gastos.cajon_para_pagar`): la caja de este aparato o, si no tiene, la única
 * otra abierta, con el nombre que le puso el dueño y el efectivo esperado que hay en ella. La Caja y
 * Compras y gastos lo leen igual para decir «Sale del cajón de Caja principal» y para avisar, antes de
 * guardar, si el pago dejaría el efectivo en negativo. Es una lectura: nunca bloquea.
 */

export interface CajonParaPagar {
  readonly caso: 'una' | 'ninguna' | 'varias';
  readonly caja: {
    readonly sesionCajaId: string;
    readonly nombre: string;
    readonly esDeEsteAparato: boolean;
    readonly esperadoCentavos: string;
  } | null;
}

export type LecturaDelCajon =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'fallo' }
  | { readonly estado: 'listo'; readonly cajon: CajonParaPagar };

export const CLAVE_DEL_CAJON = ['gastos', 'cajon_para_pagar'] as const;

/** Lee el cajón cuando `activo` (p. ej. el pago es «Efectivo»); cada vez que se activa se relee. */
export function useCajonParaPagar(activo: boolean): LecturaDelCajon {
  const consulta = useQuery({
    queryKey: CLAVE_DEL_CAJON,
    queryFn: ({ signal }) =>
      invocarComando<CajonParaPagar>('/api/gastos/cajon-para-pagar', {}, { signal }),
    enabled: activo,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  if (consulta.data !== undefined) return { estado: 'listo', cajon: consulta.data };
  return consulta.isError ? { estado: 'fallo' } : { estado: 'cargando' };
}

/** El aviso de «la caja sólo tiene $X», o `null` si alcanza (o no se pudo leer el esperado). */
export function avisoAntesDeGuardar(
  lectura: LecturaDelCajon,
  montoCentavos: number,
): string | null {
  if (lectura.estado !== 'listo' || lectura.cajon.caja === null) return null;
  if (!Number.isFinite(montoCentavos) || montoCentavos <= 0) return null;
  return avisoDeEfectivoNegativo(
    BigInt(lectura.cajon.caja.esperadoCentavos),
    BigInt(Math.round(montoCentavos)),
  );
}
