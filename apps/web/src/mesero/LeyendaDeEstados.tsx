import { Superficie } from '@morphiqpos/ui/sistema';
import type { ReactElement } from 'react';

import { ESTADOS_DE_LA_LEYENDA } from './colores-de-la-mesa';

/**
 * LA LEYENDA DE LOS ESTADOS: cada uno con su muestra de color Y su palabra. El color solo no dice
 * nada a quien no lo distingue; la palabra es lo que la prueba de navegador mide (4.5:1) sobre
 * la superficie del chip. La prueba de navegador la encuentra por `data-leyenda` y
 * `data-estado-de-la-leyenda`, no por una clase de estilo.
 */
export function LeyendaDeEstados(): ReactElement {
  return (
    <div data-leyenda="estados" className="flex flex-wrap gap-2">
      {ESTADOS_DE_LA_LEYENDA.map((estado) => (
        <Superficie
          key={estado.clave}
          nivel={0}
          relleno={0}
          radio="md"
          data-estado-de-la-leyenda={estado.clave}
          className="flex items-center gap-1.5 px-2 py-1"
        >
          <span
            aria-hidden="true"
            className="size-3 rounded-full border"
            style={{ background: estado.relleno, borderColor: estado.borde }}
          />
          <span className="text-xs text-texto-sutil">{estado.etiqueta}</span>
        </Superficie>
      ))}
    </div>
  );
}
