import { describe, expect, it } from 'vitest';

import { planoDeLasMesas } from './plano-de-mesas.mjs';

/**
 * LAS MESAS ENCIMADAS (DP-11.0): en producción las 10 de Don Poncho nacieron en el mismo punto
 * (100, 100) y en la tableta sólo se podía tocar la de arriba. Se acomodan en una cuadrícula por
 * número —1 a 5 arriba (Mesero 1), 6 a 10 abajo (Mesero 2)— y SÓLO las que siguen encimadas: lo
 * que el dueño ya acomodó no se toca.
 */
const PLANO = { columnas: 5, x: 30, y: 40, pasoX: 160, pasoY: 220 };
const mesa = (numero: number, x: number | null, y: number | null) => ({
  id: `m${String(numero)}`,
  numero,
  posicion_x: x,
  posicion_y: y,
});

describe('planoDeLasMesas', () => {
  it('las diez encimadas van a una cuadrícula de cinco por fila, por número', () => {
    const mesas = Array.from({ length: 10 }, (_, i) => mesa(i + 1, 100, 100));
    const plan = planoDeLasMesas(mesas, PLANO);
    expect(plan).toHaveLength(10);
    expect(plan[0]).toEqual({ id: 'm1', numero: 1, x: 30, y: 40 });
    expect(plan[4]).toEqual({ id: 'm5', numero: 5, x: 670, y: 40 });
    expect(plan[5]).toEqual({ id: 'm6', numero: 6, x: 30, y: 260 });
    expect(plan[9]).toEqual({ id: 'm10', numero: 10, x: 670, y: 260 });
  });

  it('lo ya acomodado no se toca: sólo las que comparten punto con otra', () => {
    const mesas = [mesa(1, 100, 100), mesa(2, 100, 100), mesa(3, 500, 300)];
    expect(planoDeLasMesas(mesas, PLANO).map((m) => m.numero)).toEqual([1, 2]);
  });

  it('sin posición cuenta como encimada (el mapa la pinta en el mismo punto de omisión)', () => {
    const mesas = [mesa(1, null, null), mesa(2, 100, 100), mesa(3, 30, 40)];
    expect(planoDeLasMesas(mesas, PLANO).map((m) => m.numero)).toEqual([1, 2]);
  });

  it('ya acomodadas, no hay nada que hacer (correrlo otra vez no cambia nada)', () => {
    const acomodadas = planoDeLasMesas(
      Array.from({ length: 10 }, (_, i) => mesa(i + 1, 100, 100)),
      PLANO,
    ).map((p) => mesa(p.numero, p.x, p.y));
    expect(planoDeLasMesas(acomodadas, PLANO)).toEqual([]);
  });
});
