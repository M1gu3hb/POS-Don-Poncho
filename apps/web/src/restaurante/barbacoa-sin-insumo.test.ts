import { describe, expect, it } from 'vitest';

import { validarProductoVariable } from '../../heredado/utils/tipoVentaUtils.js';

/**
 * DP-16 (QA-J, H1) · LA BARBACOA SE GUARDA SIN INSUMO.
 *
 * Don Poncho vende la barbacoa por kilo y no lleva inventario de insumos: el servidor no pide el
 * ingrediente base, pero el formulario sí, así que nada de un producto por peso se podía guardar
 * desde Recetas (tampoco «Vender sólo en estas presentaciones»). Sin ingrediente base se vende por
 * peso sin descontar inventario; el de porción (contenedor) sí lo necesita para medir el contenedor.
 */

const BARBACOA = {
  tipo_venta: 'variable_medida',
  unidad_variable: 'kg',
  precio_por_unidad_variable: 795,
  cantidad_minima_variable: 0.25,
  cantidad_maxima_variable: 0,
} as const;

describe('validarProductoVariable', () => {
  it('por peso SIN ingrediente base: se puede guardar', () => {
    expect(validarProductoVariable({ ...BARBACOA })).toEqual({ ok: true, errores: [] });
  });

  it('por peso con ingrediente base: también', () => {
    expect(validarProductoVariable({ ...BARBACOA, ingrediente_base_id: 'ing-1' }).ok).toBe(true);
  });

  it('por peso sigue exigiendo unidad y precio', () => {
    const { errores } = validarProductoVariable({
      ...BARBACOA,
      unidad_variable: 'costal',
      precio_por_unidad_variable: 0,
    });
    expect(errores).toEqual(['Unidad de venta inválida.', 'Precio por unidad debe ser > 0.']);
  });

  it('por porción (contenedor) SÍ exige el ingrediente base', () => {
    const { errores } = validarProductoVariable({
      tipo_venta: 'porcion_contenedor',
      capacidad_contenedor_ml: 1000,
      porciones_por_contenedor: 4,
      precio_por_porcion: 60,
    });
    expect(errores).toContain('Falta ingrediente base.');
  });
});
