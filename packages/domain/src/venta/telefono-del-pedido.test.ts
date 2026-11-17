import { describe, expect, it } from 'vitest';

import {
  DIGITOS_MAXIMOS_DEL_TELEFONO,
  DIGITOS_MINIMOS_DEL_TELEFONO,
  LARGO_MAXIMO_DEL_TELEFONO,
  normalizarTelefonoDelPedido,
} from './telefono-del-pedido.ts';

/**
 * DP-D157 · El teléfono OPCIONAL del pedido para llevar: lo que se guarda y lo que se rechaza.
 *
 * Es un dato para llamar al cliente cuando el pedido está listo, no un identificador: sólo dígitos,
 * espacios, guiones y un «+» al inicio; de 7 a 15 dígitos (E.164 tiene 15 como máximo) y no más de
 * 20 caracteres. Se guarda limpio: sin espacios de más.
 */

const valido = (crudo: string | null | undefined): string | null => {
  const r = normalizarTelefonoDelPedido(crudo);
  if (!r.ok) throw new Error(`debía ser válido: ${r.motivo}`);
  return r.telefono;
};
const motivoDelRechazo = (crudo: string): string => {
  const r = normalizarTelefonoDelPedido(crudo);
  if (r.ok) throw new Error('debía rechazarse');
  return r.motivo;
};

describe('es opcional', () => {
  it.each([undefined, null, '', '   '])('«%s» es «sin teléfono», no un error', (crudo) => {
    expect(valido(crudo)).toBeNull();
  });
});

describe('lo que se acepta', () => {
  it.each([
    ['5524685678', '5524685678'],
    ['55 2468 5678', '55 2468 5678'],
    ['55-2468-5678', '55-2468-5678'],
    ['+52 55 2468 5678', '+52 55 2468 5678'],
    ['+525524685678', '+525524685678'],
    ['2468567', '2468567'],
  ])('%s', (crudo, esperado) => {
    expect(valido(crudo)).toBe(esperado);
  });

  it('se guarda limpio: sin bordes y con un solo espacio entre grupos', () => {
    expect(valido('  55   2468    5678  ')).toBe('55 2468 5678');
  });
});

describe('lo que se rechaza', () => {
  it.each([
    'abcdefghij',
    '55 2468 56x8',
    '(55) 2468 5678',
    '55.2468.5678',
    '5524685678;',
    'ext 123',
  ])('caracteres que no son de un teléfono: %s', (crudo) => {
    expect(motivoDelRechazo(crudo)).toContain('sólo lleva');
  });

  it('un «+» que no está al inicio', () => {
    expect(motivoDelRechazo('55+24685678')).toContain('sólo lleva');
    expect(motivoDelRechazo('++525524685678')).toContain('sólo lleva');
  });

  it('muy corto', () => {
    const corto = '1'.repeat(DIGITOS_MINIMOS_DEL_TELEFONO - 1);
    expect(motivoDelRechazo(corto)).toContain('dígitos');
  });

  it('muy largo en dígitos', () => {
    const largo = '1'.repeat(DIGITOS_MAXIMOS_DEL_TELEFONO + 1);
    expect(motivoDelRechazo(largo)).toContain('dígitos');
  });

  it('muy largo en caracteres, aunque los dígitos quepan', () => {
    const conMuchosEspacios = `${'1 '.repeat(DIGITOS_MINIMOS_DEL_TELEFONO)}${'-'.repeat(LARGO_MAXIMO_DEL_TELEFONO)}`;
    expect(motivoDelRechazo(conMuchosEspacios)).toContain('largo');
  });

  it('sólo guiones y espacios no es un teléfono', () => {
    expect(motivoDelRechazo('--- ---')).toContain('sólo lleva');
  });

  it('el límite exacto de dígitos sí entra', () => {
    expect(valido('1'.repeat(DIGITOS_MINIMOS_DEL_TELEFONO))).not.toBeNull();
    expect(valido('1'.repeat(DIGITOS_MAXIMOS_DEL_TELEFONO))).not.toBeNull();
  });
});
