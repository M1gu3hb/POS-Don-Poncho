import { describe, expect, it } from 'vitest';

import { COPIAS_POR_OMISION } from '../copias.ts';
import {
  copiasConCambio,
  copiasIguales,
  DOCUMENTOS_CON_COPIAS,
  OPCIONES_DE_COPIAS,
} from './copias-formulario.ts';

describe('DP-20 · «copias de impresión» en Operación', () => {
  it('se ofrecen 1, 2 y 3 copias para el ticket, la precuenta y el corte', () => {
    expect(OPCIONES_DE_COPIAS).toEqual([1, 2, 3]);
    expect(DOCUMENTOS_CON_COPIAS.map((d) => d.nombre)).toEqual([
      'Copias del ticket de venta',
      'Copias de la precuenta',
      'Copias del corte',
    ]);
  });

  it('cambia sólo el documento elegido y no toca el original', () => {
    const nuevas = copiasConCambio(COPIAS_POR_OMISION, 'ticket', '2');
    expect(nuevas).toEqual({ ticket: 2, precuenta: 1, corte: 1 });
    expect(COPIAS_POR_OMISION.ticket).toBe(1);
  });

  it.each(['0', '4', '-1', '1.5', 'dos', '', ' '])(
    'rechaza «%s» y deja las mismas copias',
    (texto) => {
      expect(copiasConCambio(COPIAS_POR_OMISION, 'corte', texto)).toBe(COPIAS_POR_OMISION);
    },
  );

  it('compara las tres', () => {
    expect(copiasIguales(COPIAS_POR_OMISION, { ticket: 1, precuenta: 1, corte: 1 })).toBe(true);
    expect(copiasIguales(COPIAS_POR_OMISION, { ticket: 1, precuenta: 2, corte: 1 })).toBe(false);
  });
});
