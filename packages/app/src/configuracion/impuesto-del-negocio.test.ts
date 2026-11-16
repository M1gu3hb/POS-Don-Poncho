import { describe, expect, it } from 'vitest';

import {
  IMPUESTO_DE_UN_NEGOCIO_NUEVO,
  esquemaDelImpuesto,
  impuestoEn,
  reglaDeImpuestoEn,
} from './impuesto-del-negocio.ts';

/**
 * DP-21 · Bloque 1 · EL IVA DEL NEGOCIO: una sola lectura de `configuracion.valores.impuesto`.
 *
 * La pantalla guardaba `iva_porcentaje` y el servidor leía `impuesto.puntosBase`: dos nombres
 * para lo mismo, y el que mandaba no tenía pantalla. Ahora hay un lector (éste) y lo usan la
 * cotización, el puente que sirve a las pantallas y el comando que lo guarda.
 */
describe('impuestoEn', () => {
  it('sin nada guardado, el de un negocio nuevo: 16 % incluido en el precio', () => {
    expect(impuestoEn({})).toEqual({ puntosBase: 1600, incluidoEnPrecio: true });
    expect(impuestoEn(null)).toEqual(IMPUESTO_DE_UN_NEGOCIO_NUEVO);
    expect(impuestoEn(undefined)).toEqual(IMPUESTO_DE_UN_NEGOCIO_NUEVO);
    expect(impuestoEn([])).toEqual(IMPUESTO_DE_UN_NEGOCIO_NUEVO);
  });

  it('«Sin IVA» guardado se respeta: 0 no es «no hay dato»', () => {
    expect(impuestoEn({ impuesto: { puntosBase: 0, incluidoEnPrecio: true } })).toEqual({
      puntosBase: 0,
      incluidoEnPrecio: true,
    });
  });

  it('8 % que se suma al precio', () => {
    expect(impuestoEn({ impuesto: { puntosBase: 800, incluidoEnPrecio: false } })).toEqual({
      puntosBase: 800,
      incluidoEnPrecio: false,
    });
  });

  it('lo que falta de un impuesto a medias se completa con lo de un negocio nuevo', () => {
    expect(impuestoEn({ impuesto: { puntosBase: 800 } })).toEqual({
      puntosBase: 800,
      incluidoEnPrecio: true,
    });
    expect(impuestoEn({ impuesto: { incluidoEnPrecio: false } })).toEqual({
      puntosBase: 1600,
      incluidoEnPrecio: false,
    });
  });

  it('un impuesto dañado no tumba la venta: se cobra con el de un negocio nuevo', () => {
    expect(impuestoEn({ impuesto: { puntosBase: 'dieciséis' } })).toEqual(
      IMPUESTO_DE_UN_NEGOCIO_NUEVO,
    );
    expect(impuestoEn({ impuesto: { puntosBase: -1 } })).toEqual(IMPUESTO_DE_UN_NEGOCIO_NUEVO);
    expect(impuestoEn({ impuesto: { puntosBase: 16.5 } })).toEqual(IMPUESTO_DE_UN_NEGOCIO_NUEVO);
  });

  it('`iva_porcentaje` ya no se lee: aunque esté guardado, no cambia nada', () => {
    expect(impuestoEn({ iva_porcentaje: 0 })).toEqual(IMPUESTO_DE_UN_NEGOCIO_NUEVO);
    expect(impuestoEn({ iva_porcentaje: 8, impuesto: { puntosBase: 0 } }).puntosBase).toBe(0);
  });
});

describe('reglaDeImpuestoEn', () => {
  it('entrega la regla con los nombres del dominio', () => {
    expect(reglaDeImpuestoEn({ impuesto: { puntosBase: 0, incluidoEnPrecio: true } })).toEqual({
      tasaPuntosBase: 0,
      incluidoEnPrecio: true,
    });
    expect(reglaDeImpuestoEn({})).toEqual({ tasaPuntosBase: 1600, incluidoEnPrecio: true });
  });
});

describe('esquemaDelImpuesto (lo que se puede GUARDAR)', () => {
  it('sólo las tres tasas del dominio: sin IVA, 8 % y 16 %', () => {
    for (const puntosBase of [0, 800, 1600]) {
      expect(esquemaDelImpuesto.safeParse({ puntosBase, incluidoEnPrecio: true }).success).toBe(
        true,
      );
    }
    for (const puntosBase of [1, 16, 1500, 1601, 3500, -800, 8.5]) {
      expect(esquemaDelImpuesto.safeParse({ puntosBase, incluidoEnPrecio: true }).success).toBe(
        false,
      );
    }
  });

  it('exige decir si va incluido, y no acepta campos de más', () => {
    expect(esquemaDelImpuesto.safeParse({ puntosBase: 1600 }).success).toBe(false);
    expect(
      esquemaDelImpuesto.safeParse({ puntosBase: 1600, incluidoEnPrecio: true, total: 1 }).success,
    ).toBe(false);
  });
});
