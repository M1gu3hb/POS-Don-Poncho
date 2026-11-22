'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso } from '@morphiqpos/ui/sistema';
import { useEffect, useRef, type ReactElement } from 'react';

import { consultarPuente } from '~/cliente/api';

import { avisoDeCuentaCerrada, type AvisoDeCuentaCerrada } from './cuenta-cerrada-por-otro.ts';

/**
 * DP-25 · Parte 3 · 3.5 · VIGILA LA CUENTA QUE EL MESERO TIENE ABIERTA.
 *
 * Si otra persona la cancela o la cobra, el mesero se entera: se llama a `alCerrarse` UNA vez con
 * lo que pasó (y la pantalla regresa al mapa). Lee el estado de la cuenta cada pocos segundos, no
 * el de la mesa: la mesa también cambia al abrirla o pasarla y daba falsas alarmas. No pinta nada.
 */

export const CADA_CUANTO_SE_VIGILA = 4_000;

interface FilaDeCuenta {
  readonly id: string;
  readonly estado: string | null;
}

export function VigilaLaCuenta({
  ventaId,
  numeroMesa,
  alCerrarse,
}: {
  readonly ventaId: string | null;
  readonly numeroMesa: number | string;
  readonly alCerrarse: (aviso: AvisoDeCuentaCerrada) => void;
}): null {
  const { data: estado } = useQuery({
    queryKey: ['cuenta_vigilada', ventaId],
    queryFn: async () => {
      const filas = await consultarPuente<FilaDeCuenta>('Venta', {
        filtro: { id: ventaId },
        limite: 1,
      });
      return filas[0]?.estado ?? null;
    },
    enabled: ventaId !== null,
    refetchInterval: CADA_CUANTO_SE_VIGILA,
    staleTime: 0,
  });
  const yaAviso = useRef<string | null>(null);
  useEffect(() => {
    if (ventaId === null || yaAviso.current === ventaId) return;
    const aviso = avisoDeCuentaCerrada(numeroMesa, estado);
    if (aviso === null) return;
    yaAviso.current = ventaId;
    alCerrarse(aviso);
  }, [ventaId, numeroMesa, estado, alCerrarse]);
  return null;
}

/** El aviso que queda en el mapa después de volver: se quita con su botón. */
export function AvisoDeCuentaCerradaEnElMapa({
  aviso,
  alQuitar,
}: {
  readonly aviso: AvisoDeCuentaCerrada;
  readonly alQuitar: () => void;
}): ReactElement {
  return (
    <div data-aviso-de-cuenta-cerrada>
      <Aviso
        tono={aviso.tono}
        titulo={aviso.mensaje}
        accion={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={alQuitar}
            className="any-pointer-coarse:min-h-(--altura-tactil)"
          >
            Entendido
          </Button>
        }
      />
    </div>
  );
}
