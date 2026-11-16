import { describe, expect, it } from 'vitest';

import { seMencionaElIva, sinColumnaDeIvaEnCeros } from './se-menciona-el-iva.ts';

/** DP-21 · Bloque 1 · «Si está en cero, ni se menciona» (M9). */
describe('seMencionaElIva', () => {
  it('con IVA en 0, no: ni como número, ni como texto, ni como centavos grandes', () => {
    expect(seMencionaElIva(0)).toBe(false);
    expect(seMencionaElIva('0')).toBe(false);
    expect(seMencionaElIva('0.00')).toBe(false);
    expect(seMencionaElIva(0n)).toBe(false);
  });

  it('sin dato, tampoco: un renglón «IVA —» no le dice nada a nadie', () => {
    expect(seMencionaElIva(null)).toBe(false);
    expect(seMencionaElIva(undefined)).toBe(false);
    expect(seMencionaElIva('')).toBe(false);
    expect(seMencionaElIva('abc')).toBe(false);
    expect(seMencionaElIva(Number.NaN)).toBe(false);
  });

  it('con IVA de verdad, sí: un centavo ya cuenta', () => {
    expect(seMencionaElIva(0.01)).toBe(true);
    expect(seMencionaElIva(45.5)).toBe(true);
    expect(seMencionaElIva('62.07')).toBe(true);
    expect(seMencionaElIva(4550n)).toBe(true);
  });

  it('un importe negativo no es IVA que enseñar', () => {
    expect(seMencionaElIva(-1)).toBe(false);
    expect(seMencionaElIva(-1n)).toBe(false);
  });
});

describe('sinColumnaDeIvaEnCeros', () => {
  const columnas = [
    { key: 'folio', label: 'Folio' },
    { key: 'impuestos', label: 'Impuestos' },
    { key: 'total', label: 'Total' },
  ];

  it('si ninguna fila trae IVA, la columna no viaja', () => {
    const filas = [
      { folio: 'DP-01001', impuestos: 0, total: 100 },
      { folio: 'DP-01002', impuestos: '0', total: 50 },
    ];
    expect(sinColumnaDeIvaEnCeros(columnas, filas).map((c) => c.key)).toEqual(['folio', 'total']);
  });

  it('si una sola lo trae, la columna se queda para todas', () => {
    const filas = [
      { folio: 'A-1', impuestos: 13.79, total: 100 },
      { folio: 'DP-01001', impuestos: 0, total: 100 },
    ];
    expect(sinColumnaDeIvaEnCeros(columnas, filas)).toBe(columnas);
  });

  it('sin filas no hay IVA que enseñar', () => {
    expect(sinColumnaDeIvaEnCeros(columnas, []).map((c) => c.key)).toEqual(['folio', 'total']);
    expect(sinColumnaDeIvaEnCeros(columnas, null).map((c) => c.key)).toEqual(['folio', 'total']);
  });
});
