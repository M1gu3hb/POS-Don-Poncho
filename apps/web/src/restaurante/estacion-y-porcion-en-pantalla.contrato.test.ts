import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-18 · A1 y A2 · LO QUE MANDAN LAS PANTALLAS VIEJAS AL PUENTE.
 *
 *   · A1 · Categorías → Editar mandaba `estacion_preparacion_nombre` y `_color`, que son
 *     DERIVADOS (el puente los calcula al leer) y el servidor rechaza: asignar una estación daba
 *     422. Sólo debe viajar la clave `estacion_preparacion_id` (nula al limpiar, no '').
 *   · A2 · Recetas y Productos mandaban `unidad_variable: ''` al crear un producto por porción.
 *     Sólo el producto por medida lleva unidad, y el «auto» de ml por porción viaja calculado.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (...ruta: string[]) =>
  readFileSync(join(RAIZ_WEB, 'heredado', 'components', ...ruta), 'utf8')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');

describe('A1 · la categoría sólo manda lo que se guarda', () => {
  const codigo = leer('configuracion', 'CategoriasProductoSection.jsx');

  it('no manda el nombre ni el color de la estación (derivados)', () => {
    expect(codigo).not.toContain('payload.estacion_preparacion_nombre');
    expect(codigo).not.toContain('payload.estacion_preparacion_color');
  });

  it('manda la clave de la estación, nula al limpiar', () => {
    expect(codigo).toContain('payload.estacion_preparacion_id = editForm.estacion_id || null;');
  });
});

describe.each([
  ['recetas', 'RecetaFormDialog.jsx'],
  ['productos', 'ProductoSimpleDialog.jsx'],
])('A2 · %s: el producto por porción', (carpeta, archivo) => {
  const codigo = leer(carpeta, archivo);

  it("no manda unidad_variable '' (sólo el producto por medida la lleva)", () => {
    expect(codigo).not.toContain("unidad_variable: tipoVentaState.unidad_variable || ''");
    expect(codigo).toContain('tipoVentaState.tipo_venta === TIPO_VENTA.VARIABLE_MEDIDA');
  });

  it('manda ml_por_porcion ya calculado', () => {
    expect(codigo).toContain('mlPorPorcionEfectivo(tipoVentaState) || undefined');
  });
});
