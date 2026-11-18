import { describe, expect, it } from 'vitest';

import {
  ESCALA_COSTO,
  centavosDelCosto,
  costoExactoDeCentavos,
  valorDeLaCantidad,
  valorDeLoAcumulado,
} from './costo-exacto.ts';

/**
 * DP-D165 · La aritmética del costo exacto: diezmilésimas de centavo por unidad base.
 */

describe('el costo exacto', () => {
  it('un centavo son 10 000 diezmilésimas', () => {
    expect(ESCALA_COSTO).toBe(10_000n);
    expect(costoExactoDeCentavos(5n)).toBe(50_000n);
    expect(costoExactoDeCentavos(0n)).toBe(0n);
  });

  it('el de centavos es el exacto redondeado: 2.4 → 2, 4.5 → 5 (medio centavo hacia arriba)', () => {
    expect(centavosDelCosto(24_000n)).toBe(2n);
    expect(centavosDelCosto(45_000n)).toBe(5n);
    expect(centavosDelCosto(44_999n)).toBe(4n);
    expect(centavosDelCosto(0n)).toBe(0n);
  });

  it('ida y vuelta: centavos enteros → exacto → centavos vuelve al mismo número', () => {
    for (const c of [0n, 1n, 7n, 250n, 123_456n]) {
      expect(centavosDelCosto(costoExactoDeCentavos(c))).toBe(c);
    }
  });

  it('el valor de una cantidad redondea UNA vez, al centavo', () => {
    // 20 000 ml (en diezmilésimas: 200 000 000) a 2.4 ¢/ml.
    expect(valorDeLaCantidad(200_000_000n, 24_000n)).toBe(48_000n);
    // 3 ml a 2.4 ¢ = 7.2 ¢.
    expect(valorDeLaCantidad(30_000n, 24_000n)).toBe(7n);
    // La mitad se aleja del cero: 0.5 × 5 ¢ = 2.5 ¢ → 3, y en negativo → −3.
    expect(valorDeLaCantidad(5_000n, 50_000n)).toBe(3n);
    expect(valorDeLaCantidad(-5_000n, 50_000n)).toBe(-3n);
  });

  it('lo acumulado de varias capas se redondea sobre la suma, no por sumando', () => {
    const capa = 10_000n * 24_000n; // 1 unidad a 2.4 ¢
    expect(valorDeLoAcumulado(capa)).toBe(2n);
    expect(valorDeLoAcumulado(capa * 3n)).toBe(7n);
  });
});
