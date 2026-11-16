import { describe, expect, it } from 'vitest';

import {
  coincideConElFolio,
  entenderElFolio,
  folioVisible,
  prefijoDeFolioValido,
  type ConFolios,
} from './folio-visible.ts';

/**
 * DP-21 · Bloque 6 · EL FOLIO COMO SE LEE.
 *
 * Sin prefijo, cada sitio dice EXACTAMENTE lo que decía antes (esa es la primera mitad: fija el
 * «como hoy» que hacían `corte-heredado/folio-y-mesa.ts` —«A-3», «CC-2»— y el ticket —«3»—). Con
 * prefijo, las cuentas son «DP-01001» y los cortes «DPC-0101»; el resto de las series no cambia.
 */

const DP: ConFolios = { folios: { prefijo: 'DP' } };
const SIN: ConFolios = { folios: { prefijo: null } };

describe('sin prefijo: como hoy', () => {
  it('con la serie, como lo escribe el documento del corte: «A-3», «CC-2»', () => {
    expect(folioVisible('A', '3', SIN)).toBe('A-3');
    expect(folioVisible('CC', 2, SIN)).toBe('CC-2');
    expect(folioVisible('A', 3n, undefined)).toBe('A-3');
  });

  it('el ticket y la lista enseñan el número a secas', () => {
    expect(folioVisible('A', '3', SIN, 'numero')).toBe('3');
    expect(folioVisible('A', '3', null, 'numero')).toBe('3');
  });

  it('un folio que ya viene compuesto se queda como viene', () => {
    expect(folioVisible(null, 'A-3', SIN)).toBe('A-3');
    expect(folioVisible('', 'CC-2', SIN)).toBe('CC-2');
    expect(folioVisible(null, 'A-3', SIN, 'numero')).toBe('A-3');
  });

  it('un registro viejo sin serie, el número como viene; sin folio, vacío', () => {
    expect(folioVisible(null, '3', SIN)).toBe('3');
    expect(folioVisible('A', null, SIN)).toBe('');
    expect(folioVisible('A', '  ', SIN)).toBe('');
    expect(folioVisible('A', undefined, DP)).toBe('');
  });

  it('un prefijo que no es de 2 a 4 letras A–Z no cuenta', () => {
    for (const malo of ['D', 'DPPPP', 'dp', 'D1', 'DÑ', '', '  ']) {
      expect(folioVisible('A', '3', { folios: { prefijo: malo } })).toBe('A-3');
    }
  });
});

describe('con prefijo', () => {
  it('las cuentas: prefijo, guion y al menos 5 dígitos', () => {
    expect(folioVisible('A', '1001', DP)).toBe('DP-01001');
    expect(folioVisible('A', 3, DP)).toBe('DP-00003');
    expect(folioVisible('A', 99_999, DP)).toBe('DP-99999');
    expect(folioVisible('A', 100_000, DP)).toBe('DP-100000');
    expect(folioVisible('A', '1001', DP, 'numero')).toBe('DP-01001');
  });

  it('los cortes: prefijo + C, guion y al menos 4 dígitos', () => {
    expect(folioVisible('CC', '101', DP)).toBe('DPC-0101');
    expect(folioVisible('CC', 9_999, DP)).toBe('DPC-9999');
    expect(folioVisible('CC', 10_000, DP)).toBe('DPC-10000');
  });

  it('un folio compuesto («A-1001», «CC-101») también se viste', () => {
    expect(folioVisible(null, 'A-1001', DP)).toBe('DP-01001');
    expect(folioVisible('', 'CC-101', DP)).toBe('DPC-0101');
  });

  it('las demás series no cambian, con o sin prefijo', () => {
    expect(folioVisible('REM', '114', DP)).toBe('REM-114');
    expect(folioVisible('REM', '114', DP, 'numero')).toBe('114');
    expect(folioVisible('CT', '4', DP)).toBe('CT-4');
    expect(folioVisible(null, 'LIQ-000007', DP)).toBe('LIQ-000007');
    expect(folioVisible(null, 'REM-114', DP)).toBe('REM-114');
  });

  it('sin saber la serie, un número a secas no se disfraza de cuenta', () => {
    expect(folioVisible(null, '3', DP)).toBe('3');
  });

  it('un valor que no es un entero positivo no se rellena', () => {
    expect(folioVisible('A', '3a', DP)).toBe('A-3a');
    expect(folioVisible('A', '-3', DP)).toBe('A--3');
  });
});

describe('prefijoDeFolioValido', () => {
  it('guarda en mayúsculas de 2 a 4 letras; vacío o nulo es «sin prefijo»', () => {
    expect(prefijoDeFolioValido('dp')).toEqual({ ok: true, prefijo: 'DP' });
    expect(prefijoDeFolioValido(' Dpon ')).toEqual({ ok: true, prefijo: 'DPON' });
    expect(prefijoDeFolioValido(null)).toEqual({ ok: true, prefijo: null });
    expect(prefijoDeFolioValido('   ')).toEqual({ ok: true, prefijo: null });
  });

  it('rechaza una letra, cinco, dígitos, acentos, ñ y espacios', () => {
    for (const malo of ['D', 'DPPPP', 'D1', 'DÁ', 'DÑ', 'D P', 'D-P']) {
      expect(prefijoDeFolioValido(malo).ok, malo).toBe(false);
    }
  });
});

