import { describe, expect, it } from 'vitest';

import { retiroPideElPin, umbralDeRetiroLeido } from './pin-en-retiros.ts';

/** DP-16 (1.4) · Cuándo la pantalla de la cajera pide el PIN de un gerente en un retiro. */
describe('retiroPideElPin', () => {
  it('sin umbral nunca pide', () => {
    expect(retiroPideElPin(-900_000_00, null, false)).toBe(false);
  });

  it('pide sólo arriba del umbral, no en él, sea cual sea el signo', () => {
    expect(retiroPideElPin(-100_000, 100_000, false)).toBe(false);
    expect(retiroPideElPin(-100_001, 100_000, false)).toBe(true);
    expect(retiroPideElPin(100_001, 100_000, false)).toBe(true);
  });

  it('gerente, administrador y dueño no piden el PIN de otro', () => {
    expect(retiroPideElPin(-500_000, 100_000, true)).toBe(false);
  });
});

describe('umbralDeRetiroLeido', () => {
  it('sólo un entero positivo cuenta; lo demás es «no se pide»', () => {
    expect(umbralDeRetiroLeido({ retiro_pin_arriba_de_centavos: 150_000 })).toBe(150_000);
    for (const raro of [0, -5, 1.5, '1000', null, undefined, Number.NaN]) {
      expect(umbralDeRetiroLeido({ retiro_pin_arriba_de_centavos: raro })).toBeNull();
    }
    expect(umbralDeRetiroLeido(undefined)).toBeNull();
  });
});
