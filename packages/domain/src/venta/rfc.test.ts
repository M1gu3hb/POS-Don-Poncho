import { describe, expect, it } from 'vitest';

import { esRfcValido, normalizarRfc } from './rfc.ts';

/** DP-21 · Bloque 20 · el RFC del negocio: 12 (persona moral) o 13 (persona física), en mayúsculas. */
describe('esRfcValido', () => {
  it('acepta uno de persona moral (12) y uno de persona física (13)', () => {
    expect(esRfcValido('ABC850101AB1')).toBe(true);
    expect(esRfcValido('XAXX010101000')).toBe(true);
    expect(esRfcValido('PÑA850101AB1')).toBe(true);
    expect(esRfcValido('A&B850101AB1')).toBe(true);
  });

  it('rechaza lo que no mide 12 o 13, no está en mayúsculas o no tiene la forma', () => {
    for (const malo of [
      '',
      'ABC850101AB',
      'ABCDE850101AB1',
      'abc850101ab1',
      'abc850101AB1',
      'ABC85010AAB1',
      '1BC850101AB1',
      'ABC850101 AB1',
      'ABC-850101-AB1',
    ]) {
      expect(esRfcValido(malo), malo).toBe(false);
    }
  });
});

describe('normalizarRfc', () => {
  it('quita espacios y lo pone en mayúsculas para validarlo', () => {
    expect(normalizarRfc('  abc850101ab1 ')).toBe('ABC850101AB1');
    expect(normalizarRfc('abc 850101 ab1')).toBe('ABC850101AB1');
    expect(esRfcValido(normalizarRfc('abc850101ab1'))).toBe(true);
  });
});
