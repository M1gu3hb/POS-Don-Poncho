import { describe, expect, it } from 'vitest';

import { delDia } from './del-dia.ts';

describe('DP-15 · el Tablero cuenta el día, no una caja', () => {
  const inicio = new Date('2026-11-14T06:00:00.000Z').getTime();
  const ventas = [
    { id: 'caja1', corte_caja_id: 'c1', fecha_cierre: '2026-11-14T17:00:00.000Z', total: 100 },
    { id: 'caja2', corte_caja_id: 'c2', fecha_cierre: '2026-11-14T18:00:00.000Z', total: 50 },
    { id: 'cerrada', corte_caja_id: 'c0', fecha_cierre: '2026-11-14T07:00:00.000Z', total: 25 },
    { id: 'ayer', corte_caja_id: 'c9', fecha_cierre: '2026-11-13T23:00:00.000Z', total: 999 },
    { id: 'sin-fecha', fecha_cierre: null, total: 1 },
    null,
  ];
  const gastos = [
    { id: 'hoy', created_date: '2026-11-14T16:00:00.000Z', monto: 30 },
    { id: 'antier', created_date: '2026-11-12T16:00:00.000Z', monto: 70 },
  ];

  it('suma las ventas de todas las cajas del día, también de una ya cerrada', () => {
    expect(delDia(ventas, gastos, inicio).ventas.map((v) => v.id)).toEqual([
      'caja1',
      'caja2',
      'cerrada',
    ]);
  });

  it('deja fuera lo de días anteriores y lo que no tiene fecha', () => {
    const r = delDia(ventas, gastos, inicio);
    expect(r.ventas.some((v) => v.id === 'ayer' || v.id === 'sin-fecha')).toBe(false);
    expect(r.gastos.map((g) => g.id)).toEqual(['hoy']);
  });
});

describe('DP-15 · el Tablero usa la regla del día', () => {
  it('lee las ventas del día en la base y las cuenta con `delDia`, sin depender de una caja', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
    const c = readFileSync(join(raiz, 'heredado', 'pages', 'Dashboard.jsx'), 'utf8').replace(
      /\s+/g,
      '',
    );
    expect(c).toContain(
      "api.entidades.Venta.enRango({campo:'fecha_cierre',desde:newDate(inicioDeHoy).toISOString()}",
    );
    expect(c).toContain('delDia(safeVentas,safeGastos,inicioDeHoy)');
    expect(c).not.toContain('if(!cajaAbierta){return{totalVentas:0');
  });
});
