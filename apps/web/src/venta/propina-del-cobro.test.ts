import { describe, expect, it } from 'vitest';

import { esLaPropinaPuesta, propinaDeLaCuenta, propinaParaLaCuenta } from './propina-del-cobro.ts';

/** DP-24 · La propina llega a la tarjeta ya puesta, y lo que se elige vuelve a la cuenta. */
describe('propinaDeLaCuenta', () => {
  it('la del portal por porcentaje llega encendida en su botón', () => {
    expect(
      propinaDeLaCuenta({ propina_tipo: 'porcentaje', propina_porcentaje: 10, total: 520 }),
    ).toEqual({ tipo: 'porcentaje', puntosBase: 1000 });
  });

  it('un monto llega con su importe; si no lo trae, sale de sus puntos base', () => {
    expect(
      propinaDeLaCuenta({ propina_tipo: 'monto_manual', propina_monto: 37, total: 520 }),
    ).toEqual({ tipo: 'monto', centavos: 3_700 });
    expect(
      propinaDeLaCuenta({ propina_tipo: 'monto_manual', propina_porcentaje: 7.12, total: 520 }),
    ).toEqual({ tipo: 'monto', centavos: 3_702 });
  });

  it('«sin propina» es una decisión; lo pendiente, lo que nadie decidió y lo raro, no', () => {
    expect(propinaDeLaCuenta({ propina_tipo: 'sin_propina' })).toEqual({ tipo: 'sin_propina' });
    for (const tipo of ['pendiente', 'pendiente_cliente', 'decidir_en_caja', null, undefined]) {
      expect(propinaDeLaCuenta({ propina_tipo: tipo, propina_monto: 50 })).toEqual({
        tipo: 'sin_elegir',
      });
    }
    expect(propinaDeLaCuenta(null)).toEqual({ tipo: 'sin_elegir' });
  });

  it('un porcentaje o un monto en cero es sin propina', () => {
    expect(propinaDeLaCuenta({ propina_tipo: 'porcentaje', propina_porcentaje: 0 })).toEqual({
      tipo: 'sin_propina',
    });
    expect(propinaDeLaCuenta({ propina_tipo: 'monto_manual', propina_monto: 0 })).toEqual({
      tipo: 'sin_propina',
    });
  });
});

describe('propinaParaLaCuenta', () => {
  it('un porcentaje: su importe al centavo, como el servidor', () => {
    expect(propinaParaLaCuenta({ tipo: 'porcentaje', puntosBase: 1500 }, 2_877_150)).toEqual({
      propina_tipo: 'porcentaje',
      propina_porcentaje: 15,
      propina_monto: 4_315.73,
    });
  });

  it('un monto: viaja con el porcentaje que le toca sobre la venta', () => {
    expect(propinaParaLaCuenta({ tipo: 'monto', centavos: 3_700 }, 52_000)).toEqual({
      propina_tipo: 'monto_manual',
      propina_porcentaje: 7.12,
      propina_monto: 37,
    });
  });

  it('sin propina, sin elegir y un monto en cero: sin propina', () => {
    const SIN = { propina_tipo: 'sin_propina', propina_porcentaje: 0, propina_monto: 0 };
    expect(propinaParaLaCuenta({ tipo: 'sin_propina' }, 52_000)).toEqual(SIN);
    expect(propinaParaLaCuenta({ tipo: 'sin_elegir' }, 52_000)).toEqual(SIN);
    expect(propinaParaLaCuenta({ tipo: 'monto', centavos: 0 }, 52_000)).toEqual(SIN);
  });

  it('ida y vuelta: lo que se elige es lo que después se ve encendido', () => {
    const elegida = { tipo: 'porcentaje', puntosBase: 2000 } as const;
    const enLaCuenta = propinaParaLaCuenta(elegida, 46_000);
    expect(propinaDeLaCuenta({ ...enLaCuenta, total: 460 })).toEqual(elegida);
  });
});

describe('esLaPropinaPuesta', () => {
  it('enciende sólo el botón de ESE porcentaje', () => {
    const puesta = { tipo: 'porcentaje', puntosBase: 1000 } as const;
    expect(esLaPropinaPuesta(puesta, { tipo: 'porcentaje', puntosBase: 1000 })).toBe(true);
    expect(esLaPropinaPuesta(puesta, { tipo: 'porcentaje', puntosBase: 1500 })).toBe(false);
    expect(esLaPropinaPuesta(puesta, { tipo: 'sin_propina' })).toBe(false);
    expect(esLaPropinaPuesta({ tipo: 'sin_propina' }, { tipo: 'sin_propina' })).toBe(true);
    // Sin elegir no enciende «Sin propina»: todavía nadie decidió.
    expect(esLaPropinaPuesta({ tipo: 'sin_elegir' }, { tipo: 'sin_propina' })).toBe(false);
  });
});
