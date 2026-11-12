import { describe, expect, it } from 'vitest';

import type { AsientoFechado } from '../libro.ts';
import { crearAzar } from '../semilla.ts';
import {
  planearDivision,
  preciosPorUnidad,
  repartoIgual,
  repartoPorRenglon,
  totalesDelReparto,
} from './division-reparto.ts';

const linea = (producto: string, cantidad: number, importeCentavos: number): AsientoFechado => ({
  dia: 1,
  horaSim: '',
  bot: 'm',
  asiento: {
    tipo: 'linea',
    cuenta: 'c1',
    producto,
    cantidad,
    opciones: [],
    importeCentavos,
    estacion: 'cocina',
    canal: 'mesa',
  },
});

describe('reparto de una cuenta dividida', () => {
  it('en iguales nadie lleva más de una unidad de diferencia y todo se reparte', () => {
    expect(repartoIgual([3, 2], 2)).toEqual([
      [2, 1],
      [1, 1],
    ]);
    expect(repartoIgual([1], 2)).toBeNull();
  });

  it('por renglón cada platillo va completo a una sola cuenta y ninguna queda vacía', () => {
    const azar = crearAzar(7);
    for (let i = 0; i < 50; i += 1) {
      const r = repartoPorRenglon([2, 1, 3], 3, azar);
      expect(r).not.toBeNull();
      for (const fila of r ?? []) expect(fila.reduce((s, x) => s + x, 0)).toBeGreaterThan(0);
      for (const col of [0, 1, 2]) {
        expect((r ?? []).filter((f) => (f[col] ?? 0) > 0)).toHaveLength(1);
      }
    }
    expect(repartoPorRenglon([5], 2, azar)).toBeNull();
  });

  it('planea siempre un reparto que suma todas las unidades, o nada si no hay qué dividir', () => {
    const azar = crearAzar(11);
    expect(planearDivision([1], azar)).toBeNull();
    for (let i = 0; i < 100; i += 1) {
      const unidades = [azar.entero(0, 3), azar.entero(1, 2), azar.entero(0, 1)];
      const plan = planearDivision(unidades, azar);
      if (unidades.reduce((s, x) => s + x, 0) < 2) {
        expect(plan).toBeNull();
        continue;
      }
      expect(plan).not.toBeNull();
      unidades.forEach((n, col) => {
        expect((plan?.reparto ?? []).reduce((s, f) => s + (f[col] ?? 0), 0)).toBe(n);
      });
    }
  });

  it('los totales salen de los precios por unidad del libro y avisan si un nombre tiene dos precios', () => {
    const libro = [linea('Taco', 3, 10_500), linea('Flan', 1, 4_500)];
    const precios = preciosPorUnidad(libro, 'c1');
    expect(
      totalesDelReparto(
        [
          [2, 0],
          [1, 1],
        ],
        ['Taco', 'Flan'],
        precios,
      ),
    ).toEqual([7_000, 8_000]);
    const ambiguo = preciosPorUnidad([...libro, linea('Taco', 1, 4_000)], 'c1');
    expect(
      totalesDelReparto(
        [
          [1, 0],
          [2, 1],
        ],
        ['Taco', 'Flan'],
        ambiguo,
      ),
    ).toBeNull();
  });
});
