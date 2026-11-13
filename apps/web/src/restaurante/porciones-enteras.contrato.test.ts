import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  porcionesEnteras,
  porcionesQueNoSeVenden,
  renglonParaElComando,
} from './toma-de-pedido/renglon-para-el-comando.ts';

/**
 * DP-18 · A8 · EL CARRITO DEL MESERO NO ACEPTA 1.5 PORCIONES.
 *
 * El servidor rechaza una porción partida («Captura un número entero de porciones») y la ronda
 * entera quedaba atorada. Por porción sólo valen enteros ≥ 1; por PESO siguen valiendo decimales.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (...ruta: string[]) =>
  readFileSync(join(RAIZ_WEB, 'heredado', ...ruta), 'utf8')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');

describe('A8 · porciones enteras', () => {
  it('sólo enteros de 1 a 999 son porciones válidas', () => {
    expect(porcionesEnteras(1)).toBe(true);
    expect(porcionesEnteras('3')).toBe(true);
    expect(porcionesEnteras(1.5)).toBe(false);
    expect(porcionesEnteras(0)).toBe(false);
    expect(porcionesEnteras(1000)).toBe(false);
    expect(porcionesEnteras('')).toBe(false);
  });

  it('un renglón de 1.5 porciones no sale al servidor y se reconoce como malo', () => {
    const item = {
      id: 'consome',
      cantidad: 1,
      _variable: { tipo_venta: 'porcion_contenedor', cantidad_porciones: 1.5 },
    };
    expect(porcionesQueNoSeVenden(item)).toBe(true);
    expect(renglonParaElComando(item)).toBeNull();
  });

  it('por peso los decimales siguen valiendo', () => {
    const item = {
      id: 'barbacoa',
      cantidad: 1,
      _variable: { tipo_venta: 'variable_medida', cantidad_variable: 1.5, unidad_variable: 'kg' },
    };
    expect(porcionesQueNoSeVenden(item)).toBe(false);
    expect(renglonParaElComando(item)?.cantidad).toBe('1.5');
  });
});

describe('A8 · las pantallas', () => {
  it('el diálogo de cantidad exige enteros por porción', () => {
    const codigo = leer('components', 'mesero', 'CantidadVariableDialog.jsx');
    expect(codigo).toContain(
      "if (esPorcion) { return cantidad.trim() === '' || porcionesEnteras(cantNum) ? { ok: porcionesEnteras(cantNum), msg: '' }",
    );
  });

  it('el mesero y el pedido para llevar frenan el renglón malo con su aviso', () => {
    expect(leer('pages', 'Mesero.jsx')).toContain('if (porcionesQueNoSeVenden(item))');
    expect(leer('components', 'caja', 'ParaLlevarDialog.jsx')).toContain(
      'if (porcionesQueNoSeVenden(item))',
    );
  });
});
