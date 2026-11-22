'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Superficie } from '@morphiqpos/ui/sistema';
import { CircleHelp } from 'lucide-react';
import { useId, useState, type ReactElement } from 'react';

import { IndicadorDelPlatillo } from './LoEnviadoDeLaMesa.tsx';
import { ESTADOS_DEL_PLATILLO } from './estado-del-platillo.ts';
import { INSTRUCCIONES_DE_LA_MESA, significadoDelColorDeLaMesa } from './leyenda-de-la-mesa.ts';

/**
 * DP-25 · Parte 3 · 3.3 · LA LEYENDA DE LA MESA, en la misma pantalla.
 *
 * Una fila corta con los cuatro estados del platillo (glifo y palabra, no sólo color) y un «?» que
 * abre, en el mismo lugar —sin otra ventana encima de la de la mesa—, lo que significa cada color
 * de la mesa y las instrucciones: cuándo marcar entregado y qué hacer con los pendientes al pedir
 * la cuenta. La pantalla se explica sola: nadie tiene que volver a explicarla.
 */

export interface ColorDeMesa {
  readonly clave: string;
  readonly etiqueta: string;
  readonly relleno: string;
  readonly borde: string;
}

export function LeyendaDeLaMesa({
  coloresDeMesa,
}: {
  readonly coloresDeMesa: readonly ColorDeMesa[];
}): ReactElement {
  const [abierta, setAbierta] = useState(false);
  const idDelPanel = useId();
  return (
    <section
      data-leyenda-de-la-mesa
      aria-label="Qué significa cada estado"
      className="shrink-0 border-b border-borde px-(--espacio-4) py-2"
    >
      <div className="flex items-center gap-2">
        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {ESTADOS_DEL_PLATILLO.map((e) => (
            <li key={e.estado}>
              <IndicadorDelPlatillo estado={e.estado} />
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-expanded={abierta}
          aria-controls={idDelPanel}
          aria-label="Cómo leer esta pantalla"
          onClick={() => {
            setAbierta((a) => !a);
          }}
          className="shrink-0 rounded-full any-pointer-coarse:min-h-(--altura-tactil) any-pointer-coarse:min-w-(--altura-tactil)"
        >
          <CircleHelp aria-hidden="true" className="size-5" />
          <span className="sr-only">?</span>
        </Button>
      </div>
      {abierta && (
        <Superficie
          id={idDelPanel}
          nivel={0}
          radio="md"
          relleno={3}
          className="mt-2 max-h-[40dvh] space-y-(--espacio-3) overflow-y-auto text-xs"
        >
          <div data-leyenda-estados>
            <p className="mb-1 font-bold text-texto">El estado de cada platillo</p>
            <ul className="space-y-1">
              {ESTADOS_DEL_PLATILLO.map((e) => (
                <li key={e.estado} className="flex items-start gap-2">
                  <IndicadorDelPlatillo estado={e.estado} />
                  <span className="text-texto-sutil">{e.explicacion}</span>
                </li>
              ))}
            </ul>
          </div>
          <div data-leyenda-colores>
            <p className="mb-1 font-bold text-texto">El color de la mesa en el mapa</p>
            <ul className="space-y-1">
              {coloresDeMesa.map((c) => (
                <li key={c.clave} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 size-3 shrink-0 rounded-full border-2"
                    style={{ background: c.relleno, borderColor: c.borde }}
                  />
                  <span className="text-texto">
                    <span className="font-semibold">{c.etiqueta}</span>
                    <span className="text-texto-sutil">
                      {' '}
                      · {significadoDelColorDeLaMesa(c.clave)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div data-leyenda-instrucciones>
            {INSTRUCCIONES_DE_LA_MESA.map((i) => (
              <div key={i.titulo} className="mb-2 last:mb-0">
                <p className="font-bold text-texto">{i.titulo}</p>
                <p className="text-texto-sutil">{i.texto}</p>
              </div>
            ))}
          </div>
        </Superficie>
      )}
    </section>
  );
}
