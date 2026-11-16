import { describe, expect, it } from 'vitest';

import { folioVisibleDeLaSesion, vestirFolio, vestirFolios } from './folios-vestidos.ts';

/**
 * DP-21 · Bloque 6 · el corte dice los folios como el ticket: con prefijo «DP-01003» y «DPC-0102»,
 * sin él, exactamente lo que armaba el SQL («A-3», «CC-2»).
 */
const DP = { folios: { prefijo: 'DP' } };
const SIN = { folios: { prefijo: null } };

describe('folios del corte, vestidos', () => {
  it('una fila con folio compuesto: con prefijo se viste; sin él, no cambia', () => {
    expect(vestirFolio('A-1003', DP)).toBe('DP-01003');
    expect(vestirFolio('A-1003', SIN)).toBe('A-1003');
    expect(vestirFolio('CC-102', DP)).toBe('DPC-0102');
  });

  it('lo que no es una cuenta o un corte, o no tiene folio, se queda como viene', () => {
    expect(vestirFolio(null, DP)).toBeNull();
    expect(vestirFolio('A-—', DP)).toBe('A-—');
    expect(vestirFolio('REM-114', DP)).toBe('REM-114');
  });

  it('vestirFolios no toca las filas originales', () => {
    const filas = [
      { folio: 'A-3', total: 5 },
      { folio: null, total: 6 },
    ];
    const vestidas = vestirFolios(filas, DP);
    expect(vestidas).toEqual([
      { folio: 'DP-00003', total: 5 },
      { folio: null, total: 6 },
    ]);
    expect(filas[0]?.folio).toBe('A-3');
  });

  it('el folio de la caja: serie y número sueltos', () => {
    expect(folioVisibleDeLaSesion('CC', '102', DP)).toBe('DPC-0102');
    expect(folioVisibleDeLaSesion('CC', '102', SIN)).toBe('CC-102');
    expect(folioVisibleDeLaSesion('CC', null, DP)).toBeNull();
  });
});
