import { describe, expect, it } from 'vitest';

import {
  economiaDelResumen,
  peticionDelResumen,
  totalesDelResumen,
  type ResumenDelServidor,
} from './resumen-del-servidor.ts';

/**
 * H3 · LO QUE LA PANTALLA HACE CON EL RESUMEN DEL SERVIDOR.
 *
 * El servidor suma el periodo entero en centavos enteros (`registros.resumen`). Aquí sólo se pide
 * (con los días del rango) y se lee: ningún importe se suma en el navegador.
 */

const BASE: ResumenDelServidor = {
  desde: '2026-01-01',
  hasta: '2026-11-16',
  ventas: {
    cuentas: 12_345,
    ventasCentavos: '98765432100',
    ventaConCostoCentavos: '98765432100',
    costoCentavos: '29629629630',
    utilidadBrutaCentavos: '69135802470',
    sinReceta: 0,
    recetaIncompleta: 0,
  },
  propinasCentavos: '1234500',
  compras: { cantidad: 1_500, totalCentavos: '20000000' },
  gastos: { cantidad: 1_200, totalCentavos: '5000050' },
  netoCentavos: '98740432050',
};

describe('peticionDelResumen', () => {
  it('pide los DÍAS del rango, en hora local, sin pasar por UTC', () => {
    const rango = { from: new Date(2026, 0, 1, 0, 0, 0), to: new Date(2026, 10, 16, 23, 59, 59) };
    expect(peticionDelResumen(rango)).toEqual({ desde: '2026-01-01', hasta: '2026-11-16' });
  });

  it('el último día del mes y la medianoche no se corren de día', () => {
    const rango = {
      from: new Date(2026, 2, 1, 0, 0, 0),
      to: new Date(2026, 2, 31, 23, 59, 59, 999),
    };
    expect(peticionDelResumen(rango)).toEqual({ desde: '2026-03-01', hasta: '2026-03-31' });
  });
});

describe('totalesDelResumen', () => {
  it('lee los centavos del servidor como pesos exactos, sin sumar nada', () => {
    expect(totalesDelResumen(BASE)).toEqual({
      ingresos: 987_654_321,
      nVentas: 12_345,
      nCompras: 1_500,
      nGastos: 1_200,
      propinas: 12_345,
      compras: 200_000,
      gastos: 50_000.5,
      neto: 987_404_320.5,
      utilidad: 691_358_024.7,
    });
  });

  it('el neto es el que dijo el servidor, no ingresos − compras − gastos hechos aquí', () => {
    const raro = { ...BASE, netoCentavos: '42' };
    expect(totalesDelResumen(raro).neto).toBe(0.42);
  });

  it('un periodo sin ventas da ceros y utilidad cero', () => {
    const vacio: ResumenDelServidor = {
      ...BASE,
      ventas: {
        cuentas: 0,
        ventasCentavos: '0',
        ventaConCostoCentavos: '0',
        costoCentavos: '0',
        utilidadBrutaCentavos: '0',
        sinReceta: 0,
        recetaIncompleta: 0,
      },
      propinasCentavos: '0',
      compras: { cantidad: 0, totalCentavos: '0' },
      gastos: { cantidad: 0, totalCentavos: '0' },
      netoCentavos: '0',
    };
    expect(totalesDelResumen(vacio)).toMatchObject({
      ingresos: 0,
      nVentas: 0,
      neto: 0,
      utilidad: 0,
    });
  });

  it('con todas las cuentas sin costo, la utilidad no existe (no es cero)', () => {
    const sinCosto: ResumenDelServidor = {
      ...BASE,
      ventas: {
        ...BASE.ventas,
        cuentas: 3,
        ventasCentavos: '30000',
        ventaConCostoCentavos: '0',
        costoCentavos: '0',
        utilidadBrutaCentavos: '0',
        sinReceta: 3,
      },
    };
    expect(totalesDelResumen(sinCosto).utilidad).toBeNull();
  });
});

describe('economiaDelResumen', () => {
  it('con costo completo en todas: conocido, con su margen', () => {
    const economia = economiaDelResumen(BASE);
    expect(economia.estado).toBe('conocido');
    expect(economia.utilidad).toBeCloseTo(691_358_024.7, 2);
    expect(economia.margen).toBeCloseTo(70, 5);
    expect(economia.sinReceta).toBe(0);
  });

  it('con algunas cuentas sin receta: parcial, y las que quedaron fuera se cuentan', () => {
    const economia = economiaDelResumen({
      ...BASE,
      ventas: {
        ...BASE.ventas,
        cuentas: 10,
        ventasCentavos: '100000',
        ventaConCostoCentavos: '80000',
        costoCentavos: '20000',
        utilidadBrutaCentavos: '60000',
        sinReceta: 1,
        recetaIncompleta: 1,
      },
    });
    expect(economia).toMatchObject({
      estado: 'parcial',
      sinReceta: 1,
      recetaIncompleta: 1,
      conCosto: 8,
      ingresos: 1000,
      ingresosConCosto: 800,
      costo: 200,
      utilidad: 600,
    });
    expect(economia.margen).toBeCloseTo(75, 5);
  });

  it('con ninguna cuenta con costo: sin receta, sin utilidad ni margen', () => {
    const economia = economiaDelResumen({
      ...BASE,
      ventas: {
        ...BASE.ventas,
        cuentas: 3,
        ventasCentavos: '30000',
        ventaConCostoCentavos: '0',
        costoCentavos: '0',
        utilidadBrutaCentavos: '0',
        sinReceta: 2,
        recetaIncompleta: 1,
      },
    });
    expect(economia).toMatchObject({
      estado: 'sin_receta',
      costo: null,
      utilidad: null,
      margen: null,
    });
  });

  it('sin ventas: conocido, sin margen', () => {
    const economia = economiaDelResumen({
      ...BASE,
      ventas: {
        cuentas: 0,
        ventasCentavos: '0',
        ventaConCostoCentavos: '0',
        costoCentavos: '0',
        utilidadBrutaCentavos: '0',
        sinReceta: 0,
        recetaIncompleta: 0,
      },
    });
    expect(economia).toMatchObject({ estado: 'conocido', utilidad: 0, margen: null });
  });
});
