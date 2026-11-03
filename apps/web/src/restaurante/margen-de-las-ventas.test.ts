import { describe, expect, it } from 'vitest';

import {
  RECETA_INCOMPLETA,
  SIN_RECETA,
  economiaDeLaVenta,
  economiaDelPeriodo,
  notaDeLasVentasSinReceta,
  resumenDeLasVentas,
  subtituloDelMargen,
  textoDelMargen,
  textoDelResumenDeVentas,
} from './margen-de-las-ventas.ts';

/**
 * DP-12.6 · «100 % MARGEN» EN UNA CUENTA SIN RECETA.
 *
 * El servidor guarda al cobrar `costo_total_snapshot`, `utilidad_bruta_snapshot` y
 * `margen_snapshot`. Un platillo sin receta cuesta CERO en esa foto (`productos.costo_unitario
 * default 0`), así que una cuenta sin receta salía «costo $0.00, utilidad = total, 100 % margen»:
 * la cifra más bonita y la única que seguro es falsa. Costo cero en una venta con importe es
 * costo DESCONOCIDO, igual que en la ficha de Productos.
 */

const venta = (total: number, costo: number | null | undefined) => ({
  total,
  costo_total_snapshot: costo,
  utilidad_bruta_snapshot: costo === null || costo === undefined ? undefined : total - costo,
  margen_snapshot:
    costo === null || costo === undefined || total === 0
      ? undefined
      : ((total - costo) * 100) / total,
});

describe('la economía de UNA venta', () => {
  it('con costo conocido: su costo, su utilidad y su margen', () => {
    expect(economiaDeLaVenta(venta(200, 80))).toEqual({
      estado: 'conocido',
      costo: 80,
      utilidad: 120,
      margen: 60,
    });
  });

  it('SIN RECETA (costo cero y venta con importe): nada de 100 %, todo desconocido', () => {
    expect(economiaDeLaVenta(venta(200, 0))).toEqual({
      estado: 'sin_receta',
      costo: null,
      utilidad: null,
      margen: null,
    });
  });

  it('un costo nulo también es desconocido', () => {
    expect(economiaDeLaVenta(venta(200, null)).estado).toBe('sin_receta');
  });

  it('quien no ve costos (el campo no llega) no ve «sin receta»: no se le inventa nada', () => {
    expect(economiaDeLaVenta({ total: 200 })).toEqual({
      estado: 'oculto',
      costo: null,
      utilidad: null,
      margen: null,
    });
  });

  it('una venta de importe cero no es «sin receta»: no hay margen que dar', () => {
    expect(economiaDeLaVenta(venta(0, 0))).toEqual({
      estado: 'conocido',
      costo: 0,
      utilidad: 0,
      margen: null,
    });
  });

  it('el margen que guardó el servidor manda; si falta, se calcula', () => {
    expect(
      economiaDeLaVenta({ total: 100, costo_total_snapshot: 40, margen_snapshot: 61.5 }).margen,
    ).toBe(61.5);
    expect(economiaDeLaVenta({ total: 100, costo_total_snapshot: 40 }).margen).toBe(60);
  });

  it('una pérdida es un margen negativo, no «sin receta»', () => {
    expect(economiaDeLaVenta(venta(100, 130))).toMatchObject({
      estado: 'conocido',
      utilidad: -30,
      margen: -30,
    });
  });

  it('el texto de lo desconocido es «—, sin receta»', () => {
    expect(SIN_RECETA).toBe('—, sin receta');
  });
});

describe('la economía de un periodo', () => {
  it('todas con costo: lo de siempre', () => {
    expect(economiaDelPeriodo([venta(200, 80), venta(100, 50)])).toEqual({
      estado: 'conocido',
      ingresos: 300,
      ingresosConCosto: 300,
      costo: 130,
      utilidad: 170,
      margen: (170 * 100) / 300,
      conCosto: 2,
      sinReceta: 0,
      recetaIncompleta: 0,
    });
  });

  it('SÓLO sin receta: ni utilidad ni margen, y no dice 100 %', () => {
    const e = economiaDelPeriodo([venta(200, 0), venta(100, 0)]);
    expect(e).toMatchObject({
      estado: 'sin_receta',
      ingresos: 300,
      costo: null,
      utilidad: null,
      margen: null,
      conCosto: 0,
      sinReceta: 2,
    });
  });

  it('mezcladas: el margen es el de las que tienen costo, y se cuenta cuántas quedaron fuera', () => {
    const e = economiaDelPeriodo([venta(200, 80), venta(500, 0)]);
    expect(e).toMatchObject({
      estado: 'parcial',
      ingresos: 700,
      ingresosConCosto: 200,
      costo: 80,
      utilidad: 120,
      margen: 60,
      conCosto: 1,
      sinReceta: 1,
    });
  });

  it('sin ventas: nada que decir', () => {
    expect(economiaDelPeriodo([])).toMatchObject({
      estado: 'conocido',
      ingresos: 0,
      utilidad: 0,
      margen: null,
      sinReceta: 0,
    });
  });

  it('quien no ve costos: el periodo es «oculto»', () => {
    expect(economiaDelPeriodo([{ total: 200 }, { total: 100 }])).toMatchObject({
      estado: 'oculto',
      utilidad: null,
      margen: null,
    });
  });

  it('las ventas de importe cero no cuentan como «sin receta»', () => {
    expect(economiaDelPeriodo([venta(0, 0), venta(200, 80)])).toMatchObject({
      estado: 'conocido',
      sinReceta: 0,
      conCosto: 2,
    });
  });
});

