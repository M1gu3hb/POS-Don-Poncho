'use client';

import { useId, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Superficie } from '@morphiqpos/ui/sistema';
import { PanelLeft } from 'lucide-react';

import { elegirLaBarra, useEleccionDeLaBarra } from '~/tacto/use-barra-lateral';

import { textoDeLaEleccion } from './barra-lateral-del-aparato.ts';

/**
 * CONFIGURACIÓN → ESTE APARATO · «Barra lateral» (DP-21 · Bloque 21, con el Bloque 9).
 *
 * Si la barra de navegación empieza abierta o plegada en ESTE aparato. Usa la misma elección que ya
 * recuerda el botón de la barra (`localStorage['mpos.barra-lateral']`, `tacto/barra-lateral.ts`):
 * no hay otra clave. Es del aparato, no del negocio: se guarda al tocarla.
 */
export function BarraLateralDelAparato(): ReactElement {
  const titulo = useId();
  const eleccion = useEleccionDeLaBarra();
  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={titulo}
      className="mt-(--espacio-4) flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex flex-col gap-(--espacio-1)">
        <h3 id={titulo} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
          <PanelLeft aria-hidden className="size-5 shrink-0 text-primario" />
          Barra lateral
        </h3>
        <p className="max-w-prose text-sm text-texto-sutil">{textoDeLaEleccion(eleccion)}</p>
      </div>
      <div role="radiogroup" aria-labelledby={titulo} className="flex flex-wrap gap-(--espacio-2)">
        {(['abierta', 'plegada'] as const).map((valor) => (
          <Button
            key={valor}
            type="button"
            role="radio"
            aria-checked={eleccion === valor}
            variant={eleccion === valor ? 'default' : 'outline'}
            className="min-w-32"
            onClick={() => {
              elegirLaBarra(valor);
            }}
          >
            {valor === 'abierta' ? 'Abierta' : 'Plegada'}
          </Button>
        ))}
      </div>
    </Superficie>
  );
}
