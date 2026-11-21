'use client';

import { Delete } from 'lucide-react';
import type { ReactElement } from 'react';

import type { TeclaDeImporte } from './cobro-en-pantalla.ts';

/**
 * EL TECLADO DE IMPORTES DE LA TARJETA DE COBRO (DP-24).
 *
 * En una pantalla táctil, tocar un campo de dinero saca el teclado del sistema y tapa media
 * tarjeta: lo recibido, el cambio y el botón de cobrar quedan debajo. Este teclado vive DENTRO de
 * la tarjeta y escribe en el campo activo (los campos llevan `inputMode="none"` para que el del
 * sistema no salga); con teclado físico se sigue tecleando igual.
 *
 * Cada tecla mide al menos 44 px (DP-D154: por componente, nunca con un selector global).
 */

const TECLAS: readonly (readonly TeclaDeImporte[])[] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['0', '00', '.'],
];

const TECLA =
  'flex min-h-(--altura-tactil) items-center justify-center rounded-md border border-borde bg-superficie font-numeros text-xl font-semibold tabular-nums text-texto select-none active:bg-acento-suave disabled:opacity-50 touch-manipulation';

export function TecladoDeImportes({
  alTeclear,
  deshabilitado = false,
  rotulo,
}: {
  readonly alTeclear: (tecla: TeclaDeImporte) => void;
  readonly deshabilitado?: boolean;
  /** A qué campo escribe: «Recibido», «Tarjeta 2»… Lo lee el lector de pantalla. */
  readonly rotulo: string;
}): ReactElement {
  const tecla = (valor: TeclaDeImporte, contenido: ReactElement | string, nombre?: string) => (
    <button
      key={valor}
      type="button"
      className={TECLA}
      disabled={deshabilitado}
      aria-label={nombre}
      // El foco se queda en el campo: con teclado físico se puede seguir tecleando ahí.
      onPointerDown={(evento) => {
        evento.preventDefault();
      }}
      onClick={() => {
        alTeclear(valor);
      }}
    >
      {contenido}
    </button>
  );

  return (
    <div
      role="group"
      aria-label={`Teclado para ${rotulo}`}
      data-teclado-de-importes
      className="flex gap-(--espacio-1)"
    >
      <div className="grid flex-[3] grid-cols-3 gap-(--espacio-1)">
        {TECLAS.flat().map((valor) => tecla(valor, valor))}
      </div>
      {/* Las dos de borrar, altas: son las que se buscan con prisa. */}
      <div className="flex flex-1 flex-col gap-(--espacio-1) [&>button]:flex-1">
        {tecla(
          'borrar',
          <Delete aria-hidden="true" className="size-(--espacio-6)" />,
          'Borrar una cifra',
        )}
        {tecla('limpiar', 'C', 'Borrar todo')}
      </div>
    </div>
  );
}
