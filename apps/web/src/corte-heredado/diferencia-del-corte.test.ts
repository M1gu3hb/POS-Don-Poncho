import { describe, expect, it } from 'vitest';

import { diferenciaDelCorte } from './diferencia-del-corte';

/**
 * QA1-8 (DP-13.5) · EL PDF DE UN CORTE CERRADO DICE LA DIFERENCIA QUE GUARDÓ EL CIERRE.
 *
 * Al cerrar, la caja arma el corte con `diferencia_efectivo` (su arqueo). Abierto después desde
 * Registros, el corte viene del puente, que sirve la foto del cierre como `diferencia_al_cerrar`:
 * el PDF leía la primera y decía «Diferencia efectivo $0.00» de un cierre con faltante de $10.
 */

describe('diferenciaDelCorte', () => {
  it('el corte recién cerrado trae la de su arqueo', () => {
    expect(diferenciaDelCorte({ diferencia_efectivo: 20, diferencia_al_cerrar: 5 })).toBe(20);
  });

  it('el que viene de Registros, la que guardó el cierre', () => {
    expect(diferenciaDelCorte({ diferencia_al_cerrar: -10 })).toBe(-10);
  });

  it('un cierre viejo sin la foto no inventa un cero', () => {
    expect(diferenciaDelCorte({ diferencia_al_cerrar: null })).toBeNull();
    expect(diferenciaDelCorte(null)).toBeNull();
  });
});
