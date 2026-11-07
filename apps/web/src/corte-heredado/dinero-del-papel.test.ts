import { describe, expect, it } from 'vitest';

import { dineroODato, efectivoEsperadoDelCorte } from './diferencia-del-corte';

const pesos = (v: number): string => `$${v.toFixed(2)}`;

describe('DP-14.6 · el PDF del corte no inventa ceros', () => {
  it('sin dato dice el guion, no «$0.00»', () => {
    expect(dineroODato(null, pesos)).toBe('—');
    expect(dineroODato(undefined, pesos)).toBe('—');
    expect(dineroODato(Number.NaN, pesos)).toBe('—');
  });

  it('un cero de verdad sí se escribe', () => {
    expect(dineroODato(0, pesos)).toBe('$0.00');
    expect(dineroODato(12.5, pesos)).toBe('$12.50');
  });

  it('el efectivo esperado: el que trae el corte, o contado menos diferencia, o nada', () => {
    expect(efectivoEsperadoDelCorte({ efectivo_esperado: 1500 })).toBe(1500);
    expect(efectivoEsperadoDelCorte({ efectivo_contado: 1480, diferencia_al_cerrar: -20 })).toBe(
      1500,
    );
    expect(efectivoEsperadoDelCorte({ efectivo_contado: 1480 })).toBeNull();
    expect(efectivoEsperadoDelCorte(null)).toBeNull();
  });
});
