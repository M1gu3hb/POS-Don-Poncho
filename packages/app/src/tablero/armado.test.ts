import { planDelPeriodo } from '@morphiqpos/domain/tablero';
import { describe, expect, it } from 'vitest';

import { armarElTablero, ticketPromedio, type SumaDeVentas } from './armado.ts';

/** DP-21 · Bloque 13 · el armado del tablero: centavos enteros, ceros donde no se vendió, y la semana pasada. */
const suma = (ventas: bigint, cuentas: number, costo = 0n, conCosto = ventas): SumaDeVentas => ({
  cuentas,
  ventasCentavos: ventas,
  ventaConCostoCentavos: conCosto,
  costoCentavos: costo,
  sinReceta: 0,
  recetaIncompleta: 0,
});

describe('ticketPromedio', () => {
  it('redondea al centavo más cercano y no divide entre cero', () => {
    expect(ticketPromedio(10_000n, 3)).toBe(3_333n);
    expect(ticketPromedio(10_001n, 3)).toBe(3_334n);
    expect(ticketPromedio(0n, 0)).toBe(0n);
  });
});

describe('armarElTablero · la semana', () => {
  // Miércoles 2026-11-18: el negocio sólo abrió martes y miércoles.
  const plan = planDelPeriodo('semana', '2026-11-18');
  const actual = new Map([
    ['2026-11-17', suma(150_000n, 3, 60_000n)],
    ['2026-11-18', suma(99_999n, 2, 30_000n)],
  ]);
  const deAntes = new Map([
    ['2026-11-10', suma(120_000n, 4)],
    ['2026-11-11', suma(200_000n, 5)],
  ]);
  const armado = armarElTablero(
    plan,
    actual,
    deAntes,
    new Map([['2026-11-17', 5_000n]]),
    5_000n,
    suma(320_000n, 9),
  );

  it('siete filas, y los días sin venta salen en cero (no se omiten)', () => {
    expect(armado.filas.map((f) => f.etiqueta)).toEqual([
      'lun',
      'mar',
      'mié',
      'jue',
      'vie',
      'sáb',
      'dom',
    ]);
    expect(armado.filas[0]).toMatchObject({
      ventasCentavos: '0',
      cuentas: 0,
      ticketPromedioCentavos: '0',
      gastosCentavos: '0',
    });
  });

  it('cada día trae su ticket promedio y se compara con el mismo día de la semana pasada', () => {
    expect(armado.filas[1]).toMatchObject({
      clave: '2026-11-17',
      ventasCentavos: '150000',
      cuentas: 3,
      ticketPromedioCentavos: '50000',
      gastosCentavos: '5000',
      referencia: { ventasCentavos: '120000', cuentas: 4, ticketPromedioCentavos: '30000' },
      diferenciaCentavos: '30000',
    });
    // Miércoles: 99,999 de hoy contra 200,000 del miércoles pasado.
    expect(armado.filas[2]?.diferenciaCentavos).toBe('-100001');
    // Un día sin venta ni referencia sigue comparándose: 0 contra 0.
    expect(armado.filas[3]?.diferenciaCentavos).toBe('0');
  });

  it('los totales suman en centavos enteros y la utilidad neta resta los gastos', () => {
    expect(armado.totales).toMatchObject({
      ventasCentavos: '249999',
      cuentas: 5,
      costoCentavos: '90000',
      ventaConCostoCentavos: '249999',
      utilidadBrutaCentavos: '159999',
      gastosCentavos: '5000',
      utilidadNetaCentavos: '154999',
      sinCostoConocido: false,
      referencia: { ventasCentavos: '320000', cuentas: 9 },
    });
  });
});

describe('armarElTablero · otros periodos', () => {
  it('por hora no parte los gastos (son del día) y compara hora contra hora', () => {
    const plan = planDelPeriodo('hoy', '2026-11-18');
    const armado = armarElTablero(
      plan,
      new Map([['13', suma(50_000n, 1)]]),
      new Map([['13', suma(40_000n, 2)]]),
      null,
      12_000n,
      suma(40_000n, 2),
    );
    expect(armado.filas).toHaveLength(24);
    expect(armado.filas[13]).toMatchObject({
      gastosCentavos: null,
      diferenciaCentavos: '10000',
    });
    expect(armado.totales.gastosCentavos).toBe('12000');
  });

  it('el año no compara', () => {
    const armado = armarElTablero(
      planDelPeriodo('anio', '2026-11-18'),
      new Map(),
      new Map(),
      new Map(),
      0n,
      null,
    );
    expect(armado.filas).toHaveLength(12);
    expect(armado.filas.every((f) => f.referencia === null && f.diferenciaCentavos === null)).toBe(
      true,
    );
    expect(armado.totales.referencia).toBeNull();
  });

  it('si ninguna cuenta tiene costo conocido, lo dice (no inventa utilidad)', () => {
    const plan = planDelPeriodo('semana', '2026-11-18');
    const sinReceta: SumaDeVentas = { ...suma(100_000n, 2, 0n, 0n), sinReceta: 2 };
    const armado = armarElTablero(
      plan,
      new Map([['2026-11-18', sinReceta]]),
      new Map(),
      new Map(),
      0n,
      null,
    );
    expect(armado.totales.sinCostoConocido).toBe(true);
    expect(armado.totales.sinReceta).toBe(2);
  });
});
