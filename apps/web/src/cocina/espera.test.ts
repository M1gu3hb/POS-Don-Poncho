import { describe, expect, it } from 'vitest';

import {
  alertasValidas,
  nivelDeEspera,
  minutosTranscurridos,
  textoDeEspera,
  umbralesDeCocina,
  UMBRALES_POR_OMISION,
} from './espera';

/**
 * DP-16 · 2.2 · EL TIEMPO DE ESPERA CON COLOR: verde, ámbar y rojo, con umbrales de la configuración.
 */

describe('umbralesDeCocina', () => {
  it('sin configurar son 10 y 20 minutos', () => {
    expect(UMBRALES_POR_OMISION).toEqual({ ambarMin: 10, rojoMin: 20 });
    expect(umbralesDeCocina({})).toEqual({ ambarMin: 10, rojoMin: 20 });
    expect(umbralesDeCocina(null)).toEqual({ ambarMin: 10, rojoMin: 20 });
  });

  it('lee los de la configuración', () => {
    expect(umbralesDeCocina({ cocina_alerta_ambar_min: 6, cocina_alerta_roja_min: 12 })).toEqual({
      ambarMin: 6,
      rojoMin: 12,
    });
  });

  it('un valor que no es un entero de 1 a 240 se ignora', () => {
    for (const malo of [0, -3, 2.5, '7', null, 241, Number.NaN]) {
      expect(
        umbralesDeCocina({ cocina_alerta_ambar_min: malo, cocina_alerta_roja_min: 15 }),
      ).toEqual({ ambarMin: 10, rojoMin: 15 });
    }
  });

  it('si el rojo no queda después del ámbar, valen los de siempre', () => {
    expect(umbralesDeCocina({ cocina_alerta_ambar_min: 20, cocina_alerta_roja_min: 20 })).toEqual({
      ambarMin: 10,
      rojoMin: 20,
    });
    expect(umbralesDeCocina({ cocina_alerta_ambar_min: 30, cocina_alerta_roja_min: 5 })).toEqual({
      ambarMin: 10,
      rojoMin: 20,
    });
  });
});

describe('alertasValidas', () => {
  it('enteros de 1 a 240 con el rojo después del ámbar', () => {
    expect(alertasValidas(10, 20)).toBe(true);
    expect(alertasValidas(1, 240)).toBe(true);
  });

  it('lo demás no se deja guardar', () => {
    for (const [a, r] of [
      [20, 20],
      [30, 10],
      [0, 5],
      [5, 241],
      [2.5, 9],
      ['10', 20],
      ['', 20],
      [10, ''],
    ]) {
      expect(alertasValidas(a, r), `${String(a)} / ${String(r)}`).toBe(false);
    }
  });
});

describe('nivelDeEspera', () => {
  const u = { ambarMin: 10, rojoMin: 20 };

  it('verde antes del ámbar, ámbar desde el ámbar, rojo desde el rojo', () => {
    expect(nivelDeEspera(0, u)).toBe('verde');
    expect(nivelDeEspera(9, u)).toBe('verde');
    expect(nivelDeEspera(10, u)).toBe('ambar');
    expect(nivelDeEspera(19, u)).toBe('ambar');
    expect(nivelDeEspera(20, u)).toBe('rojo');
    expect(nivelDeEspera(95, u)).toBe('rojo');
  });

  it('sin tiempo (fecha que no se pudo leer) no pinta alarma', () => {
    expect(nivelDeEspera(null, u)).toBe('verde');
  });
});

describe('minutosTranscurridos', () => {
  const ahora = new Date('2026-11-10T18:30:00Z').getTime();

  it('cuenta minutos completos', () => {
    expect(minutosTranscurridos('2026-11-10T18:21:01Z', ahora)).toBe(8);
    expect(minutosTranscurridos('2026-11-10T18:10:00Z', ahora)).toBe(20);
  });

  it('un reloj adelantado no da minutos negativos', () => {
    expect(minutosTranscurridos('2026-11-10T18:40:00Z', ahora)).toBe(0);
  });

  it('una fecha ausente o ilegible es null', () => {
    expect(minutosTranscurridos(null, ahora)).toBeNull();
    expect(minutosTranscurridos(undefined, ahora)).toBeNull();
    expect(minutosTranscurridos('ayer', ahora)).toBeNull();
  });
});

describe('textoDeEspera', () => {
  it('lo dice en minutos y, de una hora en adelante, en horas', () => {
    expect(textoDeEspera(0)).toBe('Ahora');
    expect(textoDeEspera(1)).toBe('1 min');
    expect(textoDeEspera(18)).toBe('18 min');
    expect(textoDeEspera(60)).toBe('1 h');
    expect(textoDeEspera(65)).toBe('1 h 5 min');
  });

  it('sin tiempo, un guion', () => {
    expect(textoDeEspera(null)).toBe('—');
  });
});
