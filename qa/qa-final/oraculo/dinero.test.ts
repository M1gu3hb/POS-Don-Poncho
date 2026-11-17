import { describe, expect, it } from 'vitest';

import { calcularCuenta, cantidadExacta, importeDelRenglon, partesIguales } from './dinero.ts';

/**
 * El oráculo se prueba contra números hechos A MANO y contra cuentas que producción ya cobró (las
 * de prueba del 11 y del 15-11: total e impuesto leídos de la base, sólo lectura). Si el oráculo
 * y el sistema se equivocaran igual, estas cifras escritas a mano lo dirían.
 */

const SIN_IVA = { puntosBase: 0, incluidoEnPrecio: true } as const;
const IVA_16_INCLUIDO = { puntosBase: 1600, incluidoEnPrecio: true } as const;
const IVA_16_SUMADO = { puntosBase: 1600, incluidoEnPrecio: false } as const;
const IVA_8_INCLUIDO = { puntosBase: 800, incluidoEnPrecio: true } as const;
const IVA_8_SUMADO = { puntosBase: 800, incluidoEnPrecio: false } as const;

describe('el importe de un renglón', () => {
  it('multiplica precio por cantidad', () => {
    expect(importeDelRenglon({ precioCentavos: 4500n, cantidad: '3' })).toBe(13500n);
  });

  it('lo que va por peso: un cuarto de kilo de barbacoa a $795 el kilo son $198.75', () => {
    expect(importeDelRenglon({ precioCentavos: 79500n, cantidad: '0.25' })).toBe(19875n);
  });

  it('medio centavo sube: 0.333 kg a $795 son $264.74 (264.735)', () => {
    expect(importeDelRenglon({ precioCentavos: 79500n, cantidad: '0.333' })).toBe(26474n);
  });

  it('las opciones por pieza se cobran en cada pieza', () => {
    expect(
      importeDelRenglon({ precioCentavos: 3000n, cantidad: '2', opcionesCentavos: 1500n }),
    ).toBe(9000n);
  });

  it('las opciones de lo que va por peso se cobran una vez por renglón', () => {
    expect(
      importeDelRenglon({
        precioCentavos: 79500n,
        cantidad: '0.5',
        opcionesCentavos: 2000n,
        opcionesPorPieza: false,
      }),
    ).toBe(41750n);
  });

  it('una opción que resta nunca deja el renglón en negativo', () => {
    expect(
      importeDelRenglon({ precioCentavos: 1000n, cantidad: '1', opcionesCentavos: -2500n }),
    ).toBe(0n);
  });

  it('rechaza una cantidad que no es un número escrito tal cual', () => {
    expect(() => cantidadExacta('1e3')).toThrow();
    expect(() => cantidadExacta('-1')).toThrow();
    expect(() => cantidadExacta('')).toThrow();
  });
});

describe('el IVA', () => {
  it.each([
    // total, impuesto — las cuentas A-3, A-4 y A-6 de producción (16 % incluido).
    [47450n, 6545n],
    [5000n, 690n],
    [121900n, 16814n],
    [3330n, 459n],
  ])('16 %% incluido: de $%s centavos se extraen %s', (total, impuesto) => {
    const cuenta = calcularCuenta({
      renglones: [{ precioCentavos: total, cantidad: '1' }],
      impuesto: IVA_16_INCLUIDO,
    });
    expect(cuenta.totalCentavos).toBe(total);
    expect(cuenta.impuestosCentavos).toBe(impuesto);
  });

  it('16 % sumado: $100 se vuelven $116', () => {
    const cuenta = calcularCuenta({
      renglones: [{ precioCentavos: 10000n, cantidad: '1' }],
      impuesto: IVA_16_SUMADO,
    });
    expect(cuenta.impuestosCentavos).toBe(1600n);
    expect(cuenta.totalCentavos).toBe(11600n);
  });

  it('8 % incluido y sumado', () => {
    const incluido = calcularCuenta({
      renglones: [{ precioCentavos: 10800n, cantidad: '1' }],
      impuesto: IVA_8_INCLUIDO,
    });
    expect([incluido.impuestosCentavos, incluido.totalCentavos]).toEqual([800n, 10800n]);
    const sumado = calcularCuenta({
      renglones: [{ precioCentavos: 9999n, cantidad: '1' }],
      impuesto: IVA_8_SUMADO,
    });
    // 9999 × 8 % = 799.92 → 800
    expect([sumado.impuestosCentavos, sumado.totalCentavos]).toEqual([800n, 10799n]);
  });

  it('sin IVA no hay impuesto y el total es el subtotal', () => {
    const cuenta = calcularCuenta({
      renglones: [{ precioCentavos: 79500n, cantidad: '0.5' }],
      impuesto: SIN_IVA,
    });
    expect([cuenta.impuestosCentavos, cuenta.totalCentavos]).toEqual([0n, 39750n]);
  });
});

