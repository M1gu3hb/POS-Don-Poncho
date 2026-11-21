'use client';

import { claveDeColorDeCategoria, COLORES_DE_CATEGORIA } from '@morphiqpos/domain/catalogo';
import { Check } from 'lucide-react';

/**
 * DP-24 · 3.4 · EL COLOR DE UNA CATEGORÍA, de la paleta fija (nunca un color suelto): al crearla o
 * editarla. Cada color es un botón con su nombre accesible; el elegido lleva una palomita (el color
 * no es el único medio) y su nombre escrito debajo. Con dedo, cada botón mide `--altura-tactil`.
 */
export function SelectorDeColorDeCategoria({
  valor,
  alElegir,
  deshabilitado = false,
  etiqueta = 'Color',
}: {
  /** La clave elegida (`cat-3`); cualquier otra cosa se toma como «sin color». */
  readonly valor: string | null | undefined;
  readonly alElegir: (clave: string) => void;
  readonly deshabilitado?: boolean;
  readonly etiqueta?: string;
}) {
  const elegido = claveDeColorDeCategoria(valor);
  const nombre = COLORES_DE_CATEGORIA.find((c) => c.clave === elegido)?.nombre ?? 'Sin color';
  return (
    <fieldset className="space-y-1.5" disabled={deshabilitado}>
      <legend className="text-xs font-medium">{etiqueta}</legend>
      <div className="flex flex-wrap gap-1.5">
        {COLORES_DE_CATEGORIA.map((c) => {
          const activo = c.clave === elegido;
          return (
            <button
              key={c.clave}
              type="button"
              aria-pressed={activo}
              aria-label={c.nombre}
              title={c.nombre}
              data-categoria-color={c.clave}
              onClick={() => {
                alElegir(c.clave);
              }}
              className="selector-de-color flex size-[calc(var(--altura-control)*0.8)] items-center justify-center rounded-full any-pointer-coarse:size-(--altura-tactil)"
            >
              {activo ? <Check aria-hidden className="size-4" /> : null}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-texto-sutil">{nombre}</p>
    </fieldset>
  );
}
