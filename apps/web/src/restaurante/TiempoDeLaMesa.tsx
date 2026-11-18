'use client';

import { Superficie } from '@morphiqpos/ui/sistema';
import { Clock } from 'lucide-react';

import { useAhora } from '../cocina/use-ahora';

import { tiempoDeLaMesa, type MesaConCuenta } from './tiempo-de-la-mesa';

/**
 * DP-D177 · «35 min» EN LA TESELA DE LA MESA (plano del mesero).
 *
 * Dos formas, una por plano:
 * - `tarjeta` (la rejilla del teléfono): un renglón más en la tarjeta, con su reloj.
 * - `plano` (el mapa de tableta y PC): una pastilla CHICA que cuelga bajo el borde de la mesa, fuera
 *   de ella, para no apretar lo que la mesa ya dice (estado, mesero, personas). Va dentro de la
 *   mesa-botón, así que tocarla abre la mesa como cualquier otro punto de la tesela.
 *
 * El texto lleva siempre los minutos escritos; el reloj es adorno (`aria-hidden`) y el nombre
 * accesible dice «Abierta hace 35 min». Sin cuenta, sin fecha o sin reloj todavía, no pinta nada.
 */

export interface TiempoDeLaMesaProps {
  readonly mesa: MesaConCuenta;
  readonly forma: 'tarjeta' | 'plano';
  /** El color del texto de la tesela (el del estado), para que la tarjeta lo herede. */
  readonly color?: string;
}

export function TiempoDeLaMesa({ mesa, forma, color }: TiempoDeLaMesaProps) {
  const ahora = useAhora();
  const tiempo = tiempoDeLaMesa(mesa, ahora);
  if (tiempo === null) return null;

  if (forma === 'tarjeta') {
    return (
      <span
        data-tiempo-de-la-mesa={tiempo.minutos}
        className="mt-1 flex items-center gap-1 text-xs font-semibold tabular-nums"
        style={color === undefined ? undefined : { color }}
      >
        <Clock aria-hidden="true" className="size-3 shrink-0" />
        <span aria-hidden="true">{tiempo.texto}</span>
        <span className="sr-only">{tiempo.etiqueta}</span>
      </span>
    );
  }
  return (
    <Superficie
      como="span"
      nivel={1}
      radio="completo"
      relleno={0}
      data-tiempo-de-la-mesa={tiempo.minutos}
      className="pointer-events-none absolute top-full left-1/2 z-[1] mt-0.5 flex -translate-x-1/2 items-center gap-0.5 px-1.5 py-px text-xs leading-tight font-bold whitespace-nowrap tabular-nums"
    >
      <Clock aria-hidden="true" className="size-2.5 shrink-0" />
      <span aria-hidden="true">{tiempo.texto}</span>
      <span className="sr-only">{tiempo.etiqueta}</span>
    </Superficie>
  );
}
