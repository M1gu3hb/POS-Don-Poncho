import { describe, expect, it } from 'vitest';

import { estaAgotado } from './agotado.ts';

describe('DP-15 · estaAgotado', () => {
  const ahora = new Date('2026-11-14T15:00:00.000Z');

  it('sin marca, disponible', () => {
    expect(estaAgotado(null, ahora)).toBe(false);
    expect(estaAgotado(undefined, ahora)).toBe(false);
  });

  it('agotado mientras el fin del día no llega', () => {
    expect(estaAgotado(new Date('2026-11-15T06:00:00.000Z'), ahora)).toBe(true);
    expect(estaAgotado('2026-11-15T06:00:00.000Z', ahora)).toBe(true);
  });

  it('a la hora de corte, y después, vuelve a estar disponible', () => {
    expect(estaAgotado(new Date(ahora.getTime()), ahora)).toBe(false);
    expect(estaAgotado(new Date('2026-11-14T06:00:00.000Z'), ahora)).toBe(false);
  });

  it('una fecha ilegible no agota nada', () => {
    expect(estaAgotado('no es fecha', ahora)).toBe(false);
  });
});
