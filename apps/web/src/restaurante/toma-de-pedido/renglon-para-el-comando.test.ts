import { describe, expect, it } from 'vitest';

import { cantidadParaComando, renglonParaElComando } from './renglon-para-el-comando';

describe('DP-16 · el renglón del carrito como lo recibe el servidor', () => {
  it('la barbacoa por peso viaja con su peso real y su unidad, no con el 1 del carrito', () => {
    expect(
      renglonParaElComando({
        id: 'barbacoa',
        cantidad: 1,
        notas: 'Tortillas: Maíz · bien dorada',
        _modificadores: [{ grupo_id: 'g1', opciones: [{ id: 'maiz' }] }],
        _variable: { tipo_venta: 'variable_medida', cantidad_variable: 0.5, unidad_variable: 'kg' },
      }),
    ).toEqual({
      productoId: 'barbacoa',
      cantidad: '0.5',
      unidad: 'kg',
      notas: 'Tortillas: Maíz · bien dorada',
      opciones: [{ grupoId: 'g1', opcionIds: ['maiz'] }],
    });
  });

  it('por porción manda las porciones, sin unidad', () => {
    expect(
      renglonParaElComando({
        id: 'consome',
        cantidad: 1,
        _variable: { tipo_venta: 'porcion_contenedor', cantidad_porciones: 3 },
      }),
    ).toEqual({ productoId: 'consome', cantidad: '3', notas: '' });
  });

  it('una pieza normal manda su cantidad y ninguna opción vacía', () => {
    expect(
      renglonParaElComando({
        id: 'taco',
        cantidad: 2,
        _modificadores: [{ grupo_id: 'g1', opciones: [] }],
      }),
    ).toEqual({ productoId: 'taco', cantidad: '2', notas: '' });
  });

  it('una cantidad que no es positiva no sale', () => {
    expect(renglonParaElComando({ id: 'x', cantidad: 0 })).toBeNull();
    expect(cantidadParaComando('abc')).toBeNull();
    expect(cantidadParaComando(0.25)).toBe('0.25');
    expect(cantidadParaComando(1.123456)).toBe('1.1235');
  });
});
