import { describe, expect, it } from 'vitest';

import {
  comandasPorAnunciar,
  frasesAAnunciar,
  type ComandaParaAnunciar,
} from './anuncio-de-comandas';

/**
 * DP-21 · Bloque 8 · LO QUE ANUNCIA UN APARATO DE COCINA.
 *
 * «De componente»: el vigilante de Cocina entrega a estas funciones las comandas nuevas de su
 * pantalla y habla lo que devuelven. Una comanda con 3 renglones iguales debe salir en UNA frase
 * con «tres»; cada comanda, una vez; y un aparato que no anuncia, callado.
 */

const consome = { producto_id: 'p-consome', producto_nombre: 'Consomé de carnero', cantidad: 1 };

const comanda = (id: string, extra: Partial<ComandaParaAnunciar> = {}): ComandaParaAnunciar => ({
  id,
  mesa_numero: 4,
  items: [consome, consome, consome],
  ...extra,
});

const habla = { anuncia: true, vozActiva: true };

describe('las frases que un aparato dice', () => {
  it('una comanda con 3 renglones iguales produce UNA sola frase, con «tres»', () => {
    const frases = frasesAAnunciar([comanda('c1')], habla);
    expect(frases).toEqual(['Nuevo pedido mesa 4: tres Consomés de carnero.']);
    expect(frases[0]?.match(/Consomé/g)).toHaveLength(1);
  });

  it('cada comanda tiene su frase, en su orden, con su rótulo de canal', () => {
    const frases = frasesAAnunciar(
      [
        comanda('c1'),
        comanda('c2', {
          mesa_numero: null,
          canal: 'llevar',
          numero_pedido: 3,
          items: [{ producto_nombre: 'Mixiote', cantidad: 2 }],
        }),
      ],
      habla,
    );
    expect(frases).toEqual([
      'Nuevo pedido mesa 4: tres Consomés de carnero.',
      'Nuevo pedido para llevar 3: dos Mixiotes.',
    ]);
  });

  it('con «Esta pantalla anuncia las comandas» apagado, no dice nada', () => {
    expect(frasesAAnunciar([comanda('c1')], { anuncia: false, vozActiva: true })).toEqual([]);
  });

  it('con la voz de cocina apagada, no dice nada', () => {
    expect(frasesAAnunciar([comanda('c1')], { anuncia: true, vozActiva: false })).toEqual([]);
  });
});

describe('cada comanda se anuncia una vez por aparato', () => {
  it('lo ya anunciado no vuelve a sonar', () => {
    const nuevas = comandasPorAnunciar([comanda('c1'), comanda('c2')], new Set(['c1']));
    expect(nuevas.map((c) => c.id)).toEqual(['c2']);
  });

  it('una lectura que trae la misma comanda dos veces la anuncia una', () => {
    const nuevas = comandasPorAnunciar([comanda('c1'), comanda('c1'), comanda('c2')], new Set());
    expect(nuevas.map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});
