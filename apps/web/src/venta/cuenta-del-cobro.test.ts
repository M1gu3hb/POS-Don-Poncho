import { describe, expect, it } from 'vitest';

import {
  cuentaDelCobro,
  propinaBase,
  type PagosTecleados,
  type PropinaDelCobro,
} from './cuenta-del-cobro.ts';

/**
 * DP-24 · LA TARJETA DE COBRO NUEVA: la cuenta que hace antes de mandar nada al servidor.
 *
 * Cada caso de dinero del encargo, en centavos: propina por porcentaje y por monto, el efectivo
 * recibido (exacto, de más y DE MENOS), el cambio que se deja de propina, varias tarjetas con y sin
 * efectivo, y que lo que viaja a `venta.cobrar` siempre suma la venta por un lado y la propina por otro.
 */
const EN_EFECTIVO: PagosTecleados = {
  modo: 'efectivo',
  recibidoCentavos: null,
  tarjetasCentavos: [],
  transferenciaCentavos: 0,
  cambioComoPropina: false,
};
const SIN_PROPINA: PropinaDelCobro = { tipo: 'sin_propina' };
const DIEZ: PropinaDelCobro = { tipo: 'porcentaje', puntosBase: 1000 };

function sumar(valores: readonly number[]): number {
  return valores.reduce((suma, v) => suma + v, 0);
}

describe('propinaBase', () => {
  it('el porcentaje se redondea una vez, con el medio centavo hacia arriba, como el servidor', () => {
    // $28,771.50 al 15 % son 4,315.725: $4,315.73 (DP-22, hallazgo 9).
    expect(propinaBase(2_877_150, { tipo: 'porcentaje', puntosBase: 1500 })).toBe(431_573);
    expect(propinaBase(52_000, DIEZ)).toBe(5_200);
  });

  it('un monto a mano es ese monto; sin propina y sin elegir son cero', () => {
    expect(propinaBase(52_000, { tipo: 'monto', centavos: 3_700 })).toBe(3_700);
    expect(propinaBase(52_000, SIN_PROPINA)).toBe(0);
    expect(propinaBase(52_000, { tipo: 'sin_elegir' })).toBe(0);
  });

  it('un monto negativo o roto no es una propina', () => {
    expect(propinaBase(52_000, { tipo: 'monto', centavos: -500 })).toBe(0);
    expect(propinaBase(52_000, { tipo: 'monto', centavos: Number.NaN })).toBe(0);
  });
});

