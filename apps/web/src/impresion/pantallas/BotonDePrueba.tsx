'use client';

import type { ReactElement, ReactNode } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { CircleAlert, CircleCheck } from 'lucide-react';

import type { EstadoDePrueba } from './resultado-de-prueba.ts';

/**
 * UN BOTÓN DE PRUEBA (DP-20 · laboratorio): «Enviando…» mientras corre, y debajo su resultado con
 * su palabra y su icono —el color nunca va solo—. Si está desactivado, dice por qué.
 */
export function BotonDePrueba({
  etiqueta,
  estado,
  ocupado,
  alPulsar,
  icono,
  variante = 'outline',
  razon,
}: {
  readonly etiqueta: string;
  readonly estado: EstadoDePrueba | undefined;
  /** Hay otra prueba corriendo. */
  readonly ocupado: boolean;
  readonly alPulsar: () => void;
  readonly icono?: ReactNode;
  readonly variante?: 'default' | 'outline';
  /** Si viene, el botón no se puede usar y esto es la razón. */
  readonly razon?: string | undefined;
}): ReactElement {
  const enviando = estado?.fase === 'enviando';
  return (
    <div className="flex flex-col gap-(--espacio-1)">
      <Button
        type="button"
        variant={variante}
        className="self-start"
        disabled={ocupado || razon !== undefined}
        cargando={enviando}
        onClick={alPulsar}
      >
        {enviando ? null : icono}
        {enviando ? 'Enviando…' : etiqueta}
      </Button>
      {razon === undefined ? null : <p className="text-xs text-texto-sutil">{razon}</p>}
      {estado?.fase === 'listo' ? (
        <p
          role={estado.ok ? 'status' : 'alert'}
          className="flex items-start gap-(--espacio-1) text-sm"
        >
          {estado.ok ? (
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-exito" />
          ) : (
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-peligro" />
          )}
          <span>{estado.texto}</span>
        </p>
      ) : null}
    </div>
  );
}
