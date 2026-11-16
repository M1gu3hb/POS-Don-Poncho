import { describe, expect, it } from 'vitest';

import type { LineaDelCarrito } from '~/portal/carrito-compartido/carrito-de-la-mesa';

import { etiquetaDelTelefono } from './etiqueta-del-telefono';

const linea = (agregadaEn?: string): LineaDelCarrito => ({
  id: 'l',
  productoId: 'p',
  nombre: 'Taco',
  cantidad: '1',
  notas: '',
  precioCentavos: null,
  esMia: false,
  ...(agregadaEn === undefined ? {} : { agregadaEn }),
});

describe('etiquetaDelTelefono · «Teléfono 2 · 14:05»', () => {
  it('dice el número y la hora de lo primero que agregó ese teléfono', () => {
    const lineas = [linea('2026-11-15T20:09:00.000Z'), linea('2026-11-15T20:05:00.000Z')];
    expect(etiquetaDelTelefono(2, lineas, 'UTC')).toBe('Teléfono 2 · 20:05');
  });

  it('la hora es la del aparato del mesero (la zona se respeta)', () => {
    expect(etiquetaDelTelefono(1, [linea('2026-11-15T20:05:00.000Z')], 'America/Mexico_City')).toBe(
      'Teléfono 1 · 14:05',
    );
  });

  it('sin hora (un servidor anterior), sólo el número', () => {
    expect(etiquetaDelTelefono(3, [linea()], 'UTC')).toBe('Teléfono 3');
    expect(etiquetaDelTelefono(3, [linea('no es fecha')], 'UTC')).toBe('Teléfono 3');
  });
});