describe('los descuentos', () => {
  it('el de renglón y el de cuenta se suman, y el de cuenta va sobre lo que queda', () => {
    const cuenta = calcularCuenta({
      renglones: [
        { precioCentavos: 10000n, cantidad: '1', descuentoCentavos: 2000n },
        { precioCentavos: 5000n, cantidad: '2' },
      ],
      descuentoDeLaCuenta: { tipo: 'porcentaje', puntosBase: 1000 },
      impuesto: SIN_IVA,
    });
    // subtotal 20000; renglón −2000 → 18000; 10 % de 18000 = 1800 → total 16200
    expect(cuenta.subtotalCentavos).toBe(20000n);
    expect(cuenta.descuentoCentavos).toBe(3800n);
    expect(cuenta.totalCentavos).toBe(16200n);
  });

  it('la cortesía regala el renglón entero', () => {
    const cuenta = calcularCuenta({
      renglones: [
        { precioCentavos: 4500n, cantidad: '2', cortesia: true },
        { precioCentavos: 3000n, cantidad: '1' },
      ],
      impuesto: SIN_IVA,
    });
    expect([cuenta.descuentoCentavos, cuenta.totalCentavos]).toEqual([9000n, 3000n]);
  });

  it('un descuento mayor que la cuenta se agota en ella: el total nunca es negativo', () => {
    const cuenta = calcularCuenta({
      renglones: [{ precioCentavos: 5000n, cantidad: '1' }],
      descuentoDeLaCuenta: { tipo: 'monto', centavos: 9000n },
      impuesto: IVA_16_INCLUIDO,
    });
    expect([cuenta.descuentoCentavos, cuenta.totalCentavos, cuenta.impuestosCentavos]).toEqual([
      5000n,
      0n,
      0n,
    ]);
  });
});

describe('la propina', () => {
  it('en porcentaje va sobre el total: 5 % de $1,227.50 son $61.38', () => {
    const cuenta = calcularCuenta({
      renglones: [{ precioCentavos: 122750n, cantidad: '1' }],
      impuesto: IVA_16_INCLUIDO,
      propina: { tipo: 'porcentaje', puntosBase: 500 },
    });
    expect(cuenta.propinaCentavos).toBe(6138n);
    expect(cuenta.totalACobrarCentavos).toBe(128888n);
    // La venta no se infla con la propina.
    expect(cuenta.totalCentavos).toBe(122750n);
  });

  it('en monto es ese monto', () => {
    const cuenta = calcularCuenta({
      renglones: [{ precioCentavos: 10000n, cantidad: '1' }],
      impuesto: SIN_IVA,
      propina: { tipo: 'monto', centavos: 950n },
    });
    expect(cuenta.totalACobrarCentavos).toBe(10950n);
  });
});

describe('los pagos y el cambio', () => {
  const base = {
    renglones: [{ precioCentavos: 30000n, cantidad: '1' }],
    impuesto: SIN_IVA,
    propina: { tipo: 'porcentaje', puntosBase: 1000 },
  } as const;

  it('en efectivo con un billete de más: el cambio es la diferencia', () => {
    const cuenta = calcularCuenta({
      ...base,
      pagos: [{ metodo: 'efectivo', entregadoCentavos: 50000n }],
    });
    expect(cuenta.cobradoPorMetodo.efectivo).toBe(33000n);
    expect(cuenta.cambioCentavos).toBe(17000n);
    expect(cuenta.faltanteCentavos).toBe(0n);
  });

  it('mixto: la tarjeta cubre lo suyo y el efectivo lo que falta', () => {
    const cuenta = calcularCuenta({
      ...base,
      pagos: [
        { metodo: 'tarjeta', entregadoCentavos: 20000n },
        { metodo: 'transferencia', entregadoCentavos: 5000n },
        { metodo: 'efectivo', entregadoCentavos: 10000n },
      ],
    });
    expect(cuenta.cobradoPorMetodo).toEqual({
      tarjeta: 20000n,
      transferencia: 5000n,
      efectivo: 8000n,
    });
    expect(cuenta.cambioCentavos).toBe(2000n);
  });

  it('si no alcanza, dice cuánto falta y no inventa cambio', () => {
    const cuenta = calcularCuenta({
      ...base,
      pagos: [{ metodo: 'efectivo', entregadoCentavos: 30000n }],
    });
    expect([cuenta.cambioCentavos, cuenta.faltanteCentavos]).toEqual([0n, 3000n]);
  });

  it('con tarjeta no se cobra de más', () => {
    expect(() =>
      calcularCuenta({ ...base, pagos: [{ metodo: 'tarjeta', entregadoCentavos: 40000n }] }),
    ).toThrow(/no se cobra de más/u);
  });
});

describe('partes iguales', () => {
  it('reparte sin perder ni inventar un centavo', () => {
    expect(partesIguales(10000n, 3)).toEqual([3334n, 3333n, 3333n]);
    expect(partesIguales(10000n, 3).reduce((a, b) => a + b, 0n)).toBe(10000n);
    expect(partesIguales(1n, 4)).toEqual([1n, 0n, 0n, 0n]);
  });
});
