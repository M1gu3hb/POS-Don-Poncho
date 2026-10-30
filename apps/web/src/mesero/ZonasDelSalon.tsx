'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso } from '@morphiqpos/ui/sistema';
import { UtensilsCrossed } from 'lucide-react';
import type { ReactElement } from 'react';

export interface ZonaConMesas {
  readonly zona: string;
  readonly count: number;
}

/**
 * LAS PESTAÑAS DE ZONA: «Interior (7)», «Terraza (3)»… Con una sola zona no hay nada que elegir y
 * no se pintan. Cada una es un botón con su nombre (la prueba de navegador lo busca por
 * `^Zona\b`) y `aria-pressed`: la elegida lo dice con el estado, no sólo con el color.
 */
export function ZonasDelSalon({
  zonas,
  zonaActiva,
  alElegir,
}: {
  readonly zonas: readonly ZonaConMesas[];
  readonly zonaActiva: string;
  readonly alElegir: (zona: string) => void;
}): ReactElement | null {
  if (zonas.length <= 1) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {zonas.map(({ zona, count }) => (
        <Button
          key={zona}
          type="button"
          size="sm"
          variant={zona === zonaActiva ? 'default' : 'outline'}
          aria-pressed={zona === zonaActiva}
          onClick={() => {
            alElegir(zona);
          }}
          className="shrink-0"
        >
          {zona} <span className="opacity-80">({count})</span>
        </Button>
      ))}
    </div>
  );
}

/** Un mesero con la asignación encendida y sin una sola mesa suya: por qué el mapa está vacío. */
export function AvisoSinMesasAsignadas(): ReactElement {
  return (
    <Aviso tono="atencion" titulo="No tienes mesas asignadas" icono={<UtensilsCrossed />}>
      Pide al administrador que te asigne mesas desde Configuración → Mesas.
    </Aviso>
  );
}
