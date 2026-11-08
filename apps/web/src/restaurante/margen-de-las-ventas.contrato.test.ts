import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DP-12.6 · CONTRATO: NINGUNA PANTALLA DICE «100 % MARGEN» DE UNA CUENTA SIN RECETA.
 *
 * La regla vive en `@morphiqpos/domain/venta` (`costoDeLaVentaEsDesconocido`) y en
 * `margen-de-las-ventas.ts`. Estas pantallas heredadas sumaban `costo_total_snapshot` (cero si
 * no hay receta) y de ahí sacaban la utilidad y el margen: aquí se exige que cada una pase por la
 * regla, y que ninguna vuelva a leer el margen guardado sin mirarla.
 */

const WEB = join(__dirname, '..', '..');
const fuente = (ruta: string): string => readFileSync(join(WEB, ruta), 'utf8');

describe('el historial de ventas', () => {
  const ventas = fuente('heredado/pages/Ventas.jsx');

  it('el margen de cada fila sale de la regla, no de `margen_snapshot > 0`', () => {
    expect(ventas).toMatch(/<MargenEnLaLista venta=\{v\}/);
    expect(ventas).not.toMatch(/v\.margen_snapshot\s*>\s*0/);
  });

  it('el detalle dice «—, sin receta» donde iría el costo, la utilidad y el margen', () => {
    // DP-14.6-2: el texto es «sin receta» o «receta incompleta» según el estado; tres lugares.
    expect(ventas.match(/sinReceta\s*\?\s*textoSinCosto/g)?.length).toBe(3);
    expect(ventas).toMatch(/RECETA_INCOMPLETA/);
  });

  it('DP-13.2 · a quien no ve márgenes (el cajero), el detalle no le pinta costo, utilidad ni margen', () => {
    expect(ventas).toMatch(/const seVe = seVeElMargen\(economia\) && sePintaElMargen\(/);
    expect(ventas).toMatch(
      /\{seVe && \(\s*<>\s*<div>\s*<p className="text-xs text-muted-foreground">Costo<\/p>/,
    );
  });

  it('no pinta pastillas vacías: ni el folio de una cuenta abierta ni un tipo que la venta no trae', () => {
    expect(ventas).toMatch(
      /\{v\.folio \? <span className="font-heading font-bold">\{v\.folio\}<\/span> : null\}/,
    );
    // El puente no mapea `tipo_venta` para Venta: la pastilla del tipo salía siempre, y vacía.
    expect(ventas).not.toMatch(/v\.tipo_venta/);
  });

  it('una cuenta abierta dice «Cuenta abierta», y su detalle no lleva un título vacío', () => {
    expect(ventas).toMatch(/: 'Cuenta abierta'\}/);
    expect(ventas).toMatch(/: 'Detalle de la cuenta'/);
  });

  it('el encabezado dice qué suma el total', () => {
    expect(ventas).toMatch(/textoDelResumenDeVentas\(resumen, formatCurrency\)/);
    expect(ventas).not.toMatch(/transacciones · Total:/);
  });
});

describe('el tablero y sus análisis', () => {
  it('el tablero cuenta la utilidad con la economía del periodo', () => {
    const tablero = fuente('heredado/pages/Dashboard.jsx');
    expect(tablero).toMatch(/economiaDelPeriodo\(ventasCaja\)/);
    expect(tablero).toMatch(/subtituloDelMargen\(stats\.economia\)/);
  });

  it('el análisis financiero deja las ventas sin receta fuera del costo, la utilidad y el margen', () => {
    const grafica = fuente('heredado/components/dashboard/FinancialChart.jsx');
    expect(grafica).toMatch(/estadoDelCosto === 'sin_receta'/);
    expect(grafica).toMatch(/estadoDelCosto === 'receta_incompleta'/);
    expect(grafica).toMatch(/tot\.ventasConCosto > 0/);
  });
});

describe('los registros del periodo y su PDF', () => {
  it('la utilidad y el margen salen de la economía del periodo', () => {
    const resumen = fuente('heredado/components/registros/ResumenPeriodo.jsx');
    expect(resumen).toMatch(/economiaDelPeriodo\(ventasP\)/);
    expect(resumen).toMatch(/subtituloDelMargen\(economia\)/);
  });

  it('el PDF escribe «—, sin receta» en vez de 0 o 100 %', () => {
    const pdf = fuente('heredado/components/registros/PeriodoPDF.jsx');
    expect(pdf.match(/SIN_RECETA/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('el exporte de los registros', () => {
  it('pasa las ventas por `sinMargenFalso` antes de armar el CSV', () => {
    const exporte = readFileSync(
      join(WEB, '..', '..', 'packages', 'app', 'src', 'reportes', 'exportar.ts'),
      'utf8',
    );
    expect(exporte).toMatch(/aCsv\(sinMargenFalso\(peticion\.entidad, filas\)(, zona)?\)/);
  });
});
