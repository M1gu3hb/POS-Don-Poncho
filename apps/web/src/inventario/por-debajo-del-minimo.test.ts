import { alertasDeMinimo } from '@morphiqpos/domain/inventario';
import { describe, expect, it } from 'vitest';

import {
  ESTADO_POR_DEBAJO_DEL_MINIMO,
  estaPorDebajoDelMinimo,
  filtroDeLaUrl,
} from './por-debajo-del-minimo.ts';

/**
 * DP-22 · DP-D159. La lista que abre el aviso del Tablero es la que el servidor contó: la regla del
 * navegador y la del dominio (`alertasDeMinimo`) no se pueden separar.
 */

const EXISTENCIAS = [
  '-50',
  '-0.5',
  '0',
  '0.5',
  '9',
  '10',
  '10.5',
  '49',
  '50',
  '50.5',
  '100',
  '900',
];
const PISOS = ['0', '10', '50'];
const CRITICOS = ['0', '10'];

describe('estaPorDebajoDelMinimo', () => {
  it('coincide con alertasDeMinimo del dominio en toda la cuadrícula', () => {
    let casos = 0;
    for (const existencia of EXISTENCIAS) {
      for (const minimo of PISOS) {
        for (const critico of CRITICOS) {
          const alerta =
            alertasDeMinimo([
              {
                insumoId: 'x',
                existenciaBase: existencia,
                stockMinimo: minimo,
                stockCritico: critico,
              },
            ]).length === 1;
          const aqui = estaPorDebajoDelMinimo({
            stock_actual: Number(existencia),
            stock_minimo: Number(minimo),
            stock_critico: Number(critico),
          });
          expect(aqui, `existencia ${existencia}, piso ${minimo}, crítico ${critico}`).toBe(alerta);
          casos += 1;
        }
      }
    }
    expect(casos).toBe(EXISTENCIAS.length * PISOS.length * CRITICOS.length);
  });

  it('un piso en cero es «no lo vigiles», aunque esté agotado', () => {
    expect(estaPorDebajoDelMinimo({ stock_actual: 0, stock_minimo: 0, stock_critico: 0 })).toBe(
      false,
    );
  });

  it('en el piso cuenta; lo negativo con piso, también', () => {
    expect(estaPorDebajoDelMinimo({ stock_actual: 50, stock_minimo: 50 })).toBe(true);
    expect(estaPorDebajoDelMinimo({ stock_actual: -5, stock_minimo: 50 })).toBe(true);
    expect(estaPorDebajoDelMinimo({ stock_actual: 51, stock_minimo: 50 })).toBe(false);
  });

  it('un dato roto no lanza: cuenta como cero', () => {
    expect(estaPorDebajoDelMinimo({ stock_actual: 'x', stock_minimo: null })).toBe(false);
  });
});

describe('filtroDeLaUrl', () => {
  it('reconoce ?estado=alerta y todo lo demás es «todos»', () => {
    expect(filtroDeLaUrl(ESTADO_POR_DEBAJO_DEL_MINIMO)).toBe('alerta');
    expect(filtroDeLaUrl('agotado')).toBe('all');
    expect(filtroDeLaUrl(null)).toBe('all');
    expect(filtroDeLaUrl(undefined)).toBe('all');
  });
});
