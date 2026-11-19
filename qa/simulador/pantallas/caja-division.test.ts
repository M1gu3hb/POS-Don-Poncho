import { describe, expect, it } from 'vitest';

import { rotuloDeLaParte } from './caja-division.ts';

describe('el rótulo de una parte de la cuenta dividida (D22-055 del día 2214)', () => {
  it('encuentra el cobro aunque el texto accesible pegue el primer renglón al título', () => {
    // El diálogo se lee «Cobrar — Mesa 8 · cuenta 2 de 2» y enseguida «1800 cristalino ×1»: sin espacio.
    const texto = 'Cobrar — Mesa 8 · cuenta 2 de 21800 cristalino ×1$140.00';
    expect(rotuloDeLaParte(8, 2, 2).test(texto)).toBe(true);
  });

  it('no confunde una mesa con otra ni una parte con otra', () => {
    const texto = 'Cobrar — Mesa 18 · cuenta 2 de 2';
    expect(rotuloDeLaParte(8, 2, 2).test(texto)).toBe(false);
    expect(rotuloDeLaParte(18, 1, 2).test(texto)).toBe(false);
    expect(rotuloDeLaParte(18, 2, 2).test(texto)).toBe(true);
  });
});
