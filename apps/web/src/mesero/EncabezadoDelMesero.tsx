import { UtensilsCrossed } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

/**
 * EL ENCABEZADO DE «MESERO»: el icono, el título y, a la derecha, lo que cada puesto tiene a
 * mano (sus alertas de voz, el audio). En el teléfono las acciones bajan a su propia fila.
 *
 * El icono era una tesela roja con degradado y sombra puestos a mano; ahora es el color primario
 * del estilo, plano. El `h1` es lo primero que busca la prueba de navegador.
 */
export function EncabezadoDelMesero({ children }: { readonly children?: ReactNode }): ReactElement {
  return (
    <div className="flex flex-wrap items-start gap-(--espacio-3) sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-(--espacio-3)">
        <span className="flex size-(--altura-control) shrink-0 items-center justify-center rounded-lg bg-primario text-primario-texto">
          <UtensilsCrossed aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="font-heading text-xl leading-tight font-bold">Mesero</h1>
          <p className="truncate text-xs text-texto-sutil">Toca una mesa para abrir o gestionar</p>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{children}</div>
    </div>
  );
}
