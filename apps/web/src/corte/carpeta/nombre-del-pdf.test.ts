import { describe, expect, it } from 'vitest';

import { fechaParaElArchivo, folioParaElArchivo } from './nombre-del-pdf.ts';

/**
 * DP-D153 · Lo que la página le da a la app para armar el nombre: el folio y el día. La app los valida
 * con expresiones estrictas (`Corte-<folio>-<AAAA-MM-DD>.pdf`); aquí se deja el folio en la forma que
 * esa validación acepta, y si no se puede, un folio de respaldo que SIEMPRE la pasa.
 */
const FOLIO_DE_LA_APP = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+){0,2}$/;
const ID = '5e000000-0000-4000-8000-000000000001';

describe('folioParaElArchivo', () => {
  it('un folio de la página se queda como está', () => {
    for (const folio of ['DPC-0102', 'CC-2', 'CT-15', '42'])
      expect(folioParaElArchivo(folio, ID)).toBe(folio);
  });

  it('espacios, acentos y símbolos se vuelven guiones o se quitan', () => {
    expect(folioParaElArchivo(' DPC 0102 ', ID)).toBe('DPC-0102');
    expect(folioParaElArchivo('Cortés/2', ID)).toBe('Cortes-2');
    expect(folioParaElArchivo('..\\..\\x1', ID)).toBe('x1');
  });

  it('sin folio, «sin folio», o sin ningún número → respaldo con el id de la sesión', () => {
    for (const folio of [null, undefined, '', '   ', 'sin folio', '---', 'CON', 'COM1', 'lpt9']) {
      expect(folioParaElArchivo(folio, ID), String(folio)).toBe('SF-5E000000');
    }
  });

  it('demasiado largo o con demasiados tramos → respaldo', () => {
    expect(folioParaElArchivo('A'.repeat(20) + '-12345', ID)).toBe('SF-5E000000');
    expect(folioParaElArchivo('A-1-B-2', ID)).toBe('SF-5E000000');
  });

  it('el resultado SIEMPRE lo acepta la app, pase lo que pase', () => {
    const raros = [
      '..',
      'C:\\x',
      '\u0000',
      'a'.repeat(500),
      '🙂1',
      'COM1',
      'nul',
      '9'.repeat(30),
      '-1-',
      'x y z 1',
    ];
    for (const folio of raros) {
      const r = folioParaElArchivo(folio, ID);
      expect(FOLIO_DE_LA_APP.test(r) && r.length <= 24, `${folio} → ${r}`).toBe(true);
    }
    expect(FOLIO_DE_LA_APP.test(folioParaElArchivo('sin folio', ''))).toBe(true);
    expect(FOLIO_DE_LA_APP.test(folioParaElArchivo('sin folio', '***'))).toBe(true);
  });
});

describe('fechaParaElArchivo: el día del NEGOCIO (DP-D152), no UTC ni el del aparato', () => {
  it('un día suelto se queda; un instante cae en el día de México', () => {
    expect(fechaParaElArchivo('2026-11-16')).toBe('2026-11-16');
    expect(fechaParaElArchivo('2026-11-17T01:30:00Z')).toBe('2026-11-16');
    expect(fechaParaElArchivo(new Date('2026-11-17T05:59:00Z'))).toBe('2026-11-16');
    expect(fechaParaElArchivo(new Date('2026-11-17T06:00:00Z'))).toBe('2026-11-17');
  });

  it('lo que no se entiende usa HOY del negocio', () => {
    const ahora = new Date('2026-11-17T01:30:00Z');
    for (const raro of [null, undefined, '', 'ayer', 12, new Date('x')]) {
      expect(fechaParaElArchivo(raro, ahora), String(raro)).toBe('2026-11-16');
    }
  });
});
