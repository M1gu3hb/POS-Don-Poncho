import { describe, expect, it } from 'vitest';

import { aCentavos, entradaParaEnviar, retiroParaEnviar } from './importe-tecleado.ts';

/**
 * El importe tecleado en la caja y el retiro que sale de él: la tienda y el salón usan la
 * MISMA cuenta (D.1 de la 2.4).
 */

describe('el importe que se teclea', () => {
  it('vacío es cero y lo mal escrito no es un importe', () => {
    expect(aCentavos('500')).toBe(50_000);
    expect(aCentavos('0.5')).toBe(50);
    expect(aCentavos('')).toBe(0);
    expect(aCentavos('   ')).toBe(0);
    expect(aCentavos('abc')).toBeNull();
    expect(aCentavos('12345678')).toBeNull();
    expect(aCentavos('12.345')).toBeNull();
    expect(aCentavos('-5')).toBeNull();
  });

  it.each([
    ['1,500', 150_000],
    ['1,500.50', 150_050],
    ['12,345.5', 1_234_550],
    ['1,234,567', 123_456_700],
    ['999', 99_900],
    [' 1,500 ', 150_000],
  ])('la coma de miles se entiende: «%s»', (texto, centavos) => {
    expect(aCentavos(texto)).toBe(centavos);
  });

  it.each([
    '1,5',
    '12,50',
    '1,50',
    '1,5000',
    '1,23,456',
    ',500',
    '1,',
    '1,500,',
    '1,500,5',
    '1,500.5.0',
  ])('lo ambiguo se rechaza, no se adivina: «%s»', (texto) => {
    expect(aCentavos(texto)).toBeNull();
  });

  it('lo ambiguo explica cómo escribirlo', () => {
    const resultado = retiroParaEnviar('1,5', 'pago de hielo');
    expect(resultado).toEqual({
      tropiezo:
        'No entiendo «1,5». Los miles van con coma y los centavos con punto: 1,500 son mil quinientos; 1,500.50 lleva centavos; 15.50 son quince con cincuenta.',
    });
    expect(entradaParaEnviar('12,50', 'banco', '')).toEqual({
      tropiezo:
        'No entiendo «12,50». Los miles van con coma y los centavos con punto: 1,500 son mil quinientos; 1,500.50 lleva centavos; 15.50 son quince con cincuenta.',
    });
  });

  it('un importe con coma de miles llega en centavos al retiro', () => {
    expect(retiroParaEnviar('1,500.50', 'pago a Bimbo')).toEqual({
      cuerpo: { tipo: 'retiro', montoCentavos: -150_050, motivo: 'pago a Bimbo' },
    });
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
    expect(retiroParaEnviar('500', 'ok')).toEqual({
      tropiezo: 'Escribe a dónde va ese dinero: al menos 5 letras.',
    });
  });

  it('el motivo mínimo es de 5 letras recortadas (el mismo número que exige el servidor)', () => {
    expect('cuerpo' in retiroParaEnviar('500', 'hiel')).toBe(false);
    expect('cuerpo' in retiroParaEnviar('500', '  hiel  ')).toBe(false);
    expect('cuerpo' in retiroParaEnviar('500', 'hielo')).toBe(true);
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
