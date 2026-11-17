import { describe, expect, it } from 'vitest';

import {
  armarLoMasVendido,
  type DevueltoDelPlatillo,
  type VendidoDelPlatillo,
} from './lo-mas-vendido-armado.ts';

/**
 * DP-22 · «Lo más vendido»: el armado puro. Une lo vendido con lo devuelto de cada platillo, lo
 * ordena por lo que dejó (neto) y deja el total de lo vendido, que es el que cuadra con el resumen.
 */

const taco = (extra: Partial<VendidoDelPlatillo> = {}): VendidoDelPlatillo => ({
  clave: 'p-taco',
  nombre: 'Taco',
  categoria: 'Lo fuerte',
  lineas: 3,
  cantidad: '7',
  unidad: 'pza',
  importeCentavos: 24_500n,
  ...extra,
});

const kilo = (extra: Partial<VendidoDelPlatillo> = {}): VendidoDelPlatillo => ({
  clave: 'p-barbacoa',
  nombre: 'Barbacoa por kilo',
  categoria: 'Del carbón',
  lineas: 2,
  cantidad: '1.75',
  unidad: 'kg',
  importeCentavos: 139_125n,
  ...extra,
});

const devuelto = (extra: Partial<DevueltoDelPlatillo> = {}): DevueltoDelPlatillo => ({
  clave: 'p-taco',
  nombre: 'Taco',
  categoria: 'Lo fuerte',
  unidad: 'pza',
  cantidad: '2',
  montoCentavos: 7_000n,
  ...extra,
});

describe('armarLoMasVendido', () => {
  it('ordena por lo que dejó el platillo, de más a menos, y el kilo cuenta en kilos', () => {
    const salida = armarLoMasVendido([taco(), kilo()], []);
    expect(salida.platillos.map((p) => p.nombre)).toEqual(['Barbacoa por kilo', 'Taco']);
    expect(salida.platillos[0]).toMatchObject({ cantidad: '1.75', unidad: 'kg' });
  });

  it('la devolución resta: la cantidad, el importe y el neto del mismo platillo', () => {
    const salida = armarLoMasVendido([taco()], [devuelto()]);
    expect(salida.platillos).toHaveLength(1);
    expect(salida.platillos[0]).toMatchObject({
      cantidad: '7',
      importeCentavos: '24500',
      devueltoCantidad: '2',
      devueltoCentavos: '7000',
      netoCentavos: '17500',
      cantidadNeta: '5',
    });
  });

  it('el total de lo vendido NO descuenta lo devuelto (es el del resumen del periodo)', () => {
    const salida = armarLoMasVendido([taco(), kilo()], [devuelto()]);
    expect(salida.vendidoCentavos).toBe('163625');
    expect(salida.devueltoCentavos).toBe('7000');
    expect(salida.netoCentavos).toBe('156625');
  });

  it('un platillo que sólo se devolvió en el periodo (se vendió antes) sale con venta cero y neto negativo', () => {
    const salida = armarLoMasVendido([kilo()], [devuelto({ clave: 'p-flan', nombre: 'Flan' })]);
    const flan = salida.platillos.find((p) => p.nombre === 'Flan');
    expect(flan).toMatchObject({ cantidad: '0', importeCentavos: '0', netoCentavos: '-7000' });
    expect(salida.platillos.at(-1)?.nombre).toBe('Flan');
  });

  it('suma los decimales sin error de coma flotante (0.1 + 0.2 kg)', () => {
    const salida = armarLoMasVendido(
      [kilo({ cantidad: '0.3' })],
      [
        devuelto({
          clave: 'p-barbacoa',
          nombre: 'Barbacoa por kilo',
          unidad: 'kg',
          cantidad: '0.1',
          montoCentavos: 100n,
        }),
      ],
    );
    expect(salida.platillos[0]?.cantidadNeta).toBe('0.2');
  });

  it('con empate en el neto, el orden es el del nombre (siempre el mismo)', () => {
    const a = taco({ clave: 'a', nombre: 'Birria', importeCentavos: 1_000n });
    const b = taco({ clave: 'b', nombre: 'Agua', importeCentavos: 1_000n });
    expect(armarLoMasVendido([a, b], []).platillos.map((p) => p.nombre)).toEqual([
      'Agua',
      'Birria',
    ]);
  });

  it('sin nada, todo en cero y sin platillos', () => {
    expect(armarLoMasVendido([], [])).toEqual({
      platillos: [],
      vendidoCentavos: '0',
      devueltoCentavos: '0',
      netoCentavos: '0',
    });
  });
});
