import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { leerVentasDelPeriodo } from './lecturas-de-registros.ts';
import type { PeticionDeRango } from './periodo-de-registros.ts';

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

describe('DP-18 · A21 · la consulta de Ventas lleva el PERIODO', () => {
  const rango = { from: new Date(2026, 10, 1), to: new Date(2026, 10, 7, 23, 59, 59) };

  it('pide por fecha de creación y por fecha de cierre, con el periodo, y no «las últimas N»', async () => {
    const pedidas: { rango: PeticionDeRango; limite: number | undefined }[] = [];
    const ventas = {
      enRango: (r: PeticionDeRango, _d?: Record<string, never>, _o?: string, limite?: number) => {
        pedidas.push({ rango: r, limite });
        return Promise.resolve([] as { id: string }[]);
      },
    };
    await leerVentasDelPeriodo(ventas, rango);
    expect(pedidas.map((p) => p.rango.campo).sort()).toEqual(['created_date', 'fecha_cierre']);
    for (const p of pedidas) {
      expect(p.rango.desde).toBe(rango.from.toISOString());
      expect(p.rango.hasta).toBe(rango.to.toISOString());
      expect(p.limite).toBe(1000);
    }
  });

  it('una cuenta abierta antes del periodo y cobrada dentro aparece una sola vez', async () => {
    const vieja = { id: 'v1', created_date: '2026-10-31T23:00:00Z' };
    const nueva = { id: 'v2', created_date: '2026-11-02T10:00:00Z' };
    const ventas = {
      enRango: (r: PeticionDeRango) =>
        Promise.resolve(r.campo === 'fecha_cierre' ? [vieja, nueva] : [nueva]),
    };
    const r = await leerVentasDelPeriodo(ventas, rango);
    expect(r.filas.map((f) => f.id)).toEqual(['v2', 'v1']);
    expect(r.truncada).toBe(false);
  });
});

describe('DP-18 · A21 · Registros usa el periodo y avisa del tope (contrato)', () => {
  const fuente = readFileSync(join(RAIZ_WEB, 'heredado/pages/Registros.jsx'), 'utf8').replace(
    /\s+/g,
    '',
  );

  it('ninguna pestaña pide «las últimas N» con un tope fijo', () => {
    expect(fuente).not.toMatch(/\.list\(/);
    expect(fuente).toContain('leerVentasDelPeriodo(api.entidades.Venta,range)');
    expect(fuente).toContain('leerDelPeriodo(api.entidades[entidad],campo,tipo,range)');
  });

  it('el aviso del tope sale en cada pestaña con datos del servidor', () => {
    for (const lectura of ['cortesRaw', 'ventasRaw', 'comprasRaw', 'movimientosRaw', 'gastosRaw']) {
      expect(fuente).toMatch(new RegExp(`avisoDe\\('[a-z]+',${lectura}\\)`));
    }
    expect(fuente).toContain('<Avisotono="atencion"titulo={texto}/>');
  });

  it('el resumen y las listas comparten el periodo', () => {
    expect(fuente).toContain('range={range}');
    expect(fuente).toContain('onPeriodo={setPeriodo}');
  });
});
