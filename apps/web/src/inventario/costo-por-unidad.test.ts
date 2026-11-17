import { describe, expect, it } from 'vitest';

import { costoPorUnidadParaMostrar, textoDelCostoPorUnidad } from './costo-por-unidad.ts';

/**
 * DP-D165 · El costo que enseña Inventario: por kilo y por litro, no «$0.02 / ml».
 */

const formato = (pesos: number) => `$${pesos.toFixed(2)}`;

describe('el costo por unidad base, como lo lee un dueño', () => {
  it('los gramos se enseñan por kilo y los mililitros por litro', () => {
    expect(costoPorUnidadParaMostrar(0.045, 'g')).toEqual({ pesos: 45, unidad: 'kg' });
    expect(costoPorUnidadParaMostrar(0.024, 'ml').unidad).toBe('L');
    expect(costoPorUnidadParaMostrar(0.024, 'ml').pesos).toBeCloseTo(24, 9);
  });

  it('la leche a 2.4 ¢/ml dice $24.00/L y el maíz a 4.5 ¢/g, $45.00/kg', () => {
    expect(textoDelCostoPorUnidad(0.024, 'ml', formato)).toBe('$24.00/L');
    expect(textoDelCostoPorUnidad(0.045, 'g', formato)).toBe('$45.00/kg');
  });

  it('una pieza, un metro, un kilo o un litro se quedan como están', () => {
    expect(textoDelCostoPorUnidad(12.5, 'pieza', formato)).toBe('$12.50/pieza');
    expect(textoDelCostoPorUnidad(3, 'm', formato)).toBe('$3.00/m');
    expect(textoDelCostoPorUnidad(45, 'kg', formato)).toBe('$45.00/kg');
  });

  it('con sub-centavos no redondea a la vista lo que se guardó exacto', () => {
    // 99.8 ¢ la cerveza: $0.998, no «$1.00».
    expect(textoDelCostoPorUnidad(0.998, 'pieza', formato)).toBe('$0.998/pieza');
  });

  it('sin unidad no inventa una', () => {
    expect(textoDelCostoPorUnidad(2, null, formato)).toBe('$2.00/unidad');
  });
});
