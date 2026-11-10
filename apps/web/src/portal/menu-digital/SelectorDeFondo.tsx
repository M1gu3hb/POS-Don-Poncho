'use client';

import { FONDO_DE_OMISION, FONDOS_DE_TARJETA } from '@morphiqpos/contracts';
import { Check } from 'lucide-react';

import '~/portal/menu-digital/menu-digital.css';

/**
 * DP-16 · EL FONDO DE LA TARJETA SIN FOTO, en Productos (3.1).
 *
 * Las muestras son las mismas tarjetas del menú digital, con los colores del estilo del negocio:
 * lo que se elige aquí es lo que el comensal ve. Sólo la lista cerrada de
 * `FONDOS_DE_TARJETA`; «Automático» deja el de omisión. Con foto, el fondo no se ve (la foto manda).
 */
export function SelectorDeFondo({
  valor,
  alCambiar,
  nombre,
}: {
  readonly valor: string | null;
  readonly alCambiar: (valor: string | null) => void;
  readonly nombre: string;
}) {
  const elegido = valor ?? null;
  const opciones: readonly { readonly valor: string | null; readonly nombre: string }[] = [
    { valor: null, nombre: 'Automático' },
    ...FONDOS_DE_TARJETA,
  ];
  return (
    <fieldset className="flex flex-col gap-(--espacio-2)">
      <legend className="text-sm font-semibold">Fondo en el menú digital (si no tiene foto)</legend>
      <div role="radiogroup" className="grid grid-cols-5 gap-(--espacio-2) max-[420px]:grid-cols-4">
        {opciones.map((o) => {
          const activo = o.valor === elegido;
          return (
            <button
              key={o.valor ?? 'automatico'}
              type="button"
              role="radio"
              aria-checked={activo}
              aria-label={o.nombre}
              title={o.nombre}
              data-fondo={o.valor ?? FONDO_DE_OMISION}
              onClick={() => {
                alCambiar(o.valor);
              }}
              className={`menu-tarjeta relative grid aspect-square min-h-11 place-items-center overflow-hidden rounded-(--radio-md) border-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anillo ${
                activo ? 'border-texto' : 'border-transparent'
              }`}
            >
              {activo ? <Check className="size-5" strokeWidth={3} aria-hidden /> : null}
              {o.valor === null ? <span className="sr-only">{o.nombre}</span> : null}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-texto-sutil">
        {nombre.trim() === '' ? 'El platillo' : nombre} sin foto se verá con este fondo y su nombre
        encima.
      </p>
    </fieldset>
  );
}
