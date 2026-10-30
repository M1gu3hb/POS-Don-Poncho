/**
 * DP-11.4 · CLARO, OSCURO O AUTOMÁTICO, POR APARATO.
 *
 * Lo guardado en `mh_theme` (la clave del `ThemeContext` heredado) es la PREFERENCIA: `light`,
 * `dark` o, sin nada o con `auto`, automático. El modo que se pinta sale de la preferencia y de
 * `prefers-color-scheme`. El guion de arranque (`heredado/tema-arranque.ts`) dice lo mismo en
 * texto, antes del primer pintado; y `.dark` y `data-modo` siguen siendo sólo `claro`/`oscuro`,
 * así que nada de lo que lee el modo cambió.
 */

export const PREFERENCIAS_DE_MODO = ['auto', 'light', 'dark'] as const;
export type PreferenciaDeModo = (typeof PREFERENCIAS_DE_MODO)[number];

/** La consulta del sistema. Igual que la del guion de arranque. */
export const CONSULTA_DEL_SISTEMA = '(prefers-color-scheme: dark)';

export function leerPreferenciaDeModo(guardado: string | null | undefined): PreferenciaDeModo {
  return guardado === 'dark' || guardado === 'light' ? guardado : 'auto';
}

export function resolverModo(
  preferencia: PreferenciaDeModo,
  sistemaOscuro: boolean,
): 'light' | 'dark' {
  if (preferencia === 'auto') return sistemaOscuro ? 'dark' : 'light';
  return preferencia;
}
