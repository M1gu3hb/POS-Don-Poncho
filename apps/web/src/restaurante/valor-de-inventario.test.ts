import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { valuarInventario } from '@morphiqpos/domain/inventario';
import { describe, expect, it } from 'vitest';

import {
  avisoDeNegativosEnElValor,
  cuantosEnNegativo,
  valorDeLaExistencia,
} from './valor-de-inventario.ts';

/**
 * A24 · LA TARJETA «VALOR DE INVENTARIO» Y LA VALUACIÓN CUENTAN IGUAL UN INSUMO EN NEGATIVO.
 *
 * La valuación guardada (`valuarInventario`, dominio) cuenta una existencia en negativo como cero;
 * la tarjeta de la pantalla multiplicaba el negativo por el costo y lo RESTABA del total. Con una
 * carne en −500 g (D116 lo permite al cobrar lo que pasó por cocina) la tarjeta decía menos que la
 * valuación del mismo almacén. La regla es una: lo que el sistema dice que falta por contar no es
 * una deuda ni un valor negativo; vale cero hasta que el conteo lo corrija.
 */

const heredado = (ruta: string) =>
  readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8');

interface Insumo {
  readonly id: string;
  readonly stock: number;
  /** En pesos por unidad base, como lo sirve el puente a la pantalla. */
  readonly costo: number;
  /** En centavos por unidad base, como lo guarda la base. */
  readonly costoCentavos: bigint;
}

const INSUMOS: readonly Insumo[] = [
  { id: 'queso', stock: 100, costo: 0.1, costoCentavos: 10n },
  { id: 'carne', stock: -500, costo: 0.1, costoCentavos: 10n },
  { id: 'crema', stock: 0, costo: 0.25, costoCentavos: 25n },
  { id: 'tortilla', stock: 40, costo: 0.5, costoCentavos: 50n },
];

describe('valorDeLaExistencia (la tarjeta)', () => {
  it('una existencia en negativo vale cero: no resta del valor', () => {
    expect(valorDeLaExistencia(-500, 0.1)).toBe(0);
  });

  it('con existencia es existencia por costo; sin costo o sin dato vale cero', () => {
    expect(valorDeLaExistencia(40, 0.5)).toBe(20);
    expect(valorDeLaExistencia(40, 0)).toBe(0);
    expect(valorDeLaExistencia(undefined, undefined)).toBe(0);
    expect(valorDeLaExistencia(null, 3)).toBe(0);
  });

  it('el total de la tarjeta es EXACTAMENTE el de la valuación del mismo almacén', () => {
    const tarjetaCentavos = INSUMOS.reduce(
      (suma, i) => suma + Math.round(valorDeLaExistencia(i.stock, i.costo) * 100),
      0,
    );
    const valuacion = valuarInventario(
      INSUMOS.map((i) => ({
        insumoId: i.id,
        existencia: i.stock.toFixed(4),
        costoPromedioCentavos: i.costoCentavos,
        ultimoMovimiento: null,
      })),
      { metodo: 'promedio', ahora: new Date('2026-11-16T12:00:00Z') },
    );
    expect(valuacion.valorCentavos).toBe(BigInt(tarjetaCentavos));
    expect(tarjetaCentavos).toBe(3_000);
  });
});

describe('el aviso de la tarjeta', () => {
  it('cuenta los ingredientes en negativo y sólo ésos', () => {
    expect(cuantosEnNegativo(INSUMOS.map((i) => ({ stock_actual: i.stock })))).toBe(1);
    expect(cuantosEnNegativo([{ stock_actual: 0 }, {}, { stock_actual: null }])).toBe(0);
  });

  it('dice cuántos son, que no restan y qué hacer; sin negativos no dice nada', () => {
    expect(avisoDeNegativosEnElValor(0)).toBeNull();
    const uno = avisoDeNegativosEnElValor(1);
    expect(uno).toContain('1 ingrediente en negativo');
    expect(uno).toMatch(/no resta/);
    expect(uno).toMatch(/conteo/);
    expect(avisoDeNegativosEnElValor(3)).toContain('3 ingredientes en negativo');
  });
});

describe('la pantalla usa esa única regla', () => {
  it('«calculateInventoryValue» delega en valorDeLaExistencia, sin su propia multiplicación', () => {
    const utilidades = heredado('../../heredado/utils/inventoryUtils.js');
    expect(utilidades).toContain("from '~/restaurante/valor-de-inventario'");
    expect(utilidades).toContain('valorDeLaExistencia(');
    expect(utilidades).not.toContain(
      '(ingredient.stock_actual || 0) * (ingredient.costo_por_unidad_base || 0)',
    );
  });

  it('el panel de ajuste explica por qué la merma deja la existencia más negativa', () => {
    const panel = heredado('./Inventario.tsx');
    expect(panel).toContain('avisoDeExistenciaEnNegativo(fila.stock_actual, fila.unidad_base)');
    expect(panel).toContain('titulo="Existencia en negativo"');
  });

  it('la tarjeta enseña el aviso de los negativos', () => {
    const pantalla = heredado('../../heredado/pages/Inventario.jsx');
    expect(pantalla).toContain('avisoDeNegativosEnElValor(');
    expect(pantalla).toContain('cuantosEnNegativo(');
  });
});
