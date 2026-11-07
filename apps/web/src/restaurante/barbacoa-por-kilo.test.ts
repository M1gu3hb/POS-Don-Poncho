import { describe, expect, it } from 'vitest';

import { COLUMNS_DETALLES_VENTA } from '../../heredado/lib/exportColumns.js';
import { formatearCantidadVariable } from '../../heredado/utils/tipoVentaUtils.js';
import { paraDividir, piezasDe } from './peso.ts';

/**
 * DP-14.3-5 · LA BARBACOA POR KILO EN LO QUE SE LEE: el CSV de Registros, el ticket y el diálogo
 * de dividir. El importe de cada línea, en pesos, es el de $795/kg exacto; el peso se dice como en
 * la cocina.
 */

interface Columna {
  readonly key: string;
  readonly format?: (valor: unknown, fila: Record<string, unknown>) => unknown;
}

const PESOS: readonly (readonly [number, number, string])[] = [
  [0.25, 198.75, '¼ kg'],
  [0.5, 397.5, '½ kg'],
  [0.75, 596.25, '¾ kg'],
  [1, 795, '1 kg'],
  [1.5, 1192.5, '1.5 kg'],
];

function linea(kilos: number, total: number): Record<string, unknown> {
  return {
    producto_nombre: 'Barbacoa de horno',
    tipo_venta_snapshot: 'variable_medida',
    cantidad: kilos,
    cantidad_variable_snapshot: kilos,
    unidad_variable_snapshot: 'kg',
    precio_unitario_snapshot: 795,
    subtotal: total,
  };
}

const celda = (fila: Record<string, unknown>, clave: string): unknown => {
  const columna = (COLUMNS_DETALLES_VENTA as readonly Columna[]).find((c) => c.key === clave);
  const valor = fila[clave];
  return columna?.format === undefined ? valor : columna.format(valor, fila);
};

describe.each(PESOS)('DP-14 · %s kg a $795 el kilo', (kilos, total, dicho) => {
  it('el CSV de Registros lleva el peso real y el importe exacto, sin redondeos', () => {
    const fila = linea(kilos, total);
    expect(celda(fila, 'cantidad_variable_snapshot')).toBe(kilos);
    expect(celda(fila, 'unidad_variable_snapshot')).toBe('kg');
    expect(celda(fila, 'subtotal')).toBe(total);
    expect(celda(fila, 'precio_unitario_snapshot')).toBe(795);
    expect(kilos * 795).toBe(total);
  });

  it(`el ticket y la comanda dicen «${dicho}», no «${String(kilos)}» ni «1 ×»`, () => {
    expect(formatearCantidadVariable(linea(kilos, total))).toBe(dicho);
  });

  it('el diálogo de dividir lo trata como UNA pieza, con su peso a la vista', () => {
    const repartible = paraDividir({
      ...linea(kilos, total),
      id: 'l1',
      nombre: 'Barbacoa de horno',
    });
    expect(repartible).toMatchObject({ porPeso: true, cantidad: kilos, unidad: 'kg' });
    expect(piezasDe(repartible)).toBe(1);
  });
});

describe('DP-14.5 · las piezas de una línea en el diálogo de dividir', () => {
  it('una por pieza reparte sus unidades; una cantidad no entera, UNA', () => {
    expect(piezasDe({ cantidad: 3 })).toBe(3);
    expect(piezasDe({ cantidad: 0.5 })).toBe(1);
    expect(piezasDe({ cantidad: 2, porPeso: true })).toBe(1);
  });
});