describe('el subtítulo del margen de un periodo', () => {
  it('con costo en todas: el margen; sin ventas, 0.0 % como siempre', () => {
    expect(subtituloDelMargen(economiaDelPeriodo([venta(200, 80)]))).toBe('60.0% margen');
    expect(subtituloDelMargen(economiaDelPeriodo([]))).toBe('0.0% margen');
  });

  it('SÓLO sin receta: «sin receta», jamás «100.0% margen»', () => {
    expect(subtituloDelMargen(economiaDelPeriodo([venta(200, 0)]))).toBe('sin receta');
  });

  it('mezcladas: el margen de las que tienen costo y cuántas quedaron fuera', () => {
    expect(subtituloDelMargen(economiaDelPeriodo([venta(200, 80), venta(500, 0)]))).toBe(
      '60.0% margen · 1 venta sin receta',
    );
  });

  it('quien no ve costos no lee nada', () => {
    expect(subtituloDelMargen(economiaDelPeriodo([{ total: 200 }]))).toBe('');
  });

  it('el margen se escribe con un decimal, o «—» si no existe', () => {
    expect(textoDelMargen(56.666)).toBe('56.7%');
    expect(textoDelMargen(null)).toBe('—');
  });
});

describe('DP-13.2 · el estado del costo lo dice el SERVIDOR (una cuenta con y sin receta)', () => {
  const conEstado = (
    total: number,
    costo: number,
    estado_costo: 'conocido' | 'sin_receta' | 'receta_incompleta',
  ) => ({ ...venta(total, costo), estado_costo });

  it('receta incompleta: el costo de lo que sí tiene receta NO da un margen inflado', () => {
    expect(economiaDeLaVenta(conEstado(300, 50, 'receta_incompleta'))).toEqual({
      estado: 'receta_incompleta',
      costo: null,
      utilidad: null,
      margen: null,
    });
    expect(RECETA_INCOMPLETA).toBe('—, receta incompleta');
  });

  it('si el servidor dice «sin receta», manda sobre la foto del cobro', () => {
    expect(economiaDeLaVenta(conEstado(300, 50, 'sin_receta')).estado).toBe('sin_receta');
  });

  it('en un periodo, la incompleta queda fuera del margen y se cuenta aparte', () => {
    const e = economiaDelPeriodo([
      conEstado(200, 80, 'conocido'),
      conEstado(300, 50, 'receta_incompleta'),
    ]);
    expect(e).toMatchObject({
      estado: 'parcial',
      ingresos: 500,
      ingresosConCosto: 200,
      margen: 60,
      conCosto: 1,
      sinReceta: 0,
      recetaIncompleta: 1,
    });
    expect(subtituloDelMargen(e)).toBe('60.0% margen · 1 venta con receta incompleta');
  });

  it('sólo incompletas: no hay margen, y se dice «receta incompleta», no «sin receta»', () => {
    const e = economiaDelPeriodo([conEstado(300, 50, 'receta_incompleta')]);
    expect(e).toMatchObject({ estado: 'sin_receta', margen: null, recetaIncompleta: 1 });
    expect(subtituloDelMargen(e)).toBe('receta incompleta');
  });

  it('de las dos: se dicen las dos', () => {
    const e = economiaDelPeriodo([
      conEstado(200, 80, 'conocido'),
      conEstado(100, 0, 'sin_receta'),
      conEstado(300, 50, 'receta_incompleta'),
      conEstado(300, 50, 'receta_incompleta'),
    ]);
    expect(subtituloDelMargen(e)).toBe(
      '60.0% margen · 1 venta sin receta · 2 ventas con receta incompleta',
    );
  });
});

describe('la nota de las que quedaron fuera', () => {
  it('singular y plural', () => {
    expect(notaDeLasVentasSinReceta(1)).toBe('1 venta sin receta');
    expect(notaDeLasVentasSinReceta(3)).toBe('3 ventas sin receta');
  });
});

describe('lo que dice el encabezado del historial', () => {
  it('cuenta las transacciones y dice QUÉ suma el total: lo cobrado de las pagadas', () => {
    expect(
      resumenDeLasVentas([
        { estado: 'pagada', total: 100 },
        { estado: 'pagada', total: 50.5 },
        { estado: 'abierta', total: 80 },
      ]),
    ).toEqual({ transacciones: 3, pagadas: 2, cobradoPesos: 150.5 });
  });

  it('UNA cuenta abierta: cero pagadas y cero cobrado, que es lo que pasa', () => {
    expect(resumenDeLasVentas([{ estado: 'abierta', total: 80 }])).toEqual({
      transacciones: 1,
      pagadas: 0,
      cobradoPesos: 0,
    });
  });

  it('sin importe cuenta como cero', () => {
    expect(resumenDeLasVentas([{ estado: 'pagada', total: null }])).toEqual({
      transacciones: 1,
      pagadas: 1,
      cobradoPesos: 0,
    });
  });

  it('el texto dice qué cuenta cada cifra, en singular y en plural', () => {
    const dinero = (pesos: number) => `$${pesos.toFixed(2)}`;
    expect(textoDelResumenDeVentas({ transacciones: 1, pagadas: 0, cobradoPesos: 0 }, dinero)).toBe(
      '1 transacción · 0 pagadas · Cobrado: $0.00',
    );
    expect(
      textoDelResumenDeVentas({ transacciones: 3, pagadas: 1, cobradoPesos: 150.5 }, dinero),
    ).toBe('3 transacciones · 1 pagada · Cobrado: $150.50');
  });
});
