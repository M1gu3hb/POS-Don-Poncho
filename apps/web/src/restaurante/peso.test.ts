import { describe, expect, it } from 'vitest';

import { cantidadParaMostrar, esPorPeso, etiquetaDePeso } from './peso.ts';

describe('DP-14 · el peso como lo dice la cocina', () => {
  it.each([
    [0.25, '¼ kg'],
    [0.5, '½ kg'],
    [0.75, '¾ kg'],
    [1, '1 kg'],
    [1.5, '1.5 kg'],
    [2, '2 kg'],
    [0.3, '0.3 kg'],
    ['0.5000', '½ kg'],
    [0.125, '0.125 kg'],
  ])('%s kg se dice «%s»', (cantidad, dicho) => {
    expect(etiquetaDePeso(cantidad)).toBe(dicho);
  });

  it('respeta la unidad y no inventa un peso donde no lo hay', () => {
    expect(etiquetaDePeso(300, 'g')).toBe('300 g');
    expect(etiquetaDePeso(0)).toBe('');
    expect(etiquetaDePeso(null)).toBe('');
    expect(etiquetaDePeso('abc')).toBe('');
  });

  it('una línea por peso se dice con su unidad; una por pieza, con su número', () => {
    expect(
      cantidadParaMostrar({
        cantidad: '0.5000',
        tipo_venta: 'variable_medida',
        unidad_variable: 'kg',
      }),
    ).toBe('½ kg');
    expect(
      cantidadParaMostrar({
        cantidad: 1,
        tipo_venta_snapshot: 'variable_medida',
        cantidad_variable_snapshot: '0.7500',
        unidad_variable_snapshot: 'kg',
      }),
    ).toBe('¾ kg');
    expect(cantidadParaMostrar({ cantidad: 2, tipo_venta: 'precio_fijo' })).toBe('2');
    expect(cantidadParaMostrar({ cantidad: null })).toBe('0');
  });

  it('sabe si una línea se vende por peso', () => {
    expect(esPorPeso({ tipo_venta: 'variable_medida' })).toBe(true);
    expect(esPorPeso({ tipo_venta_snapshot: 'variable_medida' })).toBe(true);
    expect(esPorPeso({ tipo_venta: 'precio_fijo' })).toBe(false);
    expect(esPorPeso({})).toBe(false);
  });
});
