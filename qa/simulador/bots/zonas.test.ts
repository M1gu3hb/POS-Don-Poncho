import { describe, expect, it } from 'vitest';

import { elegirMesaDeLaMismaZona, mismaZona, zonaDeLaMesa } from './zonas.ts';

describe('las zonas del salón de Don Poncho', () => {
  it('el Salón es de la 1 a la 10 y la Terraza de la 11 a la 20', () => {
    expect([1, 10, 11, 20].map(zonaDeLaMesa)).toEqual([0, 0, 1, 1]);
  });

  it('dos mesas son de la misma zona sólo si caen en el mismo bloque de diez', () => {
    expect(mismaZona(4, 9)).toBe(true);
    expect(mismaZona(10, 11)).toBe(false);
  });

  it('para unir se elige una libre, no atendida y de la zona de la grande', () => {
    const mesas = [
      { numero: 12, estado: 'Libre' },
      { numero: 5, estado: 'Ocupada' },
      { numero: 7, estado: 'Libre' },
      { numero: 8, estado: 'Libre' },
    ];
    expect(elegirMesaDeLaMismaZona(mesas, 1, new Set([7]))?.numero).toBe(8);
    expect(elegirMesaDeLaMismaZona(mesas, 11, new Set())?.numero).toBe(12);
    expect(elegirMesaDeLaMismaZona(mesas, 3, new Set([7, 8]))).toBeUndefined();
  });
});
