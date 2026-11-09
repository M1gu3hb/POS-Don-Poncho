import { describe, expect, it } from 'vitest';

import {
  COLUMNS_CORTES,
  COLUMNS_MOVIMIENTOS,
  COLUMNS_VENTAS,
} from '../../heredado/lib/exportColumns.js';

/**
 * DP-15 · F2 · EL CSV DE REGISTROS DICE LA HORA DEL RESTAURANTE (auditoría 1, M7).
 *
 * Registros → Ventas → Exportar → CSV escribía «Fecha 2026-11-08 18:06:13» para la venta que la
 * pantalla y el ticket dicen a las 12:06: `fmtDate` cortaba el ISO en UTC. El dueño abre el
 * archivo con seis horas de diferencia contra lo que vio. La zona es la del negocio
 * (America/Mexico_City), no la del aparato ni la del servidor.
 */

interface Columna {
  readonly key: string;
  readonly format?: (valor: unknown) => unknown;
}

function formatoDe(columnas: readonly Columna[], clave: string): (valor: unknown) => unknown {
  const formato = columnas.find((c) => c.key === clave)?.format;
  if (formato === undefined) throw new Error(`La columna ${clave} no tiene formato.`);
  return formato;
}

// 12:06:13 en la Ciudad de México (UTC-6, sin horario de verano desde 2022).
const COBRO_UTC = '2026-11-08T18:06:13.000Z';

describe('las fechas de los CSV de Registros van en la hora del restaurante', () => {
  it('Ventas · «Cobro» es 12:06:13, no 18:06:13', () => {
    expect(formatoDe(COLUMNS_VENTAS, 'fecha_cierre')(COBRO_UTC)).toBe('2026-11-08 12:06:13');
  });

  it('Ventas · «Fecha» (la apertura) también', () => {
    expect(formatoDe(COLUMNS_VENTAS, 'fecha_apertura')('2026-11-08T17:42:00.000Z')).toBe(
      '2026-11-08 11:42:00',
    );
  });

  it('Cortes · apertura y cierre', () => {
    expect(formatoDe(COLUMNS_CORTES, 'fecha_apertura')('2026-11-08T17:49:00.000Z')).toBe(
      '2026-11-08 11:49:00',
    );
    expect(formatoDe(COLUMNS_CORTES, 'fecha_cierre')('2026-11-08T18:11:05.000Z')).toBe(
      '2026-11-08 12:11:05',
    );
  });

  it('Movimientos · la fecha', () => {
    expect(formatoDe(COLUMNS_MOVIMIENTOS, 'fecha')(COBRO_UTC)).toBe('2026-11-08 12:06:13');
  });

  it('una venta de las 21:30 se queda en SU día, no pasa al siguiente', () => {
    // 03:30 UTC del día 9 es todavía el 8 a las 21:30 en México.
    expect(formatoDe(COLUMNS_VENTAS, 'fecha_cierre')('2026-11-09T03:30:00.000Z')).toBe(
      '2026-11-08 21:30:00',
    );
  });

  it('una fecha SIN hora no se corre al día anterior', () => {
    expect(formatoDe(COLUMNS_VENTAS, 'fecha_cierre')('2026-11-08')).toBe('2026-11-08');
  });

  it('el vacío es vacío', () => {
    expect(formatoDe(COLUMNS_VENTAS, 'fecha_cierre')(null)).toBe('');
    expect(formatoDe(COLUMNS_VENTAS, 'fecha_cierre')('')).toBe('');
  });
});
