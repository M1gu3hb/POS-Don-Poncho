import { describe, expect, it } from 'vitest';

import { avisosDeLaUnion } from './avisos-de-la-union';

/** DP-25 · P6 — lo que se le dice al mesero cuando la cuenta de una mesa pasa a la principal. */

describe('avisos de la unión', () => {
  it('uno por cada mesa que traía consumo, con su número y el de la principal', () => {
    expect(
      avisosDeLaUnion([
        { desdeMesa: 7, aMesa: 3 },
        { desdeMesa: 8, aMesa: 3 },
      ]),
    ).toEqual([
      'La cuenta de la mesa 7 pasó a la mesa 3.',
      'La cuenta de la mesa 8 pasó a la mesa 3.',
    ]);
  });

  it('sin consumo no hay nada que avisar, y un resultado sin la lista (otra versión) tampoco', () => {
    expect(avisosDeLaUnion([])).toEqual([]);
    expect(avisosDeLaUnion(undefined)).toEqual([]);
  });
});