describe('efectivo', () => {
  it('sin teclear «Recibido» es el importe exacto: un pago en efectivo, sin cambio', () => {
    const cuenta = cuentaDelCobro(46_000, DIEZ, EN_EFECTIVO);
    expect(cuenta.tropiezo).toBeNull();
    expect(cuenta.aCobrarCentavos).toBe(50_600);
    expect(cuenta.cambioCentavos).toBe(0);
    expect(cuenta.pagos).toEqual([
      { metodo: 'efectivo', montoCentavos: 46_000, propinaCentavos: 4_600 },
    ]);
  });

  it('con billete de más: el cambio sale del recibido y el recibido viaja al servidor', () => {
    const cuenta = cuentaDelCobro(46_000, DIEZ, { ...EN_EFECTIVO, recibidoCentavos: 60_000 });
    expect(cuenta.tropiezo).toBeNull();
    expect(cuenta.cambioCentavos).toBe(9_400);
    expect(cuenta.cambioOfrecidoCentavos).toBe(9_400);
    expect(cuenta.pagos).toEqual([
      {
        metodo: 'efectivo',
        montoCentavos: 46_000,
        propinaCentavos: 4_600,
        recibidoCentavos: 60_000,
      },
    ]);
  });

  it('RECIBIDO MENOR AL TOTAL: no se cobra como exacto ni con cambio cero; se dice cuánto falta', () => {
    const cuenta = cuentaDelCobro(46_000, DIEZ, { ...EN_EFECTIVO, recibidoCentavos: 50_000 });
    expect(cuenta.tropiezo).toBe('Faltan $6.00 en efectivo.');
    expect(cuenta.faltaCentavos).toBe(600);
    expect(cuenta.pagos).toEqual([]);
    expect(cuenta.cambioCentavos).toBe(0);
  });

  it('recibido en cero tecleado también es «menor»: no es lo mismo que no teclear', () => {
    const cuenta = cuentaDelCobro(46_000, SIN_PROPINA, { ...EN_EFECTIVO, recibidoCentavos: 0 });
    expect(cuenta.tropiezo).toBe('Faltan $460.00 en efectivo.');
    expect(cuenta.pagos).toEqual([]);
  });

  it('EL CAMBIO COMO PROPINA: el cambio pasa a la propina y queda en cero', () => {
    const cuenta = cuentaDelCobro(46_000, DIEZ, {
      ...EN_EFECTIVO,
      recibidoCentavos: 60_000,
      cambioComoPropina: true,
    });
    expect(cuenta.tropiezo).toBeNull();
    expect(cuenta.propinaCentavos).toBe(14_000);
    expect(cuenta.aCobrarCentavos).toBe(60_000);
    expect(cuenta.cambioCentavos).toBe(0);
    // Lo ofrecido sigue diciendo cuánto era, para poder arrepentirse.
    expect(cuenta.cambioOfrecidoCentavos).toBe(9_400);
    expect(cuenta.pagos).toEqual([
      {
        metodo: 'efectivo',
        montoCentavos: 46_000,
        propinaCentavos: 14_000,
        recibidoCentavos: 60_000,
      },
    ]);
    // Ya no es el 10 %: es un monto, y así queda escrito cómo se decidió.
    expect(cuenta.propinaAEnviar).toEqual({ tipo: 'monto_manual', puntosBase: 3043 });
  });

  it('sin cambio que dejar, «dejar el cambio» no inventa propina', () => {
    const cuenta = cuentaDelCobro(46_000, DIEZ, { ...EN_EFECTIVO, cambioComoPropina: true });
    expect(cuenta.propinaCentavos).toBe(4_600);
    expect(cuenta.propinaAEnviar).toEqual({ tipo: 'porcentaje', puntosBase: 1000 });
  });
});

