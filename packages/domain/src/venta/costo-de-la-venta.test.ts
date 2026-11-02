import { describe, expect, it } from 'vitest';

import { costoDeLaVentaEsDesconocido } from './costo-de-la-venta.ts';

/**
 * DP-12.6 · Una venta con importe y costo cero (o sin costo) tiene el costo DESCONOCIDO: un
 * platillo sin receta cuesta cero en la foto que se guarda al cobrar, y de ahí salía «100 %
 * margen». La unidad no importa (pesos o centavos): sólo el signo.
 */

describe('el costo de una venta es desconocido', () => {
  it('con importe y costo cero: sin receta', () => {
    expect(costoDeLaVentaEsDesconocido(200, 0)).toBe(true);
    expect(costoDeLaVentaEsDesconocido(20_000n, 0n)).toBe(true);
  });

  it('con importe y costo nulo: tampoco se sabe', () => {
    expect(costoDeLaVentaEsDesconocido(200, null)).toBe(true);
  });

  it('con costo: se sabe', () => {
    expect(costoDeLaVentaEsDesconocido(200, 80)).toBe(false);
    expect(costoDeLaVentaEsDesconocido(200, 0.01)).toBe(false);
  });

  it('una venta de importe cero no tiene margen que ocultar', () => {
    expect(costoDeLaVentaEsDesconocido(0, 0)).toBe(false);
    expect(costoDeLaVentaEsDesconocido(null, 0)).toBe(false);
    expect(costoDeLaVentaEsDesconocido(undefined, null)).toBe(false);
  });

  it('quien no ve costos (el campo no llega) no ve «sin receta»', () => {
    expect(costoDeLaVentaEsDesconocido(200, undefined)).toBe(false);
  });

  it('un texto de importe se lee como número; lo que no es número no cuenta', () => {
    expect(costoDeLaVentaEsDesconocido('200', '0')).toBe(true);
    expect(costoDeLaVentaEsDesconocido('abc', 0)).toBe(false);
  });
});
