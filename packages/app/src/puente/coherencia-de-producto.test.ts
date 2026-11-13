import { describe, expect, it } from 'vitest';

import { cuadrarProducto, estrategiaDeConsumo, PRODUCTO_NUEVO } from './coherencia-de-producto.ts';

/**
 * DP-18 · A2 y A3 · La coherencia de un producto que escribe el puente, sin base de datos.
 * Lo que llega por la pantalla vieja se cuadra o se rechaza con 422 (`CATALOGO_INVALIDO`).
 */

const BASE = '11111111-1111-4111-8111-111111111111';

const porPorcion = {
  tipo_venta: 'porcion_contenedor',
  insumo_base_id: BASE,
  capacidad_contenedor_ml: '750',
  porciones_por_contenedor: '25',
  precio_por_porcion_centavos: 9_000n,
};

describe('A3 · la estrategia de consumo se deduce del tipo de venta', () => {
  it('por medida con ingrediente base baja ese insumo', () => {
    expect(
      estrategiaDeConsumo({
        tipo_venta: 'variable_medida',
        insumo_base_id: BASE,
        estrategia_consumo: 'sku',
      }),
    ).toBe('insumo_base');
  });

  it('por porción con ingrediente base baja ese insumo', () => {
    expect(
      estrategiaDeConsumo({
        tipo_venta: 'porcion_contenedor',
        insumo_base_id: BASE,
        estrategia_consumo: 'sku',
      }),
    ).toBe('insumo_base');
  });

  it('por medida SIN ingrediente base no inventa uno: sigue como estaba', () => {
    expect(
      estrategiaDeConsumo({
        tipo_venta: 'variable_medida',
        insumo_base_id: null,
        estrategia_consumo: 'sku',
      }),
    ).toBe('sku');
  });

  it('la receta se respeta: la barbacoa por kilo baja sus ingredientes', () => {
    expect(
      estrategiaDeConsumo({
        tipo_venta: 'variable_medida',
        insumo_base_id: BASE,
        estrategia_consumo: 'receta',
      }),
    ).toBe('receta');
  });

  it('un servicio (ninguno) no se toca', () => {
    expect(
      estrategiaDeConsumo({
        tipo_venta: 'servicio',
        insumo_base_id: null,
        estrategia_consumo: 'ninguno',
      }),
    ).toBe('ninguno');
  });

  it('insumo_base en un producto de precio fijo vuelve a sku (la base no lo admite sin insumo)', () => {
    expect(
      estrategiaDeConsumo({
        tipo_venta: 'precio_fijo',
        insumo_base_id: null,
        estrategia_consumo: 'insumo_base',
      }),
    ).toBe('sku');
  });
});

describe('A2 · lo imposible se rechaza con su mensaje; lo derivable se deriva', () => {
  it('por porción sin ml_por_porcion lo deriva de capacidad ÷ porciones y fija la estrategia', () => {
    const salida = cuadrarProducto(PRODUCTO_NUEVO, { ...porPorcion });
    expect(salida['ml_por_porcion']).toBe('30');
    expect(salida['estrategia_consumo']).toBe('insumo_base');
  });

  it('la medida explícita manda sobre la derivada', () => {
    const salida = cuadrarProducto(PRODUCTO_NUEVO, { ...porPorcion, ml_por_porcion: '45' });
    expect(salida['ml_por_porcion']).toBe('45');
  });

  it("unidad_variable '' en un producto por porción se guarda como nula, no se manda a la base", () => {
    const salida = cuadrarProducto(PRODUCTO_NUEVO, { ...porPorcion, unidad_variable: '' });
    expect(salida['unidad_variable']).toBeNull();
  });

  it("unidad_variable '' en un producto por medida se rechaza", () => {
    expect(() =>
      cuadrarProducto(PRODUCTO_NUEVO, {
        tipo_venta: 'variable_medida',
        unidad_variable: '',
        precio_por_unidad_variable_centavos: 20_000n,
      }),
    ).toThrow(/necesita su unidad/);
  });

  it('una unidad que no existe se rechaza', () => {
    expect(() =>
      cuadrarProducto(PRODUCTO_NUEVO, {
        tipo_venta: 'variable_medida',
        unidad_variable: 'libras',
        precio_por_unidad_variable_centavos: 20_000n,
      }),
    ).toThrow(/no es válida/);
  });

  it('por medida sin precio se rechaza', () => {
    expect(() =>
      cuadrarProducto(PRODUCTO_NUEVO, { tipo_venta: 'variable_medida', unidad_variable: 'kg' }),
    ).toThrow(/precio por unidad/);
  });

  it('por porción sin capacidad se rechaza', () => {
    expect(() =>
      cuadrarProducto(PRODUCTO_NUEVO, { ...porPorcion, capacidad_contenedor_ml: undefined }),
    ).toThrow(/capacidad/);
  });

  it('por porción sin ml ni porciones se rechaza', () => {
    expect(() =>
      cuadrarProducto(PRODUCTO_NUEVO, { ...porPorcion, porciones_por_contenedor: undefined }),
    ).toThrow(/ml por porción/);
  });

  it('por porción sin precio se rechaza', () => {
    expect(() =>
      cuadrarProducto(PRODUCTO_NUEVO, { ...porPorcion, precio_por_porcion_centavos: null }),
    ).toThrow(/precio/);
  });

  it('una porción más grande que el contenedor se rechaza', () => {
    expect(() => cuadrarProducto(PRODUCTO_NUEVO, { ...porPorcion, ml_por_porcion: '900' })).toThrow(
      /caber en el contenedor/,
    );
  });

  it('una edición parcial se cuadra contra lo que ya hay', () => {
    const existente = { ...porPorcion, ml_por_porcion: '30', estrategia_consumo: 'sku' };
    const salida = cuadrarProducto(existente, { insumo_base_id: BASE });
    expect(salida['estrategia_consumo']).toBe('insumo_base');
  });
});
