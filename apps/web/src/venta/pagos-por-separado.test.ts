import { describe, expect, it } from 'vitest';

import { pagosPorVenta, renglonesDePagos, type PagoLeido } from './pagos-por-separado';

const pago = (cambios: Partial<PagoLeido>): PagoLeido => ({
  id: 'p',
  venta_id: 'v1',
  metodo: 'tarjeta',
  monto: 0,
  propina: 0,
  recibido: null,
  cambio: 0,
  estado: 'confirmado',
  created_date: '2026-11-21T20:00:00.000Z',
  ...cambios,
});

describe('cada pago por separado', () => {
  it('tres tarjetas y el efectivo: «Tarjeta 1, 2 y 3» en el orden en que se cobraron, y el efectivo con lo recibido y el cambio', () => {
    const renglones = renglonesDePagos([
      pago({
        id: 'e',
        metodo: 'efectivo',
        monto: 164,
        propina: 56.4,
        recibido: 500,
        cambio: 279.6,
        created_date: '2026-11-21T20:00:04.000Z',
      }),
      pago({ id: 't2', monto: 100, created_date: '2026-11-21T20:00:02.000Z' }),
      pago({ id: 't1', monto: 200, created_date: '2026-11-21T20:00:01.000Z' }),
      pago({ id: 't3', monto: 100, created_date: '2026-11-21T20:00:03.000Z' }),
    ]);
    expect(renglones.map((r) => r.rotulo)).toEqual([
      'Tarjeta 1',
      'Tarjeta 2',
      'Tarjeta 3',
      'Efectivo',
    ]);
    expect(renglones.map((r) => r.monto)).toEqual([200, 100, 100, 164]);
    expect(renglones[3]).toMatchObject({ propina: 56.4, recibido: 500, cambio: 279.6 });
    // Lo recibido y el cambio son del efectivo: una tarjeta no los lleva.
    expect(renglones[0]).toMatchObject({ recibido: null, cambio: 0 });
  });

  it('a la misma milésima se respeta el orden en que llegan: el servidor ya los trae por su hora exacta', () => {
    const misma = '2026-11-21T20:00:01.000Z';
    const renglones = renglonesDePagos([
      pago({ id: 'z', monto: 200, created_date: misma }),
      pago({ id: 'a', monto: 150, created_date: misma }),
      pago({ id: 'm', metodo: 'efectivo', monto: 100, recibido: 100, created_date: misma }),
    ]);
    expect(renglones.map((r) => `${r.rotulo} ${String(r.monto)}`)).toEqual([
      'Tarjeta 1 200',
      'Tarjeta 2 150',
      'Efectivo 100',
    ]);
  });

  it('lo recibido y el cambio no salen en una tarjeta aunque la fila los traiga', () => {
    const [tarjeta] = renglonesDePagos([pago({ monto: 620.4, recibido: 700, cambio: 79.6 })]);
    expect(tarjeta).toMatchObject({ recibido: null, cambio: 0 });
  });

  it('una sola tarjeta se llama «Tarjeta», sin número', () => {
    expect(renglonesDePagos([pago({ monto: 620.4, propina: 56.4 })]).map((r) => r.rotulo)).toEqual([
      'Tarjeta',
    ]);
  });

  it('la transferencia y un método que no se conoce se leen con su nombre', () => {
    const renglones = renglonesDePagos([
      pago({ id: 'a', metodo: 'transferencia', created_date: '2026-11-21T20:00:01.000Z' }),
      pago({ id: 'b', metodo: 'vales', created_date: '2026-11-21T20:00:02.000Z' }),
    ]);
    expect(renglones.map((r) => r.rotulo)).toEqual(['Transferencia', 'Vales']);
  });

  it('la propina de cada pago se queda en su renglón y la suma no cambia', () => {
    const renglones = renglonesDePagos([
      pago({ id: 'a', monto: 300, propina: 30, created_date: '2026-11-21T20:00:01.000Z' }),
      pago({
        id: 'b',
        metodo: 'efectivo',
        monto: 264,
        propina: 26.4,
        recibido: 300,
        cambio: 9.6,
        created_date: '2026-11-21T20:00:02.000Z',
      }),
    ]);
    expect(renglones.map((r) => r.propina)).toEqual([30, 26.4]);
    expect(renglones.reduce((s, r) => s + r.monto + r.propina, 0)).toBeCloseTo(620.4, 2);
  });

  it('un pago devuelto se dice', () => {
    expect(renglonesDePagos([pago({ estado: 'reembolsado' })])[0]?.devuelto).toBe(true);
    expect(renglonesDePagos([pago({})])[0]?.devuelto).toBe(false);
  });

  it('los pagos del turno se agrupan por venta, cada venta con su numeración', () => {
    const porVenta = pagosPorVenta([
      pago({ id: 'a', venta_id: 'v1', created_date: '2026-11-21T20:00:01.000Z' }),
      pago({ id: 'b', venta_id: 'v2', created_date: '2026-11-21T20:00:02.000Z' }),
      pago({ id: 'c', venta_id: 'v1', created_date: '2026-11-21T20:00:03.000Z' }),
    ]);
    expect([...porVenta.keys()]).toEqual(['v1', 'v2']);
    expect(porVenta.get('v1')?.map((r) => r.rotulo)).toEqual(['Tarjeta 1', 'Tarjeta 2']);
    expect(porVenta.get('v2')?.map((r) => r.rotulo)).toEqual(['Tarjeta']);
  });
});
