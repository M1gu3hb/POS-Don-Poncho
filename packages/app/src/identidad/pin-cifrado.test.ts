import { randomBytes } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({}),
}));

import { cifrarPin, descifrarPin, llaveDelPin } from './pin-cifrado.ts';

const llave = llaveDelPin(randomBytes(32).toString('base64'));
if (llave === null) throw new Error('la llave de prueba debía servir');
const otraLlave = llaveDelPin(randomBytes(32).toString('base64'));
if (otraLlave === null) throw new Error('la otra llave de prueba debía servir');

const IDENTIDAD = '11111111-2222-3333-4444-555555555555';
const OTRA_IDENTIDAD = '99999999-8888-7777-6666-555555555555';

describe('la copia cifrada del PIN', () => {
  it('se descifra con su llave y su identidad', () => {
    expect(descifrarPin(cifrarPin('4826', llave, IDENTIDAD), llave, IDENTIDAD)).toBe('4826');
  });

  it('nunca guarda el PIN a la vista, y dos copias del mismo PIN no se parecen', () => {
    const a = cifrarPin('482613', llave, IDENTIDAD);
    const b = cifrarPin('482613', llave, IDENTIDAD);
    expect(a).not.toContain('482613');
    expect(a).not.toBe(b);
  });

  it('copiada a la fila de OTRA persona no se descifra', () => {
    expect(descifrarPin(cifrarPin('4826', llave, IDENTIDAD), llave, OTRA_IDENTIDAD)).toBeNull();
  });

  it('con otra llave no se descifra', () => {
    expect(descifrarPin(cifrarPin('4826', llave, IDENTIDAD), otraLlave, IDENTIDAD)).toBeNull();
  });

  it('alterada (un carácter del cuerpo o de la etiqueta) no se descifra', () => {
    const copia = cifrarPin('4826', llave, IDENTIDAD);
    const [v, iv, etiqueta = '', cuerpo = ''] = copia.split('.');
    const cambiar = (s: string) => `${s.startsWith('A') ? 'B' : 'A'}${s.slice(1)}`;
    expect(descifrarPin([v, iv, etiqueta, cambiar(cuerpo)].join('.'), llave, IDENTIDAD)).toBeNull();
    expect(descifrarPin([v, iv, cambiar(etiqueta), cuerpo].join('.'), llave, IDENTIDAD)).toBeNull();
    expect(descifrarPin('v0.algo.que.no', llave, IDENTIDAD)).toBeNull();
  });

  it('sin llave, o con una que no mide 32 bytes, la función se apaga', () => {
    expect(llaveDelPin(undefined)).toBeNull();
    expect(llaveDelPin('')).toBeNull();
    expect(llaveDelPin(randomBytes(16).toString('base64'))).toBeNull();
    expect(llaveDelPin('no es base64 !!')).toBeNull();
  });
});
