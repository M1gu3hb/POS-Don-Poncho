import { describe, expect, it } from 'vitest';

import { veloDeColor } from './velo-de-color';

describe('el velo de un color que llega de la base (DP-21 · Bloque 15)', () => {
  it('un hex de seis dígitos pasa a rgb con alfa: sin color-mix, que Chromium < 111 no entiende', () => {
    expect(veloDeColor('#e8a838', 16)).toBe('rgb(232 168 56 / 16%)');
  });

  it('un hex de tres dígitos se expande', () => {
    expect(veloDeColor('#fa0', 16)).toBe('rgb(255 170 0 / 16%)');
  });

  it('no distingue mayúsculas ni espacios de más', () => {
    expect(veloDeColor('  #E8A838 ', 16)).toBe('rgb(232 168 56 / 16%)');
  });

  it('el porcentaje es el que se pide', () => {
    expect(veloDeColor('#000000', 40)).toBe('rgb(0 0 0 / 40%)');
  });

  it('un hex con alfa (8 dígitos) también se entiende: el alfa del color se multiplica', () => {
    expect(veloDeColor('#ff000080', 50)).toBe('rgb(255 0 0 / 25.1%)');
  });

  it('lo que no es hex (un nombre, un token) se deja al motor: color-mix, que el moderno sí entiende', () => {
    expect(veloDeColor('hsl(var(--acento))', 16)).toBe(
      'color-mix(in oklab, hsl(var(--acento)) 16%, transparent)',
    );
    expect(veloDeColor('tomato', 16)).toBe('color-mix(in oklab, tomato 16%, transparent)');
  });

  it('un color vacío o ilegible no rompe: queda transparente', () => {
    expect(veloDeColor('', 16)).toBe('transparent');
    expect(veloDeColor('#zzz', 16)).toBe('transparent');
  });

  it('un porcentaje fuera de 0 a 100 se acota', () => {
    expect(veloDeColor('#000', 250)).toBe('rgb(0 0 0 / 100%)');
    expect(veloDeColor('#000', -5)).toBe('rgb(0 0 0 / 0%)');
  });
});
