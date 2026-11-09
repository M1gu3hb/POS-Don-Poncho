import { describe, expect, it } from 'vitest';

import { aCsv } from './exportar.ts';

/**
 * DP-15 · F2 · LA RUTA DE EXPORTE DEL SERVIDOR TAMBIÉN DICE LA HORA DEL RESTAURANTE (M7).
 *
 * `/api/reportes/exportar` escribía los instantes en ISO con `Z` (UTC): el archivo del contador
 * decía 18:06 para una venta de las 12:06. Con la zona del negocio (`organizaciones.zona_horaria`)
 * el instante sale «2026-11-08 12:06:13». Los días sin hora (`compras.fecha`) no se tocan.
 */

const ZONA = 'America/Mexico_City';

describe('aCsv con la zona del negocio', () => {
  it('un instante ISO sale en la hora del restaurante', () => {
    const csv = aCsv([{ folio: 'A-1', fecha_cierre: '2026-11-08T18:06:13.000Z' }], ZONA);
    expect(csv).toBe('folio,fecha_cierre\nA-1,2026-11-08 12:06:13');
  });

  it('un día sin hora no se mueve', () => {
    const csv = aCsv([{ fecha: '2026-11-08' }], ZONA);
    expect(csv).toBe('fecha\n2026-11-08');
  });

  it('un texto que no es una fecha no se toca', () => {
    const csv = aCsv([{ notas: 'cobro a las 2026-11-08T18:06:13Z según el cajero' }], ZONA);
    expect(csv).toBe('notas\ncobro a las 2026-11-08T18:06:13Z según el cajero');
  });
});
