'use client';

import type { ReactElement } from 'react';

import { Hourglass } from 'lucide-react';

import { SeccionDelLab } from './campos';
import { TODAVIA_NO_DISPONIBLE } from './nombres.ts';

/**
 * 11 · TODAVÍA NO DISPONIBLE (DP-20 · laboratorio): lo que el encargo nombra y no llegó. Se ve
 * desactivado y con su razón, no se esconde.
 */
export function LabPendientes(): ReactElement {
  return (
    <SeccionDelLab
      titulo="Todavía no disponible"
      icono={<Hourglass aria-hidden className="size-5 shrink-0 text-texto-sutil" />}
      descripcion="Esto aún no está en el POS. No hace falta para imprimir: el ticket sale por imagen."
    >
      <ul className="flex flex-col gap-(--espacio-2)">
        {TODAVIA_NO_DISPONIBLE.map((pendiente) => (
          <li
            key={pendiente.titulo}
            aria-disabled="true"
            className="flex flex-col gap-(--espacio-1) rounded-md border border-dashed border-borde px-(--espacio-3) py-(--espacio-2) text-texto-sutil"
          >
            <span className="text-sm font-medium">{pendiente.titulo} · todavía no disponible</span>
            <span className="text-xs">{pendiente.motivo}</span>
          </li>
        ))}
      </ul>
    </SeccionDelLab>
  );
}
