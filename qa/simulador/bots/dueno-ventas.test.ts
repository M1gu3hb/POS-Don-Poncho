import { describe, expect, it } from 'vitest';

import type { Asiento } from '../libro.ts';
import { RITMO_POR_OMISION } from './caja-descuento.ts';
import { muestraDeCobros } from './dueno-ventas.ts';

type Cobro = Extract<Asiento, { tipo: 'cobro' }>;

const cobro = (folio: string, cuenta: string, extra: Partial<Cobro> = {}): Cobro => ({
  tipo: 'cobro',
  caja: 'Caja 1',
  cuenta,
  folio,
  canal: 'mesa',
  totalCentavos: 10_000,
  propinaCentavos: 0,
  descuentoCentavos: 0,
  pagos: { efectivo: 10_000, tarjeta: 0, transferencia: 0 },
  cambioCentavos: 0,
  ...extra,
});

describe('la muestra del historial de ventas', () => {
  it('incluye descuentos, partes de cuentas divididas y pedidos para llevar, sin repetir folios', () => {
    const cobros = [
      ...Array.from({ length: 30 }, (_, i) => cobro(String(i + 1), `c${String(i + 1)}`)),
      cobro('31', 'c31', { descuentoCentavos: 500 }),
      cobro('32', 'dividida'),
      cobro('33', 'dividida'),
      cobro('34', 'llevar-1', { canal: 'llevar' }),
    ];
    const muestra = muestraDeCobros(cobros);
    const folios = muestra.map((c) => c.folio);
    expect(new Set(folios).size).toBe(folios.length);
    expect(muestra.length).toBeLessThanOrEqual(12);
    expect(folios).toEqual(expect.arrayContaining(['31', '32', '33', '34']));
  });

  it('con pocos cobros los toma todos', () => {
    expect(muestraDeCobros([cobro('1', 'a'), cobro('2', 'b')])).toHaveLength(2);
    expect(muestraDeCobros([])).toHaveLength(0);
  });
});

describe('el ritmo de la caja por omisión', () => {
  it('da, en un día de ~150 cobros, al menos 10 divisiones y 20 descuentos con PIN', () => {
    const cobros = 150;
    expect(cobros * RITMO_POR_OMISION.dividir).toBeGreaterThanOrEqual(10);
    expect(cobros * RITMO_POR_OMISION.descuentoConPin).toBeGreaterThanOrEqual(20);
    expect(RITMO_POR_OMISION.descuentoSinPin).toBeGreaterThan(0);
  });
});
