import { describe, expect, it } from 'vitest';

import {
  cifrasDelDia,
  metodosConVentas,
  type CajaParaLasCifras,
  type GastoDelTablero,
  type VentaDelTablero,
} from './cifras-del-dia.ts';

/** La caja abierta a las 08:00 UTC de un día cualquiera. */
const CAJA: CajaParaLasCifras = { id: 'caja-1', fecha_apertura: '2026-10-30T08:00:00.000Z' };

/** Una venta pagada de esta caja. Los importes llegan en PESOS, como los sirve el puente. */
const venta = (resto: Partial<VentaDelTablero> = {}): VentaDelTablero => ({
  corte_caja_id: 'caja-1',
  total: 100,
  costo_total_snapshot: 40,
  monto_efectivo: 100,
  monto_tarjeta: 0,
  monto_transferencia: 0,
  ...resto,
});

const gasto = (resto: Partial<GastoDelTablero> = {}): GastoDelTablero => ({
  monto: 10,
  created_date: '2026-10-30T09:00:00.000Z',
  ...resto,
});

describe('las cifras del día', () => {
  it('sin caja abierta todo está en cero, aunque haya ventas pagadas', () => {
    const cifras = cifrasDelDia({ ventas: [venta()], gastos: [gasto()], cajaAbierta: null });

    expect(cifras.ventasCentavos).toBe(0);
    expect(cifras.costoCentavos).toBe(0);
    expect(cifras.gastosCentavos).toBe(0);
    expect(cifras.tickets).toBe(0);
    expect(cifras.utilidadNetaCentavos).toBe(0);
  });

  it('suma en CENTAVOS lo que el puente sirve en pesos, sin perder ni inventar uno', () => {
    const cifras = cifrasDelDia({
      ventas: [venta({ total: 0.1 }), venta({ total: 0.2 }), venta({ total: 1234.56 })],
      gastos: [],
      cajaAbierta: CAJA,
    });

    // 0.1 + 0.2 en coma flotante es 0.30000000000000004: en centavos es 10 + 20.
    expect(cifras.ventasCentavos).toBe(10 + 20 + 123_456);
    expect(cifras.tickets).toBe(3);
  });

  it('cuenta las ventas del corte de la caja abierta y NO las de otro corte', () => {
    const cifras = cifrasDelDia({
      ventas: [
        venta({ total: 100 }),
        venta({ total: 900, corte_caja_id: 'caja-ayer', fecha_cierre: '2026-10-30T12:00:00Z' }),
      ],
      gastos: [],
      cajaAbierta: CAJA,
    });

    expect(cifras.ventasCentavos).toBe(10_000);
    expect(cifras.tickets).toBe(1);
  });

  it('una venta sin corte cuenta si se cerró desde la apertura, y no si fue antes', () => {
    const sinCorte = { corte_caja_id: null } as const;
    const cifras = cifrasDelDia({
      ventas: [
        venta({ ...sinCorte, total: 10, fecha_cierre: '2026-10-30T10:00:00.000Z' }),
        venta({ ...sinCorte, total: 20, fecha_cierre: '2026-10-29T23:59:59.000Z' }),
      ],
      gastos: [],
      cajaAbierta: CAJA,
    });

    expect(cifras.ventasCentavos).toBe(1_000);
    expect(cifras.tickets).toBe(1);
  });

  it('el instante exacto de la apertura ya es de esta caja', () => {
    const cifras = cifrasDelDia({
      ventas: [venta({ corte_caja_id: null, total: 50, fecha_cierre: '2026-10-30T08:00:00.000Z' })],
      gastos: [gasto({ monto: 5, created_date: '2026-10-30T08:00:00.000Z' })],
      cajaAbierta: CAJA,
    });

    expect(cifras.ventasCentavos).toBe(5_000);
    expect(cifras.gastosCentavos).toBe(500);
  });

  it('una venta sin corte y con la fecha de cierre ilegible no cuenta', () => {
    const cifras = cifrasDelDia({
      ventas: [venta({ corte_caja_id: null, total: 50, fecha_cierre: 'no es una fecha' })],
      gastos: [],
      cajaAbierta: CAJA,
    });

    expect(cifras.tickets).toBe(0);
  });

  it('la apertura sale de fecha_apertura y, si falta o está vacía, de created_date', () => {
    const delGasto = (caja: CajaParaLasCifras): number =>
      cifrasDelDia({
        ventas: [],
        gastos: [gasto({ monto: 1, created_date: '2026-10-30T09:00:00.000Z' })],
        cajaAbierta: caja,
      }).gastosCentavos;
    const antes = '2026-10-30T08:00:00.000Z';
    const despues = '2026-10-30T10:00:00.000Z';

    // fecha_apertura manda sobre created_date, en los dos sentidos.
    expect(delGasto({ id: 'c', fecha_apertura: antes, created_date: despues })).toBe(100);
    expect(delGasto({ id: 'c', fecha_apertura: despues, created_date: antes })).toBe(0);
    // Sin fecha_apertura —ausente, nula o vacía— se sigue con created_date.
    expect(delGasto({ id: 'c', created_date: antes })).toBe(100);
    expect(delGasto({ id: 'c', fecha_apertura: null, created_date: despues })).toBe(0);
    expect(delGasto({ id: 'c', fecha_apertura: '', created_date: despues })).toBe(0);
  });

  it('los gastos sólo cuentan desde la apertura de la caja', () => {
    const cifras = cifrasDelDia({
      ventas: [],
      gastos: [
        gasto({ monto: 12.5, created_date: '2026-10-30T09:30:00.000Z' }),
        gasto({ monto: 300, created_date: '2026-10-29T20:00:00.000Z' }),
      ],
      cajaAbierta: CAJA,
    });

    expect(cifras.gastosCentavos).toBe(1_250);
  });

  it('la utilidad bruta es ventas menos costo, y el margen su proporción en por ciento', () => {
    const cifras = cifrasDelDia({
      ventas: [venta({ total: 200, costo_total_snapshot: 50 })],
      gastos: [],
      cajaAbierta: CAJA,
    });

    expect(cifras.costoCentavos).toBe(5_000);
    expect(cifras.utilidadBrutaCentavos).toBe(15_000);
    expect(cifras.margen).toBe(75);
  });

  it('sin ventas el margen es cero y no un 0/0', () => {
    const cifras = cifrasDelDia({ ventas: [], gastos: [], cajaAbierta: CAJA });

    expect(cifras.margen).toBe(0);
    expect(cifras.ticketPromedioCentavos).toBe(0);
  });

  it('el ticket promedio se redondea al centavo, y sin tickets es cero', () => {
    const cifras = cifrasDelDia({
      ventas: [venta({ total: 33.33 }), venta({ total: 33.33 }), venta({ total: 33.34 })],
      gastos: [],
      cajaAbierta: CAJA,
    });

    // 100.00 entre tres tickets: 33.333… → $33.33.
    expect(cifras.ticketPromedioCentavos).toBe(3_333);
    const dos = cifrasDelDia({
      ventas: [venta({ total: 0.01 }), venta({ total: 0.02 })],
      gastos: [],
      cajaAbierta: CAJA,
    });
    // Tres centavos entre dos tickets: 1.5 centavos, que redondea hacia arriba.
    expect(dos.ticketPromedioCentavos).toBe(2);
  });

  it('la utilidad neta resta los gastos y puede quedar negativa', () => {
    const cifras = cifrasDelDia({
      ventas: [venta({ total: 100, costo_total_snapshot: 90 })],
      gastos: [gasto({ monto: 25 })],
      cajaAbierta: CAJA,
    });

    expect(cifras.utilidadBrutaCentavos).toBe(1_000);
    expect(cifras.gastosCentavos).toBe(2_500);
    expect(cifras.utilidadNetaCentavos).toBe(-1_500);
  });

  it('separa lo cobrado por método de pago', () => {
    const cifras = cifrasDelDia({
      ventas: [
        venta({ monto_efectivo: 60, monto_tarjeta: 40, monto_transferencia: 0 }),
        venta({ monto_efectivo: 0, monto_tarjeta: 15.5, monto_transferencia: 84.5 }),
      ],
      gastos: [],
      cajaAbierta: CAJA,
    });

    expect(cifras.efectivoCentavos).toBe(6_000);
    expect(cifras.tarjetaCentavos).toBe(5_550);
    expect(cifras.transferenciaCentavos).toBe(8_450);
  });

  it('tolera lo que el puente puede traer: sin listas, filas vacías y campos nulos', () => {
    const sinListas = cifrasDelDia({ ventas: undefined, gastos: null, cajaAbierta: CAJA });
    expect(sinListas.ventasCentavos).toBe(0);
    expect(sinListas.gastosCentavos).toBe(0);

    const raras = cifrasDelDia({
      ventas: [null, undefined, venta({ total: null, costo_total_snapshot: undefined })],
      gastos: [null, gasto({ monto: null })],
      cajaAbierta: CAJA,
    });
    expect(raras.ventasCentavos).toBe(0);
    expect(raras.costoCentavos).toBe(0);
    expect(raras.gastosCentavos).toBe(0);
    // La venta con total nulo SÍ es un ticket: el conteo no depende del importe.
    expect(raras.tickets).toBe(1);
  });
});

describe('los métodos de pago con ventas', () => {
  it('lista sólo los que cobraron algo, en el orden efectivo, tarjeta, transferencia', () => {
    const cifras = cifrasDelDia({
      ventas: [venta({ monto_efectivo: 0, monto_tarjeta: 20, monto_transferencia: 30 })],
      gastos: [],
      cajaAbierta: CAJA,
    });

    expect(metodosConVentas(cifras)).toEqual([
      { clave: 'tarjeta', etiqueta: 'Tarjeta', centavos: 2_000 },
      { clave: 'transferencia', etiqueta: 'Transferencia', centavos: 3_000 },
    ]);
  });

  it('sin ventas no hay ninguno', () => {
    const cifras = cifrasDelDia({ ventas: [], gastos: [], cajaAbierta: CAJA });

    expect(metodosConVentas(cifras)).toEqual([]);
  });
});
