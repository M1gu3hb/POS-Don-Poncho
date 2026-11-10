import { describe, expect, it } from 'vitest';

import {
  esParaLlevar,
  quienRecoge,
  rotuloDeLaComanda,
  rotuloHablado,
} from './rotulo-de-la-comanda';

describe('DP-16 · el rótulo de la comanda sale del canal, no de la falta de mesa', () => {
  it('un pedido para llevar dice su número y su nombre', () => {
    const pedido = {
      canal: 'llevar',
      numero_pedido: 3,
      nombre_pedido: ' Don Beto ',
      mesa_numero: null,
    };
    expect(rotuloDeLaComanda(pedido)).toBe('PARA LLEVAR · 3 · Don Beto');
    expect(rotuloHablado(pedido)).toBe('para llevar 3');
    expect(esParaLlevar(pedido)).toBe(true);
  });

  it('sin nombre, sólo el número', () => {
    expect(rotuloDeLaComanda({ canal: 'llevar', numero_pedido: 12, nombre_pedido: '' })).toBe(
      'PARA LLEVAR · 12',
    );
  });

  it('una mesa sigue siendo «Mesa N»', () => {
    const mesa = { canal: 'aqui', mesa_numero: 4, numero_pedido: null };
    expect(rotuloDeLaComanda(mesa)).toBe('Mesa 4');
    expect(rotuloHablado(mesa)).toBe('mesa 4');
    expect(esParaLlevar(mesa)).toBe(false);
  });

  it('sin mesa y sin canal para llevar es mostrador, no «para llevar»', () => {
    expect(rotuloDeLaComanda({ canal: 'aqui', mesa_numero: null })).toBe('Mostrador');
    expect(rotuloHablado({})).toBe('mostrador');
  });

  it('lo listo de un pedido para llevar lo espera la caja, no el mesero', () => {
    expect(quienRecoge({ canal: 'llevar', numero_pedido: 1 })).toMatch(/caja/);
    expect(quienRecoge({ canal: 'aqui', mesa_numero: 2 })).toMatch(/mesero/);
  });
});