describe('tarjeta y transferencia', () => {
  it('una tarjeta lleva la cuenta y su propina', () => {
    const cuenta = cuentaDelCobro(46_000, DIEZ, { ...EN_EFECTIVO, modo: 'tarjeta' });
    expect(cuenta.tropiezo).toBeNull();
    expect(cuenta.pagos).toEqual([
      { metodo: 'tarjeta', montoCentavos: 46_000, propinaCentavos: 4_600 },
    ]);
    expect(cuenta.efectivoCentavos).toBe(0);
  });

  it('lo tecleado en «Recibido» no cuenta si se paga con tarjeta', () => {
    const cuenta = cuentaDelCobro(46_000, SIN_PROPINA, {
      ...EN_EFECTIVO,
      modo: 'tarjeta',
      recibidoCentavos: 10_000,
      cambioComoPropina: true,
    });
    expect(cuenta.tropiezo).toBeNull();
    expect(cuenta.cambioCentavos).toBe(0);
    expect(cuenta.propinaCentavos).toBe(0);
    expect(cuenta.pagos).toEqual([{ metodo: 'tarjeta', montoCentavos: 46_000 }]);
  });

  it('DIVIDIDA EN TARJETAS: cada una con su monto; la propina va en la última', () => {
    const cuenta = cuentaDelCobro(100_000, DIEZ, {
      ...EN_EFECTIVO,
      modo: 'tarjeta',
      tarjetasCentavos: [50_000, 30_000, 30_000],
    });
    expect(cuenta.tropiezo).toBeNull();
    expect(cuenta.pagos).toEqual([
      { metodo: 'tarjeta', montoCentavos: 50_000 },
      { metodo: 'tarjeta', montoCentavos: 30_000 },
      { metodo: 'tarjeta', montoCentavos: 20_000, propinaCentavos: 10_000 },
    ]);
  });

  it('dividida que NO cuadra: no deja cobrar y dice cuánto falta o sobra', () => {
    const falta = cuentaDelCobro(100_000, DIEZ, {
      ...EN_EFECTIVO,
      modo: 'tarjeta',
      tarjetasCentavos: [50_000, 30_000],
    });
    expect(falta.tropiezo).toBe('Faltan $300.00 por repartir entre las tarjetas.');
    expect(falta.faltaCentavos).toBe(30_000);
    expect(falta.pagos).toEqual([]);

    const sobra = cuentaDelCobro(100_000, DIEZ, {
      ...EN_EFECTIVO,
      modo: 'tarjeta',
      tarjetasCentavos: [80_000, 40_000],
    });
    expect(sobra.tropiezo).toBe('Las tarjetas suman $100.00 de más.');
    expect(sobra.faltaCentavos).toBe(-10_000);
    expect(sobra.pagos).toEqual([]);
  });

  it('una tarjeta sin importe no es un pago: se ignora', () => {
    const cuenta = cuentaDelCobro(100_000, SIN_PROPINA, {
      ...EN_EFECTIVO,
      modo: 'tarjeta',
      tarjetasCentavos: [100_000, 0],
    });
    expect(cuenta.tropiezo).toBeNull();
    expect(cuenta.pagos).toEqual([{ metodo: 'tarjeta', montoCentavos: 100_000 }]);
  });

  it('transferencia: un solo pago con todo', () => {
    const cuenta = cuentaDelCobro(46_000, DIEZ, { ...EN_EFECTIVO, modo: 'transferencia' });
    expect(cuenta.pagos).toEqual([
      { metodo: 'transferencia', montoCentavos: 46_000, propinaCentavos: 4_600 },
    ]);
  });
});

