import { describe, expect, it } from 'vitest';

import {
  claveDeColorDeCategoria,
  COLORES_DE_CATEGORIA,
  primerColorLibre,
} from './colores-de-categoria.ts';

/** DP-24 · 3.4 · La paleta fija de las categorías: claves, no colores sueltos. */
describe('colores de las categorías', () => {
  it('hay dieciséis, con clave y nombre propios, sin repetir', () => {
    expect(COLORES_DE_CATEGORIA).toHaveLength(16);
    expect(new Set(COLORES_DE_CATEGORIA.map((c) => c.clave)).size).toBe(16);
    expect(new Set(COLORES_DE_CATEGORIA.map((c) => c.nombre)).size).toBe(16);
  });

  it('sólo reconoce las claves de la paleta; cualquier otra cosa es «sin color»', () => {
    expect(claveDeColorDeCategoria('cat-3')).toBe('cat-3');
    expect(claveDeColorDeCategoria('#ff0000')).toBeNull();
    expect(claveDeColorDeCategoria('')).toBeNull();
    expect(claveDeColorDeCategoria(null)).toBeNull();
    expect(claveDeColorDeCategoria(undefined)).toBeNull();
  });

  it('el primer color libre salta los que ya usa otra categoría', () => {
    expect(primerColorLibre([])).toBe('cat-1');
    expect(primerColorLibre(['cat-1', 'cat-2', null, '#abc'])).toBe('cat-3');
    expect(primerColorLibre(COLORES_DE_CATEGORIA.map((c) => c.clave))).toBe('cat-1');
  });
});
