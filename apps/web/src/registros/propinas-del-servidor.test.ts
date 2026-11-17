import { describe, expect, it } from 'vitest';

import {
  avisoDeLasPropinas,
  desgloseDeLasPropinas,
  peticionDeLasPropinas,
  rangoDeLasPropinas,
  totalesDeLasPropinas,
  type PropinaDeVentaDelServidor,
  type PropinasDelServidor,
} from './propinas-del-servidor.ts';

/**
 * A23 · LAS PROPINAS DE REGISTROS, DEL SERVIDOR.
 *
 * El servidor suma el rango entero por mesero (centavos enteros, sin el tope del puente). La pantalla
 * sólo arma el rango, lo pide y lee lo que contesta; y dice cuando la lista de detalle viene topada.
 */

const AHORA = new Date(2026, 10, 18, 15, 30); // miércoles 18 de noviembre de 2026

describe('rangoDeLasPropinas', () => {
  it('hoy: del primer al último instante del día', () => {
    const r = rangoDeLasPropinas('today', '', '', AHORA);
    expect(r.from).toEqual(new Date(2026, 10, 18, 0, 0, 0, 0));
    expect(r.to).toEqual(new Date(2026, 10, 18, 23, 59, 59, 999));
  });

  it('esta semana: de lunes a domingo', () => {
    const r = rangoDeLasPropinas('week', '', '', AHORA);
    expect(r.from).toEqual(new Date(2026, 10, 16, 0, 0, 0, 0));
    expect(r.to).toEqual(new Date(2026, 10, 22, 23, 59, 59, 999));
  });

  it('quincena: hoy y los 14 días anteriores', () => {
    const r = rangoDeLasPropinas('quincena', '', '', AHORA);
    expect(r.from).toEqual(new Date(2026, 10, 4, 0, 0, 0, 0));
    expect(r.to).toEqual(new Date(2026, 10, 18, 23, 59, 59, 999));
  });

  it('este mes: del 1 al último día', () => {
    const r = rangoDeLasPropinas('month', '', '', AHORA);
    expect(r.from).toEqual(new Date(2026, 10, 1, 0, 0, 0, 0));
    expect(r.to).toEqual(new Date(2026, 10, 30, 23, 59, 59, 999));
  });

  it('personalizado: los días se leen en hora LOCAL (new Date("2026-11-10") es el día anterior en México)', () => {
    const r = rangoDeLasPropinas('custom', '2026-11-10', '2026-11-12', AHORA);
    expect(r.from).toEqual(new Date(2026, 10, 10, 0, 0, 0, 0));
    expect(r.to).toEqual(new Date(2026, 10, 12, 23, 59, 59, 999));
  });

  it('personalizado con una fecha rota cae a hoy, no a «Invalid Date»', () => {
    const r = rangoDeLasPropinas('custom', 'ayer', '', AHORA);
    expect(r.from).toEqual(new Date(2026, 10, 18, 0, 0, 0, 0));
    expect(Number.isNaN(r.to.getTime())).toBe(false);
  });
});

describe('peticionDeLasPropinas', () => {
  const rango = {
    from: new Date(Date.UTC(2026, 10, 16, 6)),
    to: new Date(Date.UTC(2026, 10, 23, 5)),
  };

  it('manda los instantes, el estado y el mesero; «todos» es sin mesero', () => {
    expect(peticionDeLasPropinas(rango, 'todas', '__all__')).toEqual({
      desde: '2026-11-16T06:00:00.000Z',
      hasta: '2026-11-23T05:00:00.000Z',
      estado: 'todas',
      meseroId: null,
    });
  });

  it('un mesero elegido viaja con su id', () => {
    expect(peticionDeLasPropinas(rango, 'pendientes', 'abc').meseroId).toBe('abc');
    expect(peticionDeLasPropinas(rango, 'liquidadas', 'abc').estado).toBe('liquidadas');
  });
});

const RESPUESTA: PropinasDelServidor = {
  desde: '2026-11-16T06:00:00.000Z',
  hasta: '2026-11-23T05:00:00.000Z',
  estado: 'todas',
  meseroId: null,
  totalCentavos: '1234567',
  pendientesCentavos: '1000050',
  liquidadasCentavos: '234517',
  numeroVentas: 1440,
  meseros: [
    { meseroId: 'a', meseroNombre: 'Ana', propinaCentavos: '700000', numeroVentas: 800 },
    {
      meseroId: null,
      meseroNombre: 'Caja / venta directa',
      propinaCentavos: '534567',
      numeroVentas: 640,
    },
  ],
  ventas: [],
  hayMasVentas: true,
};

describe('lo que la pantalla lee', () => {
  it('las tarjetas: el servidor ya sumó; aquí sólo se pasan a pesos', () => {
    expect(totalesDeLasPropinas(RESPUESTA)).toEqual({
      total: 12_345.67,
      pendientes: 10_000.5,
      liquidadas: 2_345.17,
      nVentas: 1440,
    });
  });

  it('el desglose por mesero conserva el orden del servidor y los centavos exactos', () => {
    expect(desgloseDeLasPropinas(RESPUESTA)).toEqual([
      { mesero_id: 'a', mesero_nombre: 'Ana', total: 7_000, num_ventas: 800 },
      { mesero_id: null, mesero_nombre: 'Caja / venta directa', total: 5_345.67, num_ventas: 640 },
    ]);
  });
});

const unaVenta = (n: number): PropinaDeVentaDelServidor => ({
  ordenId: `orden-${String(n)}`,
  serie: 'A',
  folio: String(n),
  cerradaEn: '2026-11-18T12:00:00.000Z',
  mesaNumero: null,
  meseroId: null,
  meseroNombre: 'Caja / venta directa',
  metodoPago: 'efectivo',
  liquidada: false,
  origen: null,
  propinaCentavos: '100',
});

describe('avisoDeLasPropinas', () => {
  it('sin nada fuera, no dice nada', () => {
    expect(avisoDeLasPropinas({ ...RESPUESTA, hayMasVentas: false })).toBeNull();
  });

  it('con la lista topada dice cuántas se muestran de cuántas y que los totales sí cuentan todas', () => {
    const listadas = Array.from({ length: 300 }, (_, n) => unaVenta(n));
    const texto = avisoDeLasPropinas({ ...RESPUESTA, ventas: listadas }) ?? '';
    expect(texto).toContain('Se muestran las 300 propinas más recientes de 1,440');
    expect(texto).toContain('los totales y lo de cada mesero sí cuentan todas');
  });
});
