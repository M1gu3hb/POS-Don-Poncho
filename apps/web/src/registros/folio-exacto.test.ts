import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { primeroElFolioExacto } from './folio-exacto.ts';

const venta = (folio: number | string) => ({ folio, id: `v${String(folio)}` });

describe('buscar un folio en Registros → Ventas', () => {
  // 300 ventas, de la más nueva (300) a la más vieja (1): «2» coincide con muchas.
  const ventas = Array.from({ length: 300 }, (_, i) => venta(300 - i));

  it('con un número, la venta de ese folio va primero aunque sea la más vieja', () => {
    const r = primeroElFolioExacto(ventas, ' 2 ');
    expect(r[0]?.folio).toBe(2);
    expect(r).toHaveLength(300);
  });

  it('el resto conserva su orden (de la más nueva a la más vieja)', () => {
    const r = primeroElFolioExacto(ventas, '2');
    expect(r.slice(1, 4).map((v) => v.folio)).toEqual([300, 299, 298]);
  });

  it('si no es un número, o no hay ese folio, no cambia nada', () => {
    expect(primeroElFolioExacto(ventas, 'Lupita')).toBe(ventas);
    expect(primeroElFolioExacto(ventas, '9999')).toBe(ventas);
  });

  it('Registros ordena lo que encuentra con el folio exacto primero', () => {
    const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
    const fuente = readFileSync(join(raiz, 'heredado', 'pages', 'Registros.jsx'), 'utf8');
    expect(fuente).toMatch(/primeroElFolioExacto\(\s*ventas\.filter\(/);
  });
});
