import { describe, expect, it } from 'vitest';

import {
  estadosDe,
  ordenDeLaLista,
  recienListos,
  tituloDelPedido,
  type PedidoParaLlevar,
} from './pedidos-para-llevar';

const pedido = (numero: number, estado: PedidoParaLlevar['estado']): PedidoParaLlevar => ({
  ordenId: `o${String(numero)}`,
  numero,
  nombre: null,
  folio: `A-${String(numero)}`,
  totalCentavos: '0',
  cobradoEn: null,
  estado,
  pendientes: estado === 'en_cocina' ? 1 : 0,
  listas: estado === 'listo' ? 1 : 0,
  listoEn: null,
});

describe('DP-16 · los avisos de los pedidos para llevar en la Caja', () => {
  it('suena sólo el que acaba de pasar a listo', () => {
    const antes = estadosDe([pedido(1, 'en_cocina'), pedido(2, 'listo')]);
    const ahora = [pedido(1, 'listo'), pedido(2, 'listo'), pedido(3, 'en_cocina')];
    expect(recienListos(antes, ahora).map((p) => p.numero)).toEqual([1]);
  });

  it('al abrir la Caja no anuncia lo que ya estaba listo', () => {
    expect(recienListos(null, [pedido(1, 'listo')])).toEqual([]);
  });

  it('un pedido nuevo que llega ya listo sí se anuncia', () => {
    expect(recienListos(new Map(), [pedido(4, 'listo')]).map((p) => p.numero)).toEqual([4]);
  });

  it('lo listo va arriba, luego lo que está en cocina, luego lo entregado', () => {
    const lista = ordenDeLaLista([
      pedido(3, 'entregado'),
      pedido(2, 'en_cocina'),
      pedido(5, 'listo'),
      pedido(1, 'listo'),
    ]);
    expect(lista.map((p) => p.numero)).toEqual([1, 5, 2, 3]);
  });

  it('el título lleva el nombre si lo hay', () => {
    expect(tituloDelPedido({ numero: 3, nombre: 'Don Beto' })).toBe(
      'Pedido para llevar 3 · Don Beto',
    );
    expect(tituloDelPedido({ numero: 7, nombre: '  ' })).toBe('Pedido para llevar 7');
    // DP-18 · M3: lo cobrado otro día y sin entregar se distingue del número igual de hoy.
    expect(tituloDelPedido({ numero: 7, nombre: 'Ana', deOtroDia: true })).toBe(
      'Pedido para llevar 7 · Ana · de ayer',
    );
    expect(tituloDelPedido({ numero: 7, nombre: null, deOtroDia: false })).toBe('Pedido para llevar 7');
  });
});
