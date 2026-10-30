import { describe, expect, it } from 'vitest';

import { PREFERENCIAS_DE_MODO, leerPreferenciaDeModo, resolverModo } from './preferencia-de-modo';

/**
 * DP-11.4 · CLARO, OSCURO O AUTOMÁTICO, POR APARATO. Lo guardado en `mh_theme` es la
 * preferencia; el modo que se pinta sale de ella y del sistema. Sin nada guardado —el aparato
 * de siempre— es automático.
 */

describe('leerPreferenciaDeModo', () => {
  it('lo elegido a mano se respeta', () => {
    expect(leerPreferenciaDeModo('dark')).toBe('dark');
    expect(leerPreferenciaDeModo('light')).toBe('light');
  });

  it('sin nada guardado, «auto» o un valor raro, es automático', () => {
    for (const guardado of [null, undefined, '', 'auto', 'oscuro', 'DARK']) {
      expect(leerPreferenciaDeModo(guardado)).toBe('auto');
    }
  });

  it('las tres que se ofrecen, en el orden del selector', () => {
    expect(PREFERENCIAS_DE_MODO).toEqual(['auto', 'light', 'dark']);
  });
});

describe('resolverModo', () => {
  it('automático sigue al sistema', () => {
    expect(resolverModo('auto', true)).toBe('dark');
    expect(resolverModo('auto', false)).toBe('light');
  });

  it('lo elegido a mano gana al sistema', () => {
    expect(resolverModo('light', true)).toBe('light');
    expect(resolverModo('dark', false)).toBe('dark');
  });
});
