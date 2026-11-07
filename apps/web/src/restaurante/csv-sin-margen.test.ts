import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-14.6 · El CSV de Registros, a quien no ve márgenes, deja Costo, Utilidad y Margen EN BLANCO
 * (no en 0, que se lee como «costó cero»), y una venta cancelada tampoco lleva margen. La pantalla
 * heredada no se importa en la prueba de unidad: se lee su texto y se valida mutando el código.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const columnas = readFileSync(join(RAIZ, 'heredado/lib/exportColumns.js'), 'utf8');

describe('el CSV de ventas y el margen', () => {
  const formato = columnas.slice(
    columnas.indexOf('const fmtDeLaVenta'),
    columnas.indexOf('// QA1-8'),
  );

  it('sin el costo (quien no ve márgenes) sale en blanco, no en 0', () => {
    expect(formato).toMatch(/economia\.estado === 'oculto'\) return ''/);
  });

  it('una venta cancelada va en blanco', () => {
    expect(formato).toMatch(/if \(!sePintaElMargen\(venta \?\? \{\}\)\) return ''/);
  });

  it('sin receta o con receta incompleta lo dice', () => {
    expect(formato).toMatch(/return 'sin receta'/);
    expect(formato).toMatch(/return 'receta incompleta'/);
  });

  it('Costo, Utilidad y Margen usan ese formato', () => {
    for (const clave of ['costo_total_snapshot', 'utilidad_bruta_snapshot', 'margen_snapshot']) {
      expect(columnas).toMatch(new RegExp(`key: '${clave}', label: '[^']+', format: fmtDeLaVenta`));
    }
  });
});
