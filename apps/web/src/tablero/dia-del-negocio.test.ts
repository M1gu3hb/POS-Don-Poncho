import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  TOPE_DE_VENTAS_DEL_DIA,
  avisoDelTopeDeVentas,
  fechaDelNegocio,
  inicioDelDiaDelNegocio,
  msHastaElSiguienteDia,
} from './dia-del-negocio.ts';

// Ciudad de México está en UTC-6 todo el año (sin horario de verano desde 2022).
const cdmx = (iso: string): Date => new Date(iso);

describe('DP-15 · «hoy» del Tablero es el día del negocio (CDMX)', () => {
  it('23:59 y 00:01 de CDMX son días distintos', () => {
    // 23:59 CDMX del 14 = 05:59 UTC del 15; 00:01 CDMX del 15 = 06:01 UTC del 15.
    expect(fechaDelNegocio(cdmx('2026-11-15T05:59:00.000Z'))).toBe('2026-11-14');
    expect(fechaDelNegocio(cdmx('2026-11-15T06:01:00.000Z'))).toBe('2026-11-15');
  });

  it('18:30 UTC sigue siendo el mismo día en CDMX, y 03:00 UTC es todavía el de ayer', () => {
    expect(fechaDelNegocio(cdmx('2026-11-14T18:30:00.000Z'))).toBe('2026-11-14');
    expect(fechaDelNegocio(cdmx('2026-11-15T03:00:00.000Z'))).toBe('2026-11-14');
  });

  it('el inicio del día es la medianoche de CDMX, no la del navegador ni la UTC', () => {
    const inicio = inicioDelDiaDelNegocio(cdmx('2026-11-14T18:30:12.345Z'));
    expect(new Date(inicio).toISOString()).toBe('2026-11-14T06:00:00.000Z');
    // Una venta de las 19:40 de CDMX (01:40 UTC del día siguiente) cuenta para el día que empezó.
    expect(inicioDelDiaDelNegocio(cdmx('2026-11-15T01:40:00.000Z'))).toBe(inicio);
  });

  it('cruzar la medianoche de CDMX mueve el inicio del día', () => {
    const antes = inicioDelDiaDelNegocio(cdmx('2026-11-15T05:59:59.000Z'));
    const despues = inicioDelDiaDelNegocio(cdmx('2026-11-15T06:00:01.000Z'));
    expect(despues - antes).toBe(86_400_000);
  });

  it('dice cuánto falta para la medianoche, para volver a calcular sin recargar', () => {
    expect(msHastaElSiguienteDia(cdmx('2026-11-15T05:59:00.000Z'))).toBe(60_000);
    expect(msHastaElSiguienteDia(cdmx('2026-11-15T06:00:00.000Z'))).toBe(86_400_000);
  });
});

describe('DP-15 · el tope de ventas del Tablero se avisa', () => {
  it('el tope es 1000 y por debajo no hay aviso', () => {
    expect(TOPE_DE_VENTAS_DEL_DIA).toBe(1000);
    expect(avisoDelTopeDeVentas(999)).toBeNull();
    expect(avisoDelTopeDeVentas(0)).toBeNull();
  });

  it('justo en el tope (o más) avisa que los totales pueden estar incompletos', () => {
    const aviso = 'Se muestran las primeras 1000 ventas; los totales pueden estar incompletos.';
    expect(avisoDelTopeDeVentas(1000)).toBe(aviso);
    expect(avisoDelTopeDeVentas(1200)).toBe(aviso);
  });
});

describe('DP-15.1 · el Tablero usa el día del negocio y avisa del tope', () => {
  const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
  const tablero = readFileSync(join(raiz, 'heredado', 'pages', 'Dashboard.jsx'), 'utf8').replace(
    /\s+/g,
    '',
  );

  it('«hoy» sale del hook del día del negocio, no de la medianoche del navegador', () => {
    expect(tablero).toContain('constinicioDeHoy=useInicioDelDia()');
    expect(tablero).not.toContain('startOfDay');
  });

  it('pide hasta el tope y pinta el aviso con lo que llegó', () => {
    expect(tablero).toContain("'-fecha_cierre',TOPE_DE_VENTAS_DEL_DIA,");
    expect(tablero).toContain(
      '<AvisoDelTopeDeVentasrecibidas={Array.isArray(ventas)?ventas.length:0}/>',
    );
  });

  it('el hook recalcula a la medianoche y al volver a la pantalla', () => {
    const hook = readFileSync(join(raiz, 'src', 'tablero', 'use-inicio-del-dia.ts'), 'utf8');
    expect(hook).toContain("addEventListener('visibilitychange'");
    expect(hook).toContain('msHastaElSiguienteDia(ahora)');
  });
});
