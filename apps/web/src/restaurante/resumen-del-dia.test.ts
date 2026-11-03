import { describe, expect, it } from 'vitest';

import { esperadoEnCaja, resumirDia, type VentaDelDia } from './resumen-del-dia.ts';

/**
 * El dinero del día del restaurante (auditoría de la 2.4).
 *
 * El puente sirve `Venta` en PESOS. `monto_*` es lo cobrado por método —venta MÁS
 * propina—, y la pantalla lo leía como venta: con una propina de $75 en efectivo el
 * esperado del cajón salía $75 de más y un conteo correcto decía «FALTA».
 */

function venta(cambios: Partial<VentaDelDia>): VentaDelDia {
  return {
    id: 'v1',
    estado: 'pagada',
    total: 500,
    costo_total_snapshot: 200,
    propina_efectivo: 0,
    propina_tarjeta: 0,
    propina_transferencia: 0,
    monto_efectivo: 0,
    monto_tarjeta: 0,
    monto_transferencia: 0,
    usuario_mesero_nombre: 'Ana',
    fecha_apertura: '2026-09-26T18:00:00.000Z',
    ...cambios,
  };
}

describe('el resumen del día del restaurante', () => {
  it('LA PROPINA NO SE CUENTA DOS VECES: fondo $1,000 + venta $500 + propina $75 = $1,575', () => {
    const resumen = resumirDia([venta({ monto_efectivo: 575, propina_efectivo: 75 })], []);

    expect(resumen.porCanal.efectivo).toBe(50_000);
    expect(resumen.propinas.efectivo).toBe(7_500);
    expect(esperadoEnCaja({ fondoInicial: 100_000 }, resumen)).toBe(157_500);
  });

  it('la propina no es venta ni utilidad', () => {
    const resumen = resumirDia([venta({ monto_tarjeta: 580, propina_tarjeta: 80 })], []);

    expect(resumen.ventas).toBe(50_000);
    expect(resumen.utilidad).toBe(30_000);
    expect(resumen.porCanal.tarjeta).toBe(50_000);
    expect(resumen.propinas.tarjeta).toBe(8_000);
  });

  it('mixto: cada método con lo suyo, y la suma de los canales es la venta', () => {
    const resumen = resumirDia(
      [
        venta({
          monto_efectivo: 200,
          propina_efectivo: 0,
          monto_tarjeta: 340,
          propina_tarjeta: 40,
        }),
      ],
      [],
    );

    expect(resumen.porCanal.efectivo + resumen.porCanal.tarjeta).toBe(resumen.ventas);
  });

  it('el gasto en efectivo sale del cajón; el de tarjeta no', () => {
    const resumen = resumirDia(
      [venta({ monto_efectivo: 500 })],
      [
        { id: 'g1', monto: 120, metodo_pago: 'efectivo' },
        { id: 'g2', monto: 300, metodo_pago: 'tarjeta' },
      ],
    );

    expect(esperadoEnCaja({ fondoInicial: 100_000 }, resumen)).toBe(138_000);
    expect(resumen.neta).toBe(30_000 - 42_000);
  });
});

describe('DP-13.2 · el margen del día sale sólo de lo que tiene costo completo', () => {
  it('una venta sin receta y otra de receta incompleta quedan fuera, y se dice', () => {
    const resumen = resumirDia(
      [
        venta({ id: 'a', total: 500, costo_total_snapshot: 200, estado_costo: 'conocido' }),
        venta({ id: 'b', total: 300, costo_total_snapshot: 0, estado_costo: 'sin_receta' }),
        venta({ id: 'c', total: 400, costo_total_snapshot: 50, estado_costo: 'receta_incompleta' }),
      ],
      [],
    );
    expect(resumen.ventas).toBe(120_000);
    expect(resumen.costo).toBe(20_000);
    expect(resumen.utilidad).toBe(30_000);
    // Sobre los $500 con costo completo, no sobre los $1,200: 60 %, no un margen inflado.
    expect(resumen.margen).toBe(6_000);
    expect(resumen.fueraDelMargen).toBe('1 venta sin receta · 1 venta con receta incompleta');
  });

  it('sin ninguna venta de costo completo: ni costo, ni utilidad, ni margen (no «100 %»)', () => {
    const resumen = resumirDia(
      [venta({ total: 300, costo_total_snapshot: 0, estado_costo: 'sin_receta' })],
      [],
    );
    expect(resumen).toMatchObject({ costo: null, utilidad: null, margen: null, neta: null });
    expect(resumen.fueraDelMargen).toBe('1 venta sin receta');
    expect(resumen.margenVisible).toBe(true);
  });

  it('a quien no ve márgenes (el puente no le manda el costo) no se le pinta el margen, ni «sin receta»', () => {
    const resumen = resumirDia([venta({ total: 300, costo_total_snapshot: undefined })], []);
    expect(resumen.margenVisible).toBe(false);
    expect(resumen.fueraDelMargen).toBe('');
    expect(resumirDia([venta({ total: 300 })], []).margenVisible).toBe(true);
  });
});