describe('mixto', () => {
  it('TRES TARJETAS MÁS EFECTIVO: el resto es efectivo y la propina sale primero de él', () => {
    const cuenta = cuentaDelCobro(100_000, DIEZ, {
      ...EN_EFECTIVO,
      modo: 'mixto',
      tarjetasCentavos: [40_000, 30_000, 20_000],
    });
    expect(cuenta.tropiezo).toBeNull();
    expect(cuenta.efectivoCentavos).toBe(20_000);
    expect(cuenta.tarjetaCentavos).toBe(90_000);
    expect(cuenta.pagos).toEqual([
      { metodo: 'efectivo', montoCentavos: 10_000, propinaCentavos: 10_000 },
      { metodo: 'tarjeta', montoCentavos: 40_000 },
      { metodo: 'tarjeta', montoCentavos: 30_000 },
      { metodo: 'tarjeta', montoCentavos: 20_000 },
    ]);
  });

  it('la propina que no cabe en el efectivo sigue en la última tarjeta', () => {
    const cuenta = cuentaDelCobro(
      100_000,
      { tipo: 'porcentaje', puntosBase: 2000 },
      { ...EN_EFECTIVO, modo: 'mixto', tarjetasCentavos: [60_000, 50_000] },
    );
    expect(cuenta.pagos).toEqual([
      // Sin venta: la propina en billete de una cuenta pagada con tarjeta.
      { metodo: 'efectivo', montoCentavos: 0, propinaCentavos: 10_000 },
      { metodo: 'tarjeta', montoCentavos: 60_000 },
      { metodo: 'tarjeta', montoCentavos: 40_000, propinaCentavos: 10_000 },
    ]);
  });

  it('quien cobra dice CON QUÉ se pagó la propina: sale de ese método y no del efectivo', () => {
    const cuenta = cuentaDelCobro(100_000, DIEZ, {
      ...EN_EFECTIVO,
      modo: 'mixto',
      tarjetasCentavos: [40_000, 30_000],
      propinaCon: 'tarjeta',
    });
    expect(cuenta.pagos).toEqual([
      { metodo: 'efectivo', montoCentavos: 40_000 },
      { metodo: 'tarjeta', montoCentavos: 40_000 },
      { metodo: 'tarjeta', montoCentavos: 20_000, propinaCentavos: 10_000 },
    ]);
  });

  it('si la propina no cabe en el método elegido, lo que falta sigue por los demás', () => {
    const cuenta = cuentaDelCobro(
      100_000,
      { tipo: 'porcentaje', puntosBase: 2000 },
      { ...EN_EFECTIVO, modo: 'mixto', transferenciaCentavos: 5_000, propinaCon: 'transferencia' },
    );
    expect(cuenta.pagos).toEqual([
      { metodo: 'efectivo', montoCentavos: 100_000, propinaCentavos: 15_000 },
      { metodo: 'transferencia', montoCentavos: 0, propinaCentavos: 5_000 },
    ]);
  });

  it('con transferencia y efectivo recibido de más: cambio sólo del efectivo', () => {
    const cuenta = cuentaDelCobro(100_000, SIN_PROPINA, {
      ...EN_EFECTIVO,
      modo: 'mixto',
      tarjetasCentavos: [30_000],
      transferenciaCentavos: 50_000,
      recibidoCentavos: 50_000,
    });
    expect(cuenta.efectivoCentavos).toBe(20_000);
    expect(cuenta.cambioCentavos).toBe(30_000);
    expect(cuenta.pagos).toEqual([
      { metodo: 'efectivo', montoCentavos: 20_000, recibidoCentavos: 50_000 },
      { metodo: 'tarjeta', montoCentavos: 30_000 },
      { metodo: 'transferencia', montoCentavos: 50_000 },
    ]);
  });

  it('el efectivo recibido no alcanza para el resto: no se cobra', () => {
    const cuenta = cuentaDelCobro(100_000, SIN_PROPINA, {
      ...EN_EFECTIVO,
      modo: 'mixto',
      tarjetasCentavos: [30_000],
      recibidoCentavos: 50_000,
    });
    expect(cuenta.tropiezo).toBe('Faltan $200.00 en efectivo.');
    expect(cuenta.pagos).toEqual([]);
  });

  it('tarjetas y transferencia de más: no deja cobrar', () => {
    const cuenta = cuentaDelCobro(100_000, SIN_PROPINA, {
      ...EN_EFECTIVO,
      modo: 'mixto',
      tarjetasCentavos: [80_000],
      transferenciaCentavos: 30_000,
    });
    expect(cuenta.tropiezo).toBe('Las tarjetas y la transferencia suman $100.00 de más.');
    expect(cuenta.pagos).toEqual([]);
  });

  it('el cambio como propina también en mixto: se suma al efectivo', () => {
    const cuenta = cuentaDelCobro(100_000, SIN_PROPINA, {
      modo: 'mixto',
      tarjetasCentavos: [70_000],
      transferenciaCentavos: 0,
      recibidoCentavos: 50_000,
      cambioComoPropina: true,
    });
    expect(cuenta.propinaCentavos).toBe(20_000);
    expect(cuenta.cambioCentavos).toBe(0);
    expect(cuenta.pagos).toEqual([
      {
        metodo: 'efectivo',
        montoCentavos: 30_000,
        propinaCentavos: 20_000,
        recibidoCentavos: 50_000,
      },
      { metodo: 'tarjeta', montoCentavos: 70_000 },
    ]);
  });
});

