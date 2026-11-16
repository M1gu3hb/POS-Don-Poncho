import { describe, expect, it } from 'vitest';

import {
  CATEGORIAS_DE_GASTO,
  CLAVES_DE_CATEGORIA_DE_GASTO,
  SI_NO_SALIO_DE_LA_CAJA,
  avisoDeEfectivoNegativo,
  esCategoriaDeGasto,
  fraseDeDondeSale,
  frasePagado,
  nombreDeLaCategoria,
} from './index.ts';

/** DP-21 · Bloque 11 · el catálogo único y lo que se dice del efectivo que sale de la caja. */
describe('el catálogo de categorías de gasto', () => {
  it('son siete, sin repetir, cada una con su nombre corto y su nombre completo', () => {
    expect(CATEGORIAS_DE_GASTO.map((c) => c.clave)).toEqual([...CLAVES_DE_CATEGORIA_DE_GASTO]);
    expect(new Set(CLAVES_DE_CATEGORIA_DE_GASTO).size).toBe(7);
    for (const c of CATEGORIAS_DE_GASTO) {
      expect(c.nombre.length).toBeGreaterThan(2);
      expect(c.completo.length).toBeGreaterThanOrEqual(c.nombre.length);
    }
  });

  it('la Caja ya no se queda corta: pago extraordinario y marketing también están', () => {
    expect(esCategoriaDeGasto('pago_extraordinario')).toBe(true);
    expect(esCategoriaDeGasto('marketing')).toBe(true);
    expect(esCategoriaDeGasto('mordida')).toBe(false);
    expect(nombreDeLaCategoria('reparacion')).toBe('Reparación');
    expect(nombreDeLaCategoria('algo_viejo')).toBe('algo_viejo');
  });
});

describe('frasePagado', () => {
  it('dice de qué caja salió el efectivo, y los otros métodos por su nombre', () => {
    expect(frasePagado('efectivo', 'Caja principal')).toBe('Pagado en efectivo de Caja principal');
    expect(frasePagado('efectivo', null)).toBe('Pagado en efectivo');
    expect(frasePagado('tarjeta', 'Caja principal')).toBe('Pagado con tarjeta');
    expect(frasePagado('transferencia', null)).toBe('Pagado por transferencia');
  });
});

describe('de qué caja sale', () => {
  it('la de este aparato, o la otra abierta cuando éste no tiene caja', () => {
    expect(fraseDeDondeSale('Caja principal', true)).toBe('Sale del cajón de Caja principal');
    expect(fraseDeDondeSale('Caja barra', false)).toBe(
      'Este aparato no tiene caja propia: sale del cajón de Caja barra',
    );
    expect(SI_NO_SALIO_DE_LA_CAJA).toBe(
      '¿No salió de la caja? Regístralo como transferencia o tarjeta',
    );
  });
});

describe('avisoDeEfectivoNegativo', () => {
  it('no avisa si el esperado alcanza, ni cuando queda justo en cero', () => {
    expect(avisoDeEfectivoNegativo(100_000n, 20_000n)).toBeNull();
    expect(avisoDeEfectivoNegativo(20_000n, 20_000n)).toBeNull();
  });

  it('avisa cuánto tiene la caja cuando el gasto la dejaría en negativo', () => {
    expect(avisoDeEfectivoNegativo(15_050n, 20_000n)).toBe(
      'La caja sólo tiene $150.50. ¿Lo pagaste de la caja? Si no, regístralo con transferencia o tarjeta',
    );
    expect(avisoDeEfectivoNegativo(123_456_789n, 200_000_000n)).toContain('$1,234,567.89');
  });

  it('si la caja ya está en cero o en negativo, dice que sólo tiene $0.00', () => {
    expect(avisoDeEfectivoNegativo(0n, 100n)).toContain('sólo tiene $0.00');
    expect(avisoDeEfectivoNegativo(-5_000n, 100n)).toContain('sólo tiene $0.00');
  });
});
