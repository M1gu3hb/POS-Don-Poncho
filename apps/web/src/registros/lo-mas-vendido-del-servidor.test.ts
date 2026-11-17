import { describe, expect, it } from 'vitest';

import {
  PLATILLOS_VISIBLES,
  cantidadConUnidad,
  cuentasDichas,
  hayDevoluciones,
  losVisibles,
  pesosDe,
  type LoMasVendidoDelServidor,
} from './lo-mas-vendido-del-servidor.ts';

describe('lo más vendido, dicho en palabras', () => {
  it('los centavos se dicen en pesos con dos decimales', () => {
    expect(pesosDe('99375')).toBe('$993.75');
    expect(pesosDe('0')).toBe('$0.00');
    expect(pesosDe('-5500')).toBe('-$55.00');
    expect(pesosDe('12345678')).toBe('$123,456.78');
  });

  it('las piezas van en singular o plural y el peso, en kilos', () => {
    expect(cantidadConUnidad('1', 'pza')).toBe('1 pza');
    expect(cantidadConUnidad('16', 'pza')).toBe('16 pzas');
    expect(cantidadConUnidad('1.25', 'kg')).toBe('1.25 kg');
  });

  it('las cuentas, en singular o plural', () => {
    expect(cuentasDichas(1)).toBe('1 cuenta');
    expect(cuentasDichas(5)).toBe('5 cuentas');
  });

  it('enseña los primeros y, si se pide, todos', () => {
    const filas = Array.from({ length: 25 }, (_, i) => i);
    expect(losVisibles(filas, false)).toHaveLength(PLATILLOS_VISIBLES);
    expect(losVisibles(filas, true)).toHaveLength(25);
  });

  it('sabe si hubo devoluciones', () => {
    const base = { platillos: [{ devueltoCentavos: '0' }] } as unknown as LoMasVendidoDelServidor;
    const con = { platillos: [{ devueltoCentavos: '700' }] } as unknown as LoMasVendidoDelServidor;
    expect(hayDevoluciones(base)).toBe(false);
    expect(hayDevoluciones(con)).toBe(true);
  });
});
