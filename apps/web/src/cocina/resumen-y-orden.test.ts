import { describe, expect, it } from 'vitest';

import { agruparPorCuenta, inicioDeLaEspera, ordenarMasViejasArriba } from './grupos';
import { resumenDeProduccion, textoDelResumen } from './resumen-de-produccion';
import type { ComandaDeCocina } from './tipos';

/**
 * DP-16 · 2.2 · EL RESUMEN DE PRODUCCIÓN Y EL ORDEN: lo pendiente por platillo, y lo más viejo arriba.
 */

function comanda(id: string, parche: Partial<ComandaDeCocina> = {}): ComandaDeCocina {
  return { id, estado: 'nuevo', items: [], ...parche };
}

describe('resumenDeProduccion', () => {
  it('suma por platillo lo pendiente (nuevo y en preparación), de todas las mesas', () => {
    const resumen = resumenDeProduccion([
      comanda('a', { items: [{ producto_id: 'p1', producto_nombre: 'Consomé', cantidad: 2 }] }),
      comanda('b', {
        estado: 'en_preparacion',
        items: [
          { producto_id: 'p1', producto_nombre: 'Consomé', cantidad: 7 },
          { producto_id: 'p2', producto_nombre: 'Tacos dorados', cantidad: 3 },
        ],
      }),
    ]);
    expect(resumen.map(textoDelResumen)).toEqual(['Consomé ×9', 'Tacos dorados ×3']);
  });

  it('lo listo y lo entregado ya no es producción pendiente', () => {
    const resumen = resumenDeProduccion([
      comanda('a', {
        estado: 'listo',
        items: [{ producto_id: 'p1', producto_nombre: 'Consomé', cantidad: 4 }],
      }),
      comanda('b', {
        estado: 'entregado',
        items: [{ producto_id: 'p1', producto_nombre: 'Consomé', cantidad: 4 }],
      }),
    ]);
    expect(resumen).toEqual([]);
  });

  it('el platillo quitado por el mesero no se cuenta', () => {
    const resumen = resumenDeProduccion([
      comanda('a', {
        items: [
          { producto_id: 'p1', producto_nombre: 'Consomé', cantidad: 2, estado: 'cancelado' },
          { producto_id: 'p2', producto_nombre: 'Flan', cantidad: 1, estado: 'pendiente' },
        ],
      }),
    ]);
    expect(resumen.map(textoDelResumen)).toEqual(['Flan ×1']);
  });

  it('lo que va por peso se suma por presentación', () => {
    const peso = (_n: number, kg: number) => ({
      producto_id: 'barb',
      producto_nombre: 'Barbacoa de horno',
      cantidad: kg,
      tipo_venta: 'variable_medida',
      cantidad_variable: kg,
      unidad_variable: 'kg',
    });
    const resumen = resumenDeProduccion([
      comanda('a', { items: [peso(1, 0.5), peso(2, 0.5), peso(3, 1)] }),
      comanda('b', { estado: 'en_preparacion', items: [peso(4, 0.5)] }),
    ]);
    expect(resumen.map(textoDelResumen)).toEqual([
      'Barbacoa de horno ½ kg ×3',
      'Barbacoa de horno 1 kg ×1',
    ]);
    expect(resumen[0]?.kilos).toBeCloseTo(1.5);
  });

  it('los más pedidos primero; a igual cantidad, por nombre', () => {
    const resumen = resumenDeProduccion([
      comanda('a', {
        items: [
          { producto_id: 'z', producto_nombre: 'Zarape', cantidad: 2 },
          { producto_id: 'a', producto_nombre: 'Agua', cantidad: 2 },
          { producto_id: 'm', producto_nombre: 'Mole', cantidad: 5 },
        ],
      }),
    ]);
    expect(resumen.map((r) => r.nombre)).toEqual(['Mole', 'Agua', 'Zarape']);
  });

  it('un platillo sin nombre no se pierde', () => {
    const resumen = resumenDeProduccion([
      comanda('a', { items: [{ producto_id: 'x', producto_nombre: null, cantidad: 1 }] }),
    ]);
    expect(resumen.map(textoDelResumen)).toEqual(['Platillo ×1']);
  });
});

describe('inicioDeLaEspera y el orden', () => {
  it('la espera corre desde que se marchó a cocina; si no consta, desde que se creó', () => {
    expect(
      inicioDeLaEspera(
        comanda('a', {
          fecha_creacion: '2026-11-10T18:00:00Z',
          fecha_marchada: '2026-11-10T18:05:00Z',
        }),
      ),
    ).toBe('2026-11-10T18:05:00Z');
    expect(inicioDeLaEspera(comanda('a', { fecha_creacion: '2026-11-10T18:00:00Z' }))).toBe(
      '2026-11-10T18:00:00Z',
    );
    expect(inicioDeLaEspera(comanda('a'))).toBeNull();
  });

  it('las más viejas arriba; las sin fecha, al final', () => {
    const cuentas = agruparPorCuenta([
      comanda('nueva', { venta_id: 'v3', fecha_creacion: '2026-11-10T18:20:00Z' }),
      comanda('sinfecha', { venta_id: 'v4' }),
      comanda('vieja', { venta_id: 'v1', fecha_creacion: '2026-11-10T18:01:00Z' }),
      comanda('media', { venta_id: 'v2', fecha_creacion: '2026-11-10T18:10:00Z' }),
    ]);
    expect(ordenarMasViejasArriba(cuentas, 'nuevo').map((g) => g.clave)).toEqual([
      'v1',
      'v2',
      'v3',
      'v4',
    ]);
  });

  it('en «Listos» manda cuándo quedó listo, no cuándo se pidió', () => {
    const cuentas = agruparPorCuenta([
      comanda('a', {
        estado: 'listo',
        venta_id: 'v1',
        fecha_creacion: '2026-11-10T17:00:00Z',
        fecha_listo: '2026-11-10T18:30:00Z',
      }),
      comanda('b', {
        estado: 'listo',
        venta_id: 'v2',
        fecha_creacion: '2026-11-10T18:00:00Z',
        fecha_listo: '2026-11-10T18:10:00Z',
      }),
    ]);
    expect(ordenarMasViejasArriba(cuentas, 'listo').map((g) => g.clave)).toEqual(['v2', 'v1']);
  });
});

describe('agruparPorCuenta', () => {
  it('junta las estaciones de una misma cuenta; el para llevar sin mesa no se mezcla con otro', () => {
    const grupos = agruparPorCuenta([
      comanda('c1', { venta_id: 'v1', mesa_id: 'm1', estacion_preparacion_nombre: 'Cocina' }),
      comanda('c2', { venta_id: 'v1', mesa_id: 'm1', estacion_preparacion_nombre: 'Bebidas' }),
      comanda('c3', { venta_id: 'v9', canal: 'llevar' }),
      comanda('c4', { venta_id: 'v8', canal: 'llevar' }),
    ]);
    expect(grupos.map((g) => [g.clave, g.comandas.map((c) => c.id)])).toEqual([
      ['v1', ['c1', 'c2']],
      ['v9', ['c3']],
      ['v8', ['c4']],
    ]);
  });

  it('sin cuenta ni mesa, cada comanda es la suya', () => {
    const grupos = agruparPorCuenta([comanda('x'), comanda('y')]);
    expect(grupos.map((g) => g.clave)).toEqual(['x', 'y']);
  });
});
