import { describe, expect, it } from 'vitest';

import { CUADROS_A_MEDIR, debeMedirElVidrio, decidirVidrio } from './vidrio';

/**
 * DP-11.4 · EL VIDRIO, SÓLO SI EL APARATO LO AGUANTA. Se miden los cuadros en reposo una vez;
 * si la mediana pasa de 22 ms (menos de ~45 por segundo), el aparato queda en vidrio sólido.
 */

const cuadros = (ms: number, n = CUADROS_A_MEDIR): number[] => Array.from({ length: n }, () => ms);

describe('decidirVidrio', () => {
  it('a 60 cuadros, vidrio', () => {
    expect(decidirVidrio(cuadros(16.7))).toBe('vidrio');
  });

  it('un aparato que no llega, sólido', () => {
    expect(decidirVidrio(cuadros(33))).toBe('solido');
  });

  it('decide la mediana: un tirón suelto no condena al aparato', () => {
    const conTirones = [...cuadros(16.7, CUADROS_A_MEDIR - 5), 120, 140, 200, 90, 300];
    expect(decidirVidrio(conTirones)).toBe('vidrio');
  });

  it('justo en el umbral todavía es vidrio; un poco más, sólido', () => {
    expect(decidirVidrio(cuadros(22))).toBe('vidrio');
    expect(decidirVidrio(cuadros(22.5))).toBe('solido');
  });

  it('con pocos cuadros (la pestaña se escondió) no decide nada', () => {
    expect(decidirVidrio(cuadros(16.7, 10))).toBeNull();
    expect(decidirVidrio([])).toBeNull();
  });
});

describe('debeMedirElVidrio', () => {
  const base = { guardado: null, elevacion: 'capas', automatizado: false, visible: true };

  it('se mide una vez, con vidrio de por medio, a la vista y con una persona', () => {
    expect(debeMedirElVidrio(base)).toBe(true);
    expect(debeMedirElVidrio({ ...base, elevacion: 'aero' })).toBe(true);
  });

  it('no se mide otra vez, ni sin vidrio que medir', () => {
    expect(debeMedirElVidrio({ ...base, guardado: 'vidrio' })).toBe(false);
    expect(debeMedirElVidrio({ ...base, guardado: 'solido' })).toBe(false);
    expect(debeMedirElVidrio({ ...base, elevacion: 'sombra' })).toBe(false);
    expect(debeMedirElVidrio({ ...base, elevacion: null })).toBe(false);
  });

  it('ni en una pestaña escondida ni bajo un navegador automatizado (las pruebas)', () => {
    expect(debeMedirElVidrio({ ...base, visible: false })).toBe(false);
    expect(debeMedirElVidrio({ ...base, automatizado: true })).toBe(false);
  });
});
