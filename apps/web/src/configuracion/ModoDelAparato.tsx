'use client';

import { useId } from 'react';

import { useTheme } from '@/lib/ThemeContext';

import { ToggleGroup, ToggleGroupItem } from '@morphiqpos/ui/primitivas/toggle-group';

import {
  PREFERENCIAS_DE_MODO,
  leerPreferenciaDeModo,
  type PreferenciaDeModo,
} from '~/proveedores/preferencia-de-modo';

/**
 * DP-11.4 · CLARO U OSCURO, EN ESTE APARATO: Automático (sigue al sistema), Claro u Oscuro.
 *
 * Es del aparato y no del negocio, como siempre fue el modo: la caja de día y la tableta de la
 * barra de noche no tienen por qué verse igual. Vive en Apariencia, junto al estilo, que sí es
 * del negocio; el «Modo oscuro» de la barra lateral sigue siendo el atajo de siempre.
 */
const NOMBRE: Readonly<Record<PreferenciaDeModo, string>> = {
  auto: 'Automático',
  light: 'Claro',
  dark: 'Oscuro',
};

export function ModoDelAparato() {
  const { preference, setPreference } = useTheme();
  const etiqueta = useId();

  return (
    <div className="flex flex-col gap-(--espacio-2)">
      <span id={etiqueta} className="text-sm font-medium">
        Claro u oscuro, en este aparato
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-labelledby={etiqueta}
        value={leerPreferenciaDeModo(preference)}
        onValueChange={(valor) => {
          // El grupo manda '' al volver a tocar el elegido: se queda como estaba.
          if (valor !== '') setPreference(valor);
        }}
      >
        {PREFERENCIAS_DE_MODO.map((opcion) => (
          <ToggleGroupItem key={opcion} value={opcion} className="px-(--espacio-4)">
            {NOMBRE[opcion]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="max-w-prose text-xs text-texto-sutil">
        Automático sigue al aparato: si de noche se pone oscuro, el punto de venta también.
      </p>
    </div>
  );
}
