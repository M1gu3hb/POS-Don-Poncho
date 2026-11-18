import { describe, expect, it } from 'vitest';

import { anotarReparto, esDeQuien, preferirLasMias } from './reparto-de-mesas.ts';

describe('el reparto de mesas entre meseros', () => {
  it('lo que la dueña reparte reemplaza lo anterior sólo en las mesas que nombra', () => {
    const reparto = new Map<number, string>();
    anotarReparto(reparto, [
      { mesero: 'Mesero 1', mesas: [1, 2] },
      { mesero: 'Mesero 2', mesas: [11] },
    ]);
    anotarReparto(reparto, [{ mesero: 'Mesero 7', mesas: [2, 3] }]);
    expect([...reparto.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 'Mesero 1'],
      [2, 'Mesero 7'],
      [3, 'Mesero 7'],
      [11, 'Mesero 2'],
    ]);
  });

  it('sin reparto todas las mesas son de todos; con reparto, sólo las de quien las tiene', () => {
    const reparto = new Map<number, string>();
    expect(esDeQuien(reparto, 5, 'Mesero 1')).toBe(true);
    anotarReparto(reparto, [{ mesero: 'Mesero 2', mesas: [5] }]);
    expect(esDeQuien(reparto, 5, 'Mesero 1')).toBe(false);
    expect(esDeQuien(reparto, 5, 'Mesero 2')).toBe(true);
  });

  it('al sentar a un grupo se prefieren las mesas propias y, si no hay, cualquiera libre', () => {
    const reparto = new Map<number, string>();
    anotarReparto(reparto, [
      { mesero: 'Mesero 1', mesas: [3] },
      { mesero: 'Mesero 2', mesas: [4] },
    ]);
    const libres = [{ numero: 4 }, { numero: 3 }];
    expect(preferirLasMias(libres, reparto, 'Mesero 1')[0]?.numero).toBe(3);
    expect(preferirLasMias([{ numero: 4 }], reparto, 'Mesero 1')[0]?.numero).toBe(4);
  });
});