describe('coincideConElFolio', () => {
  it('con prefijo, la cuenta 1001 es «1001», «01001» y «DP-01001» (con o sin guion, en minúsculas)', () => {
    for (const texto of [
      '1001',
      '01001',
      'DP-01001',
      'dp-01001',
      'dp01001',
      ' DP 01001 ',
      'DP-1001',
    ]) {
      expect(coincideConElFolio(texto, 'A', '1001', DP), texto).toBe(true);
    }
  });

  it('no coincide con otro número, con un trozo ni con el prefijo del corte', () => {
    expect(coincideConElFolio('1002', 'A', '1001', DP)).toBe(false);
    expect(coincideConElFolio('100', 'A', '1001', DP)).toBe(false);
    expect(coincideConElFolio('DPC-01001', 'A', '1001', DP)).toBe(false);
    expect(coincideConElFolio('XX-01001', 'A', '1001', DP)).toBe(false);
  });

  it('el corte 101 es «101», «0101» y «DPC-0101»', () => {
    for (const texto of ['101', '0101', 'DPC-0101', 'dpc0101']) {
      expect(coincideConElFolio(texto, 'CC', '101', DP), texto).toBe(true);
    }
    expect(coincideConElFolio('DP-0101', 'CC', '101', DP)).toBe(false);
  });

  it('lo de siempre sigue valiendo: el número y la serie («A-3», «CC-2»)', () => {
    expect(coincideConElFolio('3', 'A', '3', SIN)).toBe(true);
    expect(coincideConElFolio('03', 'A', '3', SIN)).toBe(true);
    expect(coincideConElFolio('a-3', 'A', '3', SIN)).toBe(true);
    expect(coincideConElFolio('A3', 'A', '3', DP)).toBe(true);
    expect(coincideConElFolio('CC-2', 'CC', '2', SIN)).toBe(true);
    expect(coincideConElFolio('CC-3', 'CC', '2', SIN)).toBe(false);
  });

  it('un folio compuesto se compara por su serie y su número', () => {
    expect(coincideConElFolio('DP-01001', null, 'A-1001', DP)).toBe(true);
    expect(coincideConElFolio('1001', '', 'A-1001', DP)).toBe(true);
  });

  it('texto vacío, sin folio o que no es un folio no coincide con nada', () => {
    expect(coincideConElFolio('', 'A', '3', SIN)).toBe(false);
    expect(coincideConElFolio('  ', 'A', '3', SIN)).toBe(false);
    expect(coincideConElFolio('3', 'A', null, SIN)).toBe(false);
    expect(coincideConElFolio('mesa 3', 'A', '3', SIN)).toBe(false);
    expect(coincideConElFolio('0', 'A', '0', SIN)).toBe(false);
  });
});

describe('entenderElFolio (lo que se teclea para buscar o devolver)', () => {
  it('«1001», «01001» y «DP-01001» son el número 1001 de las cuentas (si hay prefijo, su serie)', () => {
    expect(entenderElFolio('1001', DP)).toEqual({ serie: null, numero: '1001' });
    expect(entenderElFolio('01001', DP)).toEqual({ serie: null, numero: '1001' });
    expect(entenderElFolio('DP-01001', DP)).toEqual({ serie: 'A', numero: '1001' });
    expect(entenderElFolio(' dp 1001 ', DP)).toEqual({ serie: 'A', numero: '1001' });
    expect(entenderElFolio('DPC-0101', DP)).toEqual({ serie: 'CC', numero: '101' });
  });

  it('lo de siempre: «A-123», «a123», «CC-2» y el número a secas', () => {
    expect(entenderElFolio('A-123', SIN)).toEqual({ serie: 'A', numero: '123' });
    expect(entenderElFolio('a123', DP)).toEqual({ serie: 'A', numero: '123' });
    expect(entenderElFolio('CC-2', SIN)).toEqual({ serie: 'CC', numero: '2' });
    expect(entenderElFolio('123', SIN)).toEqual({ serie: null, numero: '123' });
  });

  it('sin prefijo configurado, «DP» es una serie cualquiera (y no existe): no se disfraza', () => {
    expect(entenderElFolio('DP-01001', SIN)).toEqual({ serie: 'DP', numero: '1001' });
  });

  it('lo que no es un folio no se entiende', () => {
    for (const malo of ['', '  ', 'DP', '12a', '-3', '3-A']) {
      expect(entenderElFolio(malo, DP), malo).toBeNull();
    }
  });
});
