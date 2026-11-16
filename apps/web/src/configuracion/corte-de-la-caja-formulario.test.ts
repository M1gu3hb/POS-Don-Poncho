import { describe, expect, it } from 'vitest';

import {
  ajustesDelCorteIguales,
  ajustesDelCorteLeidos,
  comisionEnTexto,
  comisionTecleada,
  entradaDeLosAjustesDelCorte,
} from './corte-de-la-caja-formulario.ts';

/** DP-21 · Bloque 20 · «costos al cajero» y «comisión de la terminal» en la pantalla. */
describe('comisionEnTexto', () => {
  it('puntos base a porcentaje, sin ceros de más', () => {
    expect(comisionEnTexto(null)).toBe('');
    expect(comisionEnTexto(0)).toBe('0');
    expect(comisionEnTexto(360)).toBe('3.6');
    expect(comisionEnTexto(250)).toBe('2.5');
    expect(comisionEnTexto(305)).toBe('3.05');
    expect(comisionEnTexto(1_000)).toBe('10');
  });
});

describe('ajustesDelCorteLeidos', () => {
  it('sin nada guardado: el cajero no ve costos y no hay tasa', () => {
    expect(ajustesDelCorteLeidos(undefined)).toEqual({ mostrarCostosACaja: false, comision: '' });
    expect(ajustesDelCorteLeidos({ comision_terminal_bp: 5_000 }).comision).toBe('');
  });

  it('lee lo guardado', () => {
    expect(
      ajustesDelCorteLeidos({ mostrar_costos_a_caja: true, comision_terminal_bp: 360 }),
    ).toEqual({ mostrarCostosACaja: true, comision: '3.6' });
  });
});

describe('entradaDeLosAjustesDelCorte', () => {
  it('3.6 % viaja como 360 puntos base; vacío, sin tasa', () => {
    expect(entradaDeLosAjustesDelCorte({ mostrarCostosACaja: true, comision: '3.6' })).toEqual({
      ok: true,
      entrada: { mostrarCostosACaja: true, comisionTerminalBp: 360 },
    });
    expect(entradaDeLosAjustesDelCorte({ mostrarCostosACaja: false, comision: '' })).toEqual({
      ok: true,
      entrada: { mostrarCostosACaja: false, comisionTerminalBp: null },
    });
    expect(
      entradaDeLosAjustesDelCorte({ mostrarCostosACaja: false, comision: '10' }),
    ).toMatchObject({
      ok: true,
      entrada: { comisionTerminalBp: 1_000 },
    });
  });

  it('más de 10 %, o algo que no es un porcentaje, no se manda', () => {
    for (const mala of ['10.01', '11', '3.666', 'abc', '3,6,1']) {
      expect(
        entradaDeLosAjustesDelCorte({ mostrarCostosACaja: false, comision: mala }).ok,
        mala,
      ).toBe(false);
    }
  });
});

describe('comisionTecleada e igualdad', () => {
  it('sólo entra un porcentaje con hasta dos decimales', () => {
    expect(comisionTecleada('3,6')).toBe('3.6');
    expect(comisionTecleada('abc3.678')).toBe('3.67');
    expect(comisionTecleada('123')).toBe('12');
  });

  it('dos formularios son iguales si dicen lo mismo', () => {
    const a = { mostrarCostosACaja: true, comision: '3.6' };
    expect(ajustesDelCorteIguales(a, { ...a })).toBe(true);
    expect(ajustesDelCorteIguales(a, { ...a, comision: '3.5' })).toBe(false);
    expect(ajustesDelCorteIguales(a, { ...a, mostrarCostosACaja: false })).toBe(false);
  });
});
