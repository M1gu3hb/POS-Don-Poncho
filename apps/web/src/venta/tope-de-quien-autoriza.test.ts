import { describe, expect, it } from 'vitest';

import { ErrorApi } from '~/cliente/api';

import {
  autorizacionInservible,
  elTopeCubre,
  hastaCuantoAutoriza,
  descuentoQueSeReemplaza,
  porcentajeEnTexto,
} from './tope-de-quien-autoriza.ts';

/**
 * DP-14 ronda 2 (medio 5) · lo que la pantalla del descuento sabe del PIN que acaba de autorizar.
 * La regla es la del servidor (`puedeAutorizar`): el tope en pesos Y el tope en porcentaje, en cruz,
 * sin dividir (dividir trunca y tolerar en silencio es lo que un tope no puede hacer).
 */

const GERENTE = { topeCentavos: '200000', topeBp: 3_000 }; // $2,000 o 30 %
const CAJERO = { topeCentavos: '5000', topeBp: 1_000 }; // $50 o 10 %

describe('el tope cubre el descuento', () => {
  it('cabe en el porcentaje y en los pesos', () => {
    expect(elTopeCubre(15_000, 50_000, GERENTE)).toBe(true); // $150 de $500 = 30 %
  });
  it('un centavo más del porcentaje ya no cabe (sin truncar)', () => {
    expect(elTopeCubre(15_001, 50_000, GERENTE)).toBe(false);
  });
  it('pasa del tope en pesos aunque el porcentaje quepa', () => {
    // 30 % de $10,000 son $3,000, pero el tope es $2,000
    expect(elTopeCubre(200_000, 1_000_000, GERENTE)).toBe(true);
    expect(elTopeCubre(200_001, 1_000_000, GERENTE)).toBe(false);
  });
  it('un puesto sin tope no cubre nada', () => {
    expect(elTopeCubre(1, 50_000, { topeCentavos: '0', topeBp: 0 })).toBe(false);
  });
  it('sin base no hay nada que cubrir', () => {
    expect(elTopeCubre(100, 0, GERENTE)).toBe(false);
  });
});

describe('hasta cuánto autoriza ese PIN', () => {
  it('manda el porcentaje cuando es lo que limita', () => {
    expect(hastaCuantoAutoriza(50_000, GERENTE)).toEqual({ tipo: 'porcentaje', bp: 3_000 });
  });
  it('manda el monto cuando el tope en pesos es lo que limita', () => {
    expect(hastaCuantoAutoriza(1_000_000, GERENTE)).toEqual({ tipo: 'pesos', centavos: 200_000 });
  });
  it('si los dos topes dan lo mismo, manda el porcentaje', () => {
    // 30 % de $5,000.00 son $1,500.00: justo el tope en pesos.
    expect(hastaCuantoAutoriza(500_000, { topeCentavos: '150000', topeBp: 3_000 })).toEqual({
      tipo: 'porcentaje',
      bp: 3_000,
    });
    expect(hastaCuantoAutoriza(500_100, { topeCentavos: '150000', topeBp: 3_000 })).toEqual({
      tipo: 'pesos',
      centavos: 150_000,
    });
  });
  it('el cajero con su $50 en una cuenta grande', () => {
    expect(hastaCuantoAutoriza(100_000, CAJERO)).toEqual({ tipo: 'pesos', centavos: 5_000 });
  });
  it('sin tope lo dice', () => {
    expect(hastaCuantoAutoriza(50_000, { topeCentavos: '0', topeBp: 0 })).toEqual({
      tipo: 'ninguno',
    });
  });
  it('el porcentaje se escribe como se dice', () => {
    expect(porcentajeEnTexto(3_000)).toBe('30');
    expect(porcentajeEnTexto(1_250)).toBe('12.5');
  });
});

const rechazo = (regla: string) =>
  new ErrorApi({ codigo: 'REGLA_DE_NEGOCIO', mensaje: 'x', datos: { regla } }, 422, null);

describe('cuándo la autorización ya no sirve', () => {
  it('el servidor la rechaza por tope, vencida o de otra cuenta, o ya usada', () => {
    expect(autorizacionInservible(rechazo('PUESTO_NO_OTORGABLE'))).toBe(true);
    expect(autorizacionInservible(rechazo('AUTORIZACION_USADA'))).toBe(true);
  });
  it('otros rechazos o fallos de red no la tiran', () => {
    expect(autorizacionInservible(rechazo('DESCUENTOS_APAGADOS'))).toBe(false);
    expect(autorizacionInservible(rechazo('ORDEN_NO_EDITABLE'))).toBe(false);
    expect(autorizacionInservible(new Error('red'))).toBe(false);
  });
});

describe('el descuento que se reemplaza', () => {
  it('sin descuento previo no hay nada que decir', () => {
    expect(descuentoQueSeReemplaza(0)).toBeNull();
    expect(descuentoQueSeReemplaza(null)).toBeNull();
  });
  it('con descuento previo, cuánto era', () => {
    expect(descuentoQueSeReemplaza(5_000)).toBe(5_000);
  });
});
