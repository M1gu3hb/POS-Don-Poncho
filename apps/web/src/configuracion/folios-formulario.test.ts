import { describe, expect, it } from 'vitest';

import {
  entradaDeLosFolios,
  foliosLeidos,
  numeroTecleado,
  porQueNoSeCambiaElPrimerFolio,
  prefijoTecleado,
  vistaPreviaDeLosFolios,
} from './folios-formulario.ts';

const DP = { prefijo: 'DP', primerFolioDeCuentas: '1001', primerFolioDeCortes: '101' };

describe('«Prefijo del folio» y «Primer folio»', () => {
  it('sin nada guardado, sin prefijo y desde 1', () => {
    expect(foliosLeidos(undefined)).toEqual({
      prefijo: '',
      primerFolioDeCuentas: '1',
      primerFolioDeCortes: '1',
      operaDesde: null,
    });
    expect(foliosLeidos({ folios: { prefijo: 'DP', primerFolioDeCuentas: 1001 } })).toMatchObject({
      prefijo: 'DP',
      primerFolioDeCuentas: '1001',
      primerFolioDeCortes: '1',
    });
  });

  it('el prefijo sólo deja pasar letras A–Z y hasta cuatro; los números, sólo dígitos', () => {
    expect(prefijoTecleado('d-p1ñ')).toBe('DP');
    expect(prefijoTecleado('dponcho')).toBe('DPON');
    expect(numeroTecleado('1a0,01')).toBe('1001');
  });

  it('la vista previa dice cómo se verán la cuenta y el corte', () => {
    expect(vistaPreviaDeLosFolios(DP)).toBe('Así se verá: DP-01001 · corte DPC-0101');
    expect(vistaPreviaDeLosFolios({ ...DP, prefijo: '' })).toBe('Así se verá: 1001 · corte CC-101');
  });

  it('lo que viaja al comando; un prefijo de una letra o un primer folio en cero no', () => {
    expect(entradaDeLosFolios(DP)).toEqual({
      ok: true,
      entrada: { prefijo: 'DP', primerFolioDeCuentas: 1001, primerFolioDeCortes: 101 },
    });
    expect(entradaDeLosFolios({ ...DP, prefijo: '' })).toMatchObject({ ok: true });
    expect(entradaDeLosFolios({ ...DP, prefijo: 'D' }).ok).toBe(false);
    expect(entradaDeLosFolios({ ...DP, primerFolioDeCortes: '0' }).ok).toBe(false);
    expect(entradaDeLosFolios({ ...DP, primerFolioDeCuentas: '' }).ok).toBe(false);
  });

  it('el primer folio se explica cuando no se puede cambiar', () => {
    expect(porQueNoSeCambiaElPrimerFolio(null, false)).toBeNull();
    expect(porQueNoSeCambiaElPrimerFolio(null, true)).toMatch(/folios en cero/);
    expect(porQueNoSeCambiaElPrimerFolio('2026-11-16T00:00:00.000Z', false)).toMatch(/ya opera/);
  });
});
