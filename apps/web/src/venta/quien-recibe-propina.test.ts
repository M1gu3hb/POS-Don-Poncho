import { describe, expect, it } from 'vitest';

import { liquidaSinPin, quienesRecibenPropina, recibePropina } from './quien-recibe-propina.ts';

/** DP-24 · En las propinas aparece sólo quien vende, cobra o atiende cuentas. */
describe('quién aparece en las propinas', () => {
  const EQUIPO = [
    { id: '1', nombre: 'Dueño', rol: 'dueno' },
    { id: '2', nombre: 'Gerente', rol: 'gerente' },
    { id: '3', nombre: 'Caja', rol: 'cajero' },
    { id: '4', nombre: 'Mesero', rol: 'mesero' },
    { id: '5', nombre: 'Cocina (Cocina)', rol: 'cocina' },
    { id: '6', nombre: 'Cocina (Bebidas)', rol: 'cocina' },
    { id: '7', nombre: 'Almacén', rol: 'almacen' },
    { id: '8', nombre: 'Administrador', rol: 'administrador' },
  ];

  it('mesero, cajero, gerente, administrador y dueño; nunca cocina, bebidas ni almacén', () => {
    expect(quienesRecibenPropina(EQUIPO).map((p) => p.nombre)).toEqual([
      'Dueño',
      'Gerente',
      'Caja',
      'Mesero',
      'Administrador',
    ]);
  });

  it('sin puesto conocido no aparece (ni lo que no es una persona)', () => {
    expect(recibePropina({ rol: null })).toBe(false);
    expect(recibePropina({})).toBe(false);
    expect(recibePropina(null)).toBe(false);
    expect(recibePropina({ rol: 'Mesero' })).toBe(false);
    expect(quienesRecibenPropina(null)).toEqual([]);
  });

  it('gerencia liquida por sí misma; la cajera y el mesero, no', () => {
    expect(['dueno', 'administrador', 'gerente'].map(liquidaSinPin)).toEqual([true, true, true]);
    expect(['cajero', 'mesero', 'cocina', null, undefined].map(liquidaSinPin)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});
