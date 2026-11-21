'use client';

import { claveDeColorDeCategoria, ordenarCategorias } from '@morphiqpos/domain/catalogo';

/**
 * DP-24 · 3.4 · LAS PESTAÑAS DE CATEGORÍA de la rejilla de platillos: la del mesero, la de la Caja
 * («Para llevar» y «Agregar a la cuenta») y la del POS.
 *
 * Una sola pieza para las tres: las categorías salen en el orden del negocio (`categorias.orden`) y
 * cada una con su color de la paleta (`categorias.color`, una clave `cat-N`). El color NUNCA es el
 * único medio: la pestaña lleva SU NOMBRE y un punto de color, y la elegida suma aro y negrita.
 * «Todas» no tiene color.
 *
 * Objetivo táctil: con dedo (`any-pointer-coarse`) cada pestaña mide `--altura-tactil`.
 */

export interface CategoriaDeLaRejilla {
  readonly id: string;
  readonly nombre?: string | null;
  readonly color?: string | null;
  readonly orden?: number | null;
}

/** El texto de la pestaña de «ver todo» y la clave con que se elige. */
export const TODAS = 'todas';

export function PestanasDeCategoria({
  categorias,
  elegida,
  alElegir,
  etiquetaDeTodas = 'Todas',
  claveDeTodas = TODAS,
  tamanoDeTexto = 'text-sm',
}: {
  readonly categorias: readonly CategoriaDeLaRejilla[];
  /** La clave de la elegida: el `id` de una categoría o la de «Todas». */
  readonly elegida: string | null | undefined;
  readonly alElegir: (clave: string) => void;
  readonly etiquetaDeTodas?: string;
  /** Cada pantalla heredada llama distinto a «todas» (`'todas'`, `'all'`). */
  readonly claveDeTodas?: string;
  readonly tamanoDeTexto?: 'text-xs' | 'text-sm';
}) {
  const base = `shrink-0 min-h-[calc(var(--altura-control)*0.8)] any-pointer-coarse:min-h-(--altura-tactil) px-(--espacio-3) py-1 rounded-full ${tamanoDeTexto} font-medium`;
  const todasElegida = elegida === claveDeTodas;
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Categorías">
      <button
        type="button"
        aria-pressed={todasElegida}
        onClick={() => {
          alElegir(claveDeTodas);
        }}
        className={`${base} ${
          todasElegida ? 'bg-primario text-primario-texto' : 'bg-superficie border text-texto-sutil'
        }`}
      >
        {etiquetaDeTodas}
      </button>
      {ordenarCategorias(categorias).map((c) => (
        <button
          type="button"
          key={c.id}
          aria-pressed={elegida === c.id}
          data-categoria-color={claveDeColorDeCategoria(c.color) ?? undefined}
          onClick={() => {
            alElegir(c.id);
          }}
          className={`${base} pestana-de-categoria`}
        >
          {(c.nombre ?? '').trim() || '—'}
        </button>
      ))}
    </div>
  );
}
