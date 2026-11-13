import { describe, expect, it } from 'vitest';

import { BASE_POR_COMPRA, INSUMOS, PRODUCTOS_DE_PRUEBA } from '../dia0/datos.ts';
import type { AsientoFechado, Asiento } from '../libro.ts';
import { crearComparador } from './base.ts';
import { parsearCsv } from './dueno.ts';
import { consumoPorUnidad, existenciaEsperada } from './inventario.ts';

const fila = (asiento: Asiento, dia = 1): AsientoFechado => ({
  dia,
  horaSim: '2026-11-16T14:00:00.000Z',
  bot: 'prueba',
  asiento,
});

describe('el comparador del árbitro', () => {
  it('cuenta iguales y diferencias, y una violación siempre es diferencia', () => {
    const c = crearComparador();
    c.comparar('cajas', 'total', 1000, 1000);
    c.comparar('cajas', 'propina', 150, 100);
    c.violacion('invariantes', 'C01', '2 filas');
    const r = c.resultado(1);
    expect(r.comparaciones).toBe(3);
    expect(r.iguales).toBe(1);
    expect(r.diferencias.map((d) => d.concepto)).toEqual(['propina', 'C01']);
    expect(r.porFuente['cajas']).toEqual({ comparaciones: 2, diferencias: 1 });
  });

  it('compara texto y número como texto (1000 es «1000»)', () => {
    const c = crearComparador();
    c.comparar('x', 'a', 1000, '1000');
    expect(c.resultado(1).diferencias).toHaveLength(0);
  });
});

describe('el CSV del dueño', () => {
  it('lee comillas, comas dentro de un campo y comillas dobles', () => {
    const filas = parsearCsv('﻿Folio,Total,Nota\nA-1,"1,234.50","dijo ""hola"""\r\nA-2,10.00,\n');
    expect(filas).toEqual([
      ['Folio', 'Total', 'Nota'],
      ['A-1', '1,234.50', 'dijo "hola"'],
      ['A-2', '10.00', ''],
    ]);
  });
});

describe('la existencia que el libro espera', () => {
  it('suma compras en unidad base, resta mermas y lo que descuentan las recetas de lo cobrado', () => {
    const libro = [
      fila(
        {
          tipo: 'compra',
          insumo: 'Carne de prueba',
          cantidad: 40 * BASE_POR_COMPRA.kg,
          unidad: 'g',
          costoCentavos: 720_000,
        },
        0,
      ),
      fila({ tipo: 'merma', insumo: 'Carne de prueba', cantidad: 1500, unidad: 'g' }, 0),
      fila({
        tipo: 'linea',
        cuenta: 'c1',
        producto: 'Taco de prueba',
        cantidad: 3,
        opciones: [],
        importeCentavos: 10_500,
        estacion: 'cocina',
        canal: 'mesa',
      }),
      fila({
        tipo: 'linea',
        cuenta: 'c1',
        producto: 'Barbacoa por kilo de prueba',
        cantidad: 0.5,
        opciones: [],
        importeCentavos: 39_750,
        estacion: 'cocina',
        canal: 'mesa',
      }),
      fila({
        tipo: 'linea',
        cuenta: 'c2',
        producto: 'Taco de prueba',
        cantidad: 9,
        opciones: [],
        importeCentavos: 31_500,
        estacion: 'cocina',
        canal: 'mesa',
      }),
      fila({
        tipo: 'cobro',
        caja: 'Caja 1',
        cuenta: 'c1',
        folio: 'A-9',
        canal: 'mesa',
        totalCentavos: 50_250,
        propinaCentavos: 0,
        descuentoCentavos: 0,
        pagos: { efectivo: 50_250, tarjeta: 0, transferencia: 0 },
        cambioCentavos: 0,
      }),
    ];
    const { existencia, consumo } = existenciaEsperada(libro);
    // 40 000 − 1 500 − (3 tacos × 60 g) − (0.5 kg × 1 000 g); la cuenta c2 no se cobró: no descuenta.
    expect(existencia.get('Carne de prueba')).toBe(40_000 - 1_500 - 180 - 500);
    expect(consumo.get('Carne de prueba')).toBe(680);
    expect(existencia.get('Tortilla de prueba')).toBe(-6);
  });

  it('por porción baja su ingrediente base por porción, y por peso 1 000 por kilo (A3)', () => {
    expect(consumoPorUnidad('Shot de tequila de prueba')).toEqual({ 'Tequila de prueba': 45 });
    expect(consumoPorUnidad('Barbacoa por kilo de prueba')).toEqual({ 'Carne de prueba': 1000 });
  });

  it('un para llevar que se volvió a armar cuenta sólo su último armado', () => {
    // La app reutiliza la orden del para llevar al rearmarlo y reemplaza sus renglones: el día 2 el
    // libro contaba los dos armados de 7 pedidos (60 tortillas de más contra la base).
    const renglon = (veces: number, horaSim: string): AsientoFechado => ({
      ...fila({
        tipo: 'linea',
        cuenta: 'orden-1',
        producto: 'Taco de prueba',
        cantidad: veces,
        opciones: [],
        importeCentavos: veces * 3_500,
        estacion: 'cocina',
        canal: 'llevar',
      }),
      horaSim,
    });
    const libro = [
      renglon(2, '2026-11-22T00:56:10.000Z'),
      renglon(3, '2026-11-22T01:06:23.000Z'),
      fila({
        tipo: 'cobro',
        caja: 'Caja 1',
        cuenta: 'orden-1',
        folio: '453',
        canal: 'llevar',
        totalCentavos: 10_500,
        propinaCentavos: 0,
        descuentoCentavos: 0,
        pagos: { efectivo: 10_500, tarjeta: 0, transferencia: 0 },
        cambioCentavos: 0,
      }),
    ];
    expect(existenciaEsperada(libro).consumo.get('Carne de prueba')).toBe(3 * 60);
  });

  it('cada producto de prueba nombra insumos que existen y cada insumo se compra en una unidad conocida', () => {
    const nombres = new Set(INSUMOS.map((i) => i.nombre));
    for (const p of PRODUCTOS_DE_PRUEBA) {
      for (const insumo of Object.keys(consumoPorUnidad(p.nombre)))
        expect(nombres.has(insumo), `${p.nombre} usa ${insumo}`).toBe(true);
    }
    for (const i of INSUMOS) expect(BASE_POR_COMPRA[i.unidadDeCompra]).toBeGreaterThan(0);
  });
});
