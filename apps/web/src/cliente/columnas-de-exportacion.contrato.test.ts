import { MAPA, TOTALES_DE_CAJA } from '@morphiqpos/app/puente';
import { describe, expect, it } from 'vitest';

import { COLUMNS_CORTES } from '../../heredado/lib/exportColumns.js';

/**
 * QA1-8 (DP-13.5) · EL CSV DE LOS CORTES SÓLO PIDE LO QUE EL PUENTE SIRVE.
 *
 * Registros → Cortes → Exportar arma el CSV con las filas de `CorteCaja`. Sus columnas leían
 * `efectivo_esperado` y `diferencia_efectivo` (el puente los descarta: sirve la foto del cierre,
 * `esperado_al_cerrar` y `diferencia_al_cerrar`), `fecha_inicio`, y costo, utilidad, margen y gastos,
 * que el corte no trae: el CSV salía con «Efectivo esperado 0.00 · Diferencia 0.00» en cada corte,
 * aunque el cierre hubiera dado un faltante. Las ventas por método sí vienen: las agrega el puente.
 */

const CORTE = MAPA['CorteCaja'];
const SERVIDOS = new Set([
  ...Object.keys(CORTE?.campos ?? {}),
  ...Object.keys(CORTE?.derivados ?? {}),
  ...Object.keys(CORTE?.calculados ?? {}),
  // Los que `consultar` agrega a cada corte (las ventas por método y cuántas).
  ...TOTALES_DE_CAJA,
]);

describe('las columnas del CSV de cortes', () => {
  it('cada una es un campo que `CorteCaja` sirve', () => {
    const faltan = COLUMNS_CORTES.map((c: { key: string }) => c.key).filter(
      (clave: string) => !SERVIDOS.has(clave),
    );
    expect(faltan).toEqual([]);
  });

  it('el esperado y la diferencia son los del cierre', () => {
    const porRotulo = new Map(
      COLUMNS_CORTES.map((c: { key: string; label: string }) => [c.label, c.key]),
    );
    expect(porRotulo.get('Efectivo esperado')).toBe('esperado_al_cerrar');
    expect(porRotulo.get('Diferencia')).toBe('diferencia_al_cerrar');
  });

  it('trae lo vendido por método y cuántas ventas (lo agrega el puente)', () => {
    const claves = new Set(COLUMNS_CORTES.map((c: { key: string }) => c.key));
    for (const clave of ['numero_ventas', 'total_general', 'total_efectivo', 'total_tarjeta']) {
      expect(claves.has(clave), clave).toBe(true);
    }
  });
});
