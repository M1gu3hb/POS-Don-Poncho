import { Check, Flame, Sparkles } from 'lucide-react';

import { cn } from '@morphiqpos/ui/utilidades';

import type { ChipDeLaTira } from './carrusel-del-telefono';

const ESTILO_DEL_ESTADO: Readonly<Record<ChipDeLaTira['estado'], string>> = {
  nuevo: 'border-info bg-info/10 text-texto',
  en_preparacion: 'border-advertencia bg-advertencia/15 text-texto',
  listo: 'border-exito bg-exito/10 text-texto',
};

const ICONO_DEL_ESTADO = {
  nuevo: Sparkles,
  en_preparacion: Flame,
  listo: Check,
} as const;

/**
 * La tira de arriba (DP-16 · 2.3): una pastilla por mesa o pedido de la estación, con el estado
 * en texto e icono además de color. Tocar una lleva a su comanda; las que ya están listas no
 * tienen tarjeta (esperan al mesero o a la caja) y sólo informan.
 */
export function TiraDeMesas({
  chips,
  vistaId,
  alElegir,
}: {
  readonly chips: readonly ChipDeLaTira[];
  readonly vistaId: string | null;
  readonly alElegir: (indice: number) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <ul
      aria-label="Mesas y pedidos de la estación"
      className="-mx-(--espacio-3) flex gap-(--espacio-2) overflow-x-auto px-(--espacio-3) pb-(--espacio-1)"
    >
      {chips.map((chip) => {
        const Icono = ICONO_DEL_ESTADO[chip.estado];
        const contenido = (
          <>
            <Icono aria-hidden className="size-4 shrink-0" />
            <span className="font-bold">{chip.rotulo}</span>
            <span className="text-sm">{chip.estadoDicho}</span>
          </>
        );
        const base = cn(
          'flex min-h-(--altura-control) shrink-0 items-center gap-(--espacio-1) rounded-full border-2 px-(--espacio-3) whitespace-nowrap',
          ESTILO_DEL_ESTADO[chip.estado],
        );
        const indice = chip.indice;
        return (
          <li key={chip.comandaId} className="shrink-0">
            {indice === null ? (
              <p className={base}>{contenido}</p>
            ) : (
              <button
                type="button"
                aria-label={`${chip.rotulo}, ${chip.estadoDicho}. Ir a su comanda`}
                aria-current={chip.comandaId === vistaId ? 'true' : undefined}
                className={cn(
                  base,
                  'focus-visible:ring-[3px] focus-visible:ring-anillo focus-visible:outline-none',
                  chip.comandaId === vistaId && 'ring-2 ring-primario',
                )}
                onClick={() => {
                  alElegir(indice);
                }}
              >
                {contenido}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
