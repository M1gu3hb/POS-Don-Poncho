import { describe, expect, it } from 'vitest';

import { clasificarLaVigilancia, valorExacto } from './hora.ts';

describe('el valor del inventario con un solo redondeo del costo exacto', () => {
  it('19 000 ml de leche a 2.4 ¢/ml valen $456.00 exactos', () => {
    expect(valorExacto('19000.0000', 24_000n)).toBe(45_600n);
  });
  it('redondea una sola vez, medio centavo hacia arriba', () => {
    // 1 g a 0.5 ¢ (5 000 dmc) → 0.5 ¢ → 1 ¢; 3 g a 0.5 ¢ → 1.5 ¢ → 2 ¢ (no 3 por redondear cada gramo).
    expect(valorExacto('1.0000', 5_000n)).toBe(1n);
    expect(valorExacto('3.0000', 5_000n)).toBe(2n);
  });
  it('una existencia en negativo o cero vale cero (DP-D116)', () => {
    expect(valorExacto('-500.0000', 24_000n)).toBe(0n);
    expect(valorExacto('0.0000', 24_000n)).toBe(0n);
  });
  it('lee cantidades con decimales', () => {
    expect(valorExacto('2.5000', 20_000n)).toBe(5n);
  });
});

describe('lo que vieron los navegadores', () => {
  const h = (tipo: 'consola' | '5xx' | 'red', texto: string, cuando = 10) => ({
    cuando,
    donde: 'Caja · win',
    tipo,
    texto,
  });
  it('cuenta los 5xx y deja explicados los rechazos 4xx y los cortes de red', () => {
    const r = clasificarLaVigilancia([
      h('5xx', '500 POST /api/venta/cobrar'),
      h(
        'consola',
        'Failed to load resource: the server responded with a status of 403 (Forbidden)',
      ),
      h('consola', 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED'),
      h('consola', 'TypeError: algo se rompió'),
      h('red', 'POST /api/x: net::ERR_INTERNET_DISCONNECTED'),
    ]);
    expect(r.cincoXX).toBe(1);
    expect(r.consolaExplicada).toBe(2);
    expect(r.consolaSinExplicar).toBe(1);
    expect(r.redExplicada).toBe(1);
    expect(r.ejemplos.some((e) => e.includes('algo se rompió'))).toBe(true);
  });
  it('sólo mira lo posterior a «desde»', () => {
    const r = clasificarLaVigilancia([h('5xx', '500 GET /x', 5), h('5xx', '500 GET /y', 50)], 20);
    expect(r.cincoXX).toBe(1);
  });
});
