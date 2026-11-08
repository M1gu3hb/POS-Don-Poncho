import { describe, expect, it } from 'vitest';

import { aCentavos, entradaParaEnviar, retiroParaEnviar } from './importe-tecleado.ts';

/**
 * El importe tecleado en la caja y el retiro que sale de él: la tienda y el salón usan la
 * MISMA cuenta (D.1 de la 2.4).
 */

describe('el importe que se teclea', () => {
  it('la coma es el decimal, vacío es cero y lo mal escrito no es un importe', () => {
    expect(aCentavos('500')).toBe(50_000);
    expect(aCentavos('12,50')).toBe(1_250);
    expect(aCentavos('0.5')).toBe(50);
    expect(aCentavos('')).toBe(0);
    expect(aCentavos('1,250.00')).toBeNull();
    expect(aCentavos('12345678')).toBeNull();
  });
});

describe('el retiro', () => {
  it('sale NEGATIVO del cajón, con su motivo sin espacios de sobra', () => {
    expect(retiroParaEnviar('500', '  al banco ')).toEqual({
      cuerpo: { tipo: 'retiro', montoCentavos: -50_000, motivo: 'al banco' },
    });
  });

  it('sin importe o sin a dónde va, no se manda', () => {
    expect(retiroParaEnviar('', 'al banco')).toEqual({ tropiezo: 'Pon cuánto se retira.' });
    expect(retiroParaEnviar('abc', 'al banco')).toEqual({ tropiezo: 'Pon cuánto se retira.' });
    expect(retiroParaEnviar('500', 'ok')).toEqual({ tropiezo: 'Escribe a dónde va ese dinero.' });
  });
});

describe('DP-15 · la entrada de cambio al cajón', () => {
  it('manda el importe en centavos, con su origen, y el motivo sólo si lo hay', () => {
    expect(entradaParaEnviar('500', 'banco', '')).toEqual({
      cuerpo: { chicosCentavos: 50_000, monedasCentavos: 0, origen: 'banco', motivo: null },
    });
    expect(entradaParaEnviar('250.50', 'dueno', ' cambio para el fin de semana ')).toEqual({
      cuerpo: {
        chicosCentavos: 25_050,
        monedasCentavos: 0,
        origen: 'dueno',
        motivo: 'cambio para el fin de semana',
      },
    });
  });

  it('sin importe, o con uno ilegible, no se manda nada', () => {
    expect(entradaParaEnviar('', 'banco', 'x')).toEqual({ tropiezo: 'Pon cuánto entra al cajón.' });
    expect(entradaParaEnviar('12.345', 'banco', 'x')).toEqual({
      tropiezo: 'Pon cuánto entra al cajón.',
    });
  });
});
