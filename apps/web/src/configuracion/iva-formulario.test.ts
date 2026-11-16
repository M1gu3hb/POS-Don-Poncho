import { describe, expect, it } from 'vitest';

import {
  IVA_DE_UN_NEGOCIO_NUEVO,
  OPCIONES_DE_IVA,
  entradaDelIva,
  explicacionDelIva,
  ivaConIncluido,
  ivaConTasa,
  ivaIgual,
  ivaLeido,
  tasaConocida,
} from './iva-formulario.ts';

/**
 * DP-21 · Bloque 1 · El formulario «IVA» de la Configuración (lo puro).
 *
 * El campo de antes guardaba un porcentaje libre que nadie leía. Éste ofrece las tres tasas que
 * el servidor sabe cobrar y lee y guarda la MISMA clave con la que se cotiza (`impuesto`).
 */
describe('ivaLeido', () => {
  it('lee lo que sirve el puente', () => {
    expect(ivaLeido({ impuesto: { puntosBase: 0, incluidoEnPrecio: true } })).toEqual({
      puntosBase: 0,
      incluidoEnPrecio: true,
    });
    expect(ivaLeido({ impuesto: { puntosBase: 800, incluidoEnPrecio: false } })).toEqual({
      puntosBase: 800,
      incluidoEnPrecio: false,
    });
  });

  it('sin dato (o con uno que no se entiende), lo de un negocio nuevo: 16 % incluido', () => {
    expect(ivaLeido(undefined)).toEqual(IVA_DE_UN_NEGOCIO_NUEVO);
    expect(ivaLeido({})).toEqual({ puntosBase: 1600, incluidoEnPrecio: true });
    expect(ivaLeido({ impuesto: 'dieciséis' })).toEqual(IVA_DE_UN_NEGOCIO_NUEVO);
    expect(ivaLeido({ impuesto: { puntosBase: '0' } })).toEqual(IVA_DE_UN_NEGOCIO_NUEVO);
  });

  it('no mira `iva_porcentaje`: esa clave se retiró', () => {
    expect(ivaLeido({ iva_porcentaje: 0 } as never)).toEqual(IVA_DE_UN_NEGOCIO_NUEVO);
  });
});

describe('las tres opciones', () => {
  it('son sin IVA, 8 % y 16 %, en ese orden', () => {
    expect(OPCIONES_DE_IVA.map((o) => [o.puntosBase, o.nombre])).toEqual([
      [0, 'Sin IVA'],
      [800, '8 %'],
      [1600, '16 %'],
    ]);
  });

  it('una tasa guardada de antes que no es de las tres se reconoce como desconocida', () => {
    expect(tasaConocida(1600)).toBe(true);
    expect(tasaConocida(0)).toBe(true);
    expect(tasaConocida(1500)).toBe(false);
  });
});

describe('cambiar', () => {
  it('elegir «Sin IVA» deja «incluido»: no hay nada que sumar', () => {
    expect(ivaConTasa({ puntosBase: 1600, incluidoEnPrecio: false }, 0)).toEqual({
      puntosBase: 0,
      incluidoEnPrecio: true,
    });
  });

  it('cambiar de 16 a 8 conserva si va incluido', () => {
    expect(ivaConTasa({ puntosBase: 1600, incluidoEnPrecio: false }, 800)).toEqual({
      puntosBase: 800,
      incluidoEnPrecio: false,
    });
  });

  it('el interruptor «Los precios ya incluyen el IVA» no aplica sin IVA', () => {
    expect(ivaConIncluido({ puntosBase: 1600, incluidoEnPrecio: true }, false)).toEqual({
      puntosBase: 1600,
      incluidoEnPrecio: false,
    });
    expect(ivaConIncluido({ puntosBase: 0, incluidoEnPrecio: true }, false)).toEqual({
      puntosBase: 0,
      incluidoEnPrecio: true,
    });
  });

  it('dos IVA son iguales si cobran lo mismo', () => {
    expect(
      ivaIgual(
        { puntosBase: 800, incluidoEnPrecio: true },
        { puntosBase: 800, incluidoEnPrecio: true },
      ),
    ).toBe(true);
    expect(
      ivaIgual(
        { puntosBase: 800, incluidoEnPrecio: true },
        { puntosBase: 800, incluidoEnPrecio: false },
      ),
    ).toBe(false);
    expect(
      ivaIgual(
        { puntosBase: 0, incluidoEnPrecio: true },
        { puntosBase: 1600, incluidoEnPrecio: true },
      ),
    ).toBe(false);
  });
});

describe('entradaDelIva (lo que viaja al comando)', () => {
  it('sólo la tasa y si va incluido', () => {
    expect(entradaDelIva({ puntosBase: 1600, incluidoEnPrecio: false })).toEqual({
      puntosBase: 1600,
      incluidoEnPrecio: false,
    });
  });

  it('una tasa que no es de las tres no se manda', () => {
    expect(entradaDelIva({ puntosBase: 1500, incluidoEnPrecio: true })).toBeNull();
  });
});

describe('explicacionDelIva', () => {
  it('sin IVA: dice que ningún ticket lo menciona', () => {
    expect(explicacionDelIva({ puntosBase: 0, incluidoEnPrecio: true })).toMatch(
      /no aparece en ningún ticket/i,
    );
  });

  it('incluido: el total no cambia', () => {
    expect(explicacionDelIva({ puntosBase: 1600, incluidoEnPrecio: true })).toMatch(
      /no cambia el total/i,
    );
  });

  it('sumado: se cobra encima, con un ejemplo en pesos', () => {
    expect(explicacionDelIva({ puntosBase: 1600, incluidoEnPrecio: false })).toMatch(/\$116\.00/);
    expect(explicacionDelIva({ puntosBase: 800, incluidoEnPrecio: false })).toMatch(/\$108\.00/);
  });
});
