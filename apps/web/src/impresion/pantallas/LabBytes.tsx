'use client';

import type { ReactElement } from 'react';

import { Binary } from 'lucide-react';

import { aHexadecimal } from '../termico/trabajo.ts';
import { SeccionDelLab } from './campos';
import { conMiles } from './resultado-de-prueba.ts';
import type { UltimoTrabajo } from './imprimir-prueba.ts';

/** Cuántos bytes se enseñan: el resto se cuenta, no se pinta. */
const BYTES_A_MOSTRAR = 4096;

/**
 * 9 · LOS BYTES DEL ÚLTIMO TRABAJO, EN HEXADECIMAL (DP-20 · laboratorio): 16 por renglón, con su
 * desplazamiento a la izquierda. Sirve para comparar lo que se manda con lo que la impresora hace.
 */
export function LabBytes({ ultimo }: { readonly ultimo: UltimoTrabajo | null }): ReactElement {
  return (
    <SeccionDelLab
      titulo="9 · Los bytes del último trabajo"
      icono={<Binary aria-hidden className="size-5 shrink-0 text-primario" />}
      descripcion="Lo último que mandó una prueba de impresión, en hexadecimal."
    >
      {ultimo === null ? (
        <p className="text-sm text-texto-sutil">Todavía no se ha imprimido ninguna prueba.</p>
      ) : (
        <div className="flex flex-col gap-(--espacio-2)">
          <p className="text-sm">
            <span className="font-medium">{ultimo.titulo}</span>
            {` · ${conMiles(ultimo.bytes.length)} bytes · dibujar ${conMiles(ultimo.msDeDibujo)} ms · enviar ${conMiles(ultimo.msDeEnvio)} ms`}
          </p>
          <pre
            tabIndex={0}
            aria-label="Bytes del último trabajo en hexadecimal"
            className="max-h-96 overflow-auto rounded-md border border-borde bg-fondo-sutil p-(--espacio-3) font-mono text-xs leading-5 focus-visible:ring-[3px] focus-visible:ring-anillo/60 focus-visible:outline-none"
          >
            {aHexadecimal(ultimo.bytes, BYTES_A_MOSTRAR)}
          </pre>
        </div>
      )}
    </SeccionDelLab>
  );
}
