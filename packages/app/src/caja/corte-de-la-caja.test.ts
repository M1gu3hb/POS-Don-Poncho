import { describe, expect, it } from 'vitest';

import { ajustesDelCorteEn, entradaFijarAjustesDelCorte } from './corte-de-la-caja.ts';

/** DP-21 · Bloque 20 · los dos ajustes del corte de la Caja: qué se lee y qué se acepta. */
describe('ajustesDelCorteEn', () => {
  it('sin nada guardado: el cajero no ve costos y no hay tasa', () => {
    for (const valores of [undefined, null, 5, [], {}, { mostrar_costos_a_caja: 'sí' }]) {
      expect(ajustesDelCorteEn(valores)).toEqual({
        mostrarCostosACaja: false,
        comisionTerminalBp: null,
      });
    }
  });

  it('lee lo guardado; una tasa fuera de rango o con decimales se lee como «sin tasa»', () => {
    expect(ajustesDelCorteEn({ mostrar_costos_a_caja: true, comision_terminal_bp: 360 })).toEqual({
      mostrarCostosACaja: true,
      comisionTerminalBp: 360,
    });
    for (const mala of [-1, 1_001, 3.6, '360', null]) {
      expect(ajustesDelCorteEn({ comision_terminal_bp: mala }).comisionTerminalBp).toBeNull();
    }
  });
});

describe('entradaFijarAjustesDelCorte', () => {
  const bien = { mostrarCostosACaja: true, comisionTerminalBp: 360 };
  const acepta = (entrada: unknown): boolean =>
    entradaFijarAjustesDelCorte.safeParse(entrada).success;

  it('la tasa va en puntos base de 0 a 1000, o vacía', () => {
    expect(acepta(bien)).toBe(true);
    for (const buena of [null, 0, 1_000]) {
      expect(acepta({ ...bien, comisionTerminalBp: buena }), String(buena)).toBe(true);
    }
    for (const mala of [1_001, -1, 3.6, '360']) {
      expect(acepta({ ...bien, comisionTerminalBp: mala }), String(mala)).toBe(false);
    }
  });

  it('pide los dos y es estricto', () => {
    expect(acepta({ mostrarCostosACaja: true })).toBe(false);
    expect(acepta({ ...bien, extra: 1 })).toBe(false);
    expect(acepta({ ...bien, mostrarCostosACaja: 'sí' })).toBe(false);
  });
});