describe('lo que se escribe de cómo se decidió la propina', () => {
  it('sin elegir y «sin propina» viajan como sin propina', () => {
    expect(cuentaDelCobro(46_000, { tipo: 'sin_elegir' }, EN_EFECTIVO).propinaAEnviar).toEqual({
      tipo: 'sin_propina',
      puntosBase: 0,
    });
    expect(cuentaDelCobro(46_000, SIN_PROPINA, EN_EFECTIVO).propinaAEnviar).toEqual({
      tipo: 'sin_propina',
      puntosBase: 0,
    });
  });

  it('un monto viaja como monto, con sus puntos base (tope 100 %)', () => {
    const monto = cuentaDelCobro(52_000, { tipo: 'monto', centavos: 3_700 }, EN_EFECTIVO);
    expect(monto.propinaAEnviar).toEqual({ tipo: 'monto_manual', puntosBase: 712 });
    expect(monto.pagos[0]?.propinaCentavos).toBe(3_700);
    const enorme = cuentaDelCobro(2_000, { tipo: 'monto', centavos: 5_000 }, EN_EFECTIVO);
    expect(enorme.propinaAEnviar).toEqual({ tipo: 'monto_manual', puntosBase: 10_000 });
    expect(enorme.pagos[0]?.propinaCentavos).toBe(5_000);
  });
});

describe('la cuenta en cero', () => {
  it('no se cobra', () => {
    const cuenta = cuentaDelCobro(0, SIN_PROPINA, EN_EFECTIVO);
    expect(cuenta.tropiezo).toBe('Esta cuenta está en $0.00: no se puede cobrar.');
    expect(cuenta.pagos).toEqual([]);
  });
});

describe('lo que viaja siempre cuadra', () => {
  it('la venta suma el total y la propina suma la propina, en cualquier combinación que se deje cobrar', () => {
    const totales = [1, 99, 12_345, 46_000, 100_000, 2_877_150];
    const propinas: PropinaDelCobro[] = [
      { tipo: 'sin_elegir' },
      SIN_PROPINA,
      DIEZ,
      { tipo: 'porcentaje', puntosBase: 1500 },
      { tipo: 'monto', centavos: 3_333 },
    ];
    let revisadas = 0;
    for (const total of totales) {
      for (const propina of propinas) {
        const aCobrar = total + propinaBase(total, propina);
        const tercio = Math.floor(aCobrar / 3);
        const formas: PagosTecleados[] = [
          EN_EFECTIVO,
          { ...EN_EFECTIVO, recibidoCentavos: aCobrar + 5_000 },
          { ...EN_EFECTIVO, recibidoCentavos: aCobrar + 5_000, cambioComoPropina: true },
          { ...EN_EFECTIVO, modo: 'tarjeta' },
          { ...EN_EFECTIVO, modo: 'tarjeta', tarjetasCentavos: [tercio, aCobrar - tercio] },
          { ...EN_EFECTIVO, modo: 'transferencia' },
          { ...EN_EFECTIVO, modo: 'mixto', tarjetasCentavos: [tercio, tercio] },
          {
            ...EN_EFECTIVO,
            modo: 'mixto',
            tarjetasCentavos: [tercio],
            transferenciaCentavos: tercio,
            recibidoCentavos: aCobrar,
            cambioComoPropina: true,
          },
        ];
        for (const forma of formas) {
          const cuenta = cuentaDelCobro(total, propina, forma);
          expect(cuenta.tropiezo, JSON.stringify({ total, propina, forma })).toBeNull();
          expect(sumar(cuenta.pagos.map((p) => p.montoCentavos))).toBe(total);
          expect(sumar(cuenta.pagos.map((p) => p.propinaCentavos ?? 0))).toBe(
            cuenta.propinaCentavos,
          );
          expect(cuenta.aCobrarCentavos).toBe(total + cuenta.propinaCentavos);
          for (const pago of cuenta.pagos) {
            expect(pago.montoCentavos).toBeGreaterThanOrEqual(0);
            expect(pago.montoCentavos + (pago.propinaCentavos ?? 0)).toBeGreaterThan(0);
            if (pago.recibidoCentavos !== undefined) {
              expect(pago.metodo).toBe('efectivo');
              expect(pago.recibidoCentavos).toBeGreaterThanOrEqual(
                pago.montoCentavos + (pago.propinaCentavos ?? 0),
              );
            }
          }
          revisadas += 1;
        }
      }
    }
    expect(revisadas).toBe(totales.length * propinas.length * 8);
  });
});
