import { describe, expect, it } from 'vitest';

import {
  detalleDeLaBarra,
  diferenciaEnPalabras,
  margenEnTexto,
  seriesDeLaGrafica,
  type FilaDeLaSerie,
  type SerieDelServidor,
} from './serie-del-tablero.ts';

/** DP-21 · Bloque 13 · lo que la gráfica y su tooltip dicen de lo que el servidor sumó. */
const fila = (cambios: Partial<FilaDeLaSerie> = {}): FilaDeLaSerie => ({
  clave: '2026-11-17',
  etiqueta: 'mar',
  ventasCentavos: '150000',
  cuentas: 3,
  ticketPromedioCentavos: '50000',
  gastosCentavos: '5000',
  costoCentavos: '60000',
  utilidadBrutaCentavos: '90000',
  referencia: { ventasCentavos: '120000', cuentas: 4, ticketPromedioCentavos: '30000' },
  diferenciaCentavos: '30000',
  ...cambios,
});

const serie = (
  periodo: SerieDelServidor['periodo'],
  filas: readonly FilaDeLaSerie[],
): SerieDelServidor => ({
  periodo,
  agrupar: periodo === 'hoy' ? 'hora' : periodo === 'anio' ? 'mes' : 'dia',
  hoy: '2026-11-18',
  filas,
  totales: {
    ventasCentavos: '150000',
    cuentas: 3,
    ticketPromedioCentavos: '50000',
    costoCentavos: '60000',
    ventaConCostoCentavos: '150000',
    utilidadBrutaCentavos: '90000',
    gastosCentavos: '5000',
    utilidadNetaCentavos: '85000',
    sinReceta: 0,
    recetaIncompleta: 0,
    sinCostoConocido: false,
    referencia: null,
  },
});

describe('seriesDeLaGrafica', () => {
  it('por omisión, lo de esta semana y la semana pasada como referencia; sin gastos ni utilidad', () => {
    const { ejes, series } = seriesDeLaGrafica(
      serie('semana', [fila(), fila({ etiqueta: 'mié', referencia: null })]),
      false,
    );
    expect(ejes).toEqual(['mar', 'mié']);
    expect(series.map((s) => s.etiqueta)).toEqual(['Esta semana', 'Semana pasada']);
    expect(series[0]?.valores).toEqual([150_000, 150_000]);
    expect(series[1]?.valores).toEqual([120_000, 0]);
  });

  it('con «Ver gastos y utilidad» suma los gastos y la utilidad neta de cada barra', () => {
    const { series } = seriesDeLaGrafica(serie('semana', [fila()]), true);
    expect(series.map((s) => s.etiqueta)).toEqual([
      'Esta semana',
      'Semana pasada',
      'Gastos',
      'Utilidad neta',
    ]);
    expect(series[2]?.valores).toEqual([5_000]);
    expect(series[3]?.valores).toEqual([85_000]);
  });

  it('el año no tiene referencia; por hora los gastos no se parten (la utilidad es la bruta)', () => {
    expect(seriesDeLaGrafica(serie('anio', [fila()]), false).series.map((s) => s.etiqueta)).toEqual(
      ['Este año'],
    );
    const porHora = seriesDeLaGrafica(serie('hoy', [fila({ gastosCentavos: null })]), true);
    expect(porHora.series.map((s) => s.etiqueta)).toEqual([
      'Hoy',
      'Mismo día, semana pasada',
      'Utilidad bruta',
    ]);
  });

  it('una utilidad negativa no se dibuja como barra hacia abajo (las barras empiezan en cero)', () => {
    const { series } = seriesDeLaGrafica(
      serie('semana', [fila({ utilidadBrutaCentavos: '1000', gastosCentavos: '5000' })]),
      true,
    );
    expect(series[3]?.valores).toEqual([0]);
  });
});

describe('lo que dice cada barra', () => {
  it('ventas, cuentas, ticket promedio y la diferencia contra el mismo día de la semana pasada', () => {
    expect(detalleDeLaBarra(serie('semana', [fila()]), fila(), 'Esta semana', false)).toBe(
      'Esta semana · mar: $1,500.00 · 3 cuentas · ticket promedio $500.00 · +$300.00 contra semana pasada',
    );
  });

  it('una cuenta es «1 cuenta»; un día sin venta dice cero y no inventa nada', () => {
    const vacio = fila({
      ventasCentavos: '0',
      cuentas: 0,
      ticketPromedioCentavos: '0',
      referencia: { ventasCentavos: '0', cuentas: 0, ticketPromedioCentavos: '0' },
      diferenciaCentavos: '0',
    });
    expect(detalleDeLaBarra(serie('semana', [vacio]), vacio, 'Esta semana', false)).toContain(
      '0 cuentas · ticket promedio $0.00 · igual que semana pasada',
    );
    expect(
      detalleDeLaBarra(
        serie('semana', [fila({ cuentas: 1 })]),
        fila({ cuentas: 1 }),
        'Esta semana',
        false,
      ),
    ).toContain('1 cuenta ·');
  });

  it('la barra de la referencia dice cuánto fue, y sin referencia lo dice', () => {
    expect(detalleDeLaBarra(serie('semana', [fila()]), fila(), 'Semana pasada', true)).toBe(
      'Semana pasada · mar: $1,200.00 en 4 cuentas',
    );
    expect(
      detalleDeLaBarra(
        serie('semana', [fila()]),
        fila({ referencia: null }),
        'Semana pasada',
        true,
      ),
    ).toBe('Semana pasada · mar: sin referencia');
  });

  it('la diferencia en palabras: más, menos o igual', () => {
    expect(diferenciaEnPalabras('30000')).toBe('+$300.00 contra la referencia');
    expect(diferenciaEnPalabras('-100001')).toBe('-$1,000.01 contra la referencia');
    expect(diferenciaEnPalabras('0')).toBe('igual que la referencia');
    expect(diferenciaEnPalabras(null)).toBeNull();
  });
});

describe('margenEnTexto', () => {
  it('la utilidad sobre la venta con costo conocido; sin costo conocido no hay margen', () => {
    const base = serie('semana', []).totales;
    expect(
      margenEnTexto({ ...base, ventaConCostoCentavos: '150000', utilidadBrutaCentavos: '90000' }),
    ).toBe('60.0%');
    expect(margenEnTexto({ ...base, sinCostoConocido: true })).toBeNull();
    expect(margenEnTexto({ ...base, ventaConCostoCentavos: '0' })).toBeNull();
  });
});
