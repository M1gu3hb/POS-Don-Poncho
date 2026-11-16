import { describe, expect, it } from 'vitest';

import {
  FOLIOS_DE_UN_NEGOCIO_NUEVO,
  esquemaDeFolios,
  foliosEn,
  operacionDesdeEn,
} from './folios-del-negocio.ts';

describe('foliosEn', () => {
  it('sin nada, o con algo que no es un documento, lo de un negocio nuevo', () => {
    for (const valores of [undefined, null, 5, [], {}, { folios: 'x' }, { folios: [] }]) {
      expect(foliosEn(valores)).toEqual(FOLIOS_DE_UN_NEGOCIO_NUEVO);
    }
  });

  it('lee lo guardado campo por campo; lo dañado vale lo de siempre', () => {
    expect(
      foliosEn({ folios: { prefijo: 'DP', primerFolioDeCuentas: 1001, primerFolioDeCortes: 101 } }),
    ).toEqual({ prefijo: 'DP', primerFolioDeCuentas: 1001, primerFolioDeCortes: 101 });
    expect(
      foliosEn({ folios: { prefijo: 'd', primerFolioDeCuentas: 0, primerFolioDeCortes: 7.5 } }),
    ).toEqual(FOLIOS_DE_UN_NEGOCIO_NUEVO);
    expect(foliosEn({ folios: { prefijo: 'DP', primerFolioDeCuentas: 'x' } })).toEqual({
      prefijo: 'DP',
      primerFolioDeCuentas: 1,
      primerFolioDeCortes: 1,
    });
  });
});

describe('esquemaDeFolios', () => {
  it('es estricto y acota el primer folio', () => {
    const bueno = { prefijo: 'DP', primerFolioDeCuentas: 1, primerFolioDeCortes: 99_999_999 };
    expect(esquemaDeFolios.safeParse(bueno).success).toBe(true);
    expect(esquemaDeFolios.safeParse({ ...bueno, extra: 1 }).success).toBe(false);
    expect(esquemaDeFolios.safeParse({ ...bueno, primerFolioDeCortes: 100_000_000 }).success).toBe(
      false,
    );
    expect(esquemaDeFolios.safeParse({ ...bueno, primerFolioDeCuentas: 0 }).success).toBe(false);
  });
});

describe('operacionDesdeEn', () => {
  it('sin clave (o nula) no hay bloqueo', () => {
    expect(operacionDesdeEn({})).toBeNull();
    expect(operacionDesdeEn({ operacion_desde: null })).toBeNull();
    expect(operacionDesdeEn(undefined)).toBeNull();
  });

  it('lee una fecha ISO con zona', () => {
    expect(operacionDesdeEn({ operacion_desde: '2026-11-16T09:00:00.000Z' })?.toISOString()).toBe(
      '2026-11-16T09:00:00.000Z',
    );
    expect(operacionDesdeEn({ operacion_desde: '2026-11-16T03:00:00-06:00' })?.toISOString()).toBe(
      '2026-11-16T09:00:00.000Z',
    );
  });

  it('una fecha dañada falla cerrada: bloquea desde el principio de los tiempos', () => {
    for (const mala of ['ayer', 5, true, '2026-11-16']) {
      expect(operacionDesdeEn({ operacion_desde: mala })?.getTime()).toBe(0);
    }
  });
});
