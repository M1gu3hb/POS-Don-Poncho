import { describe, expect, it } from 'vitest';

import {
  HUELLA_DEL_VACIADO,
  SEGUNDOS_CONECTADO,
  SEGUNDOS_VACIADO_VIGENTE,
  vaciadoQueLeToca,
} from './carrito.ts';

/** DP-13.3 · A quién le toca la noticia de «el mesero vació el pedido». Puro. */

const V = new Date('2026-11-02T20:00:00.000Z');
const despues = (s: number) => new Date(V.getTime() + s * 1000);
const marca = { enviado_en: V, enviado_por_huella: HUELLA_DEL_VACIADO };

describe('vaciadoQueLeToca', () => {
  it('le toca al teléfono que estaba conectado: su último latido es de antes, y reciente', () => {
    expect(vaciadoQueLeToca(marca, despues(-5), despues(2))).toEqual({ en: V.toISOString() });
    expect(vaciadoQueLeToca(marca, despues(-SEGUNDOS_CONECTADO), despues(2))).toEqual({
      en: V.toISOString(),
    });
  });

  it('una vez: con el latido ya posterior al vaciado, no vuelve a tocarle', () => {
    expect(vaciadoQueLeToca(marca, despues(2), despues(5))).toBeNull();
    expect(vaciadoQueLeToca(marca, V, despues(5))).toBeNull();
  });

  it('no le toca al que nunca había latido ni al que llevaba más de un minuto sin hacerlo', () => {
    expect(vaciadoQueLeToca(marca, null, despues(2))).toBeNull();
    expect(vaciadoQueLeToca(marca, despues(-SEGUNDOS_CONECTADO - 1), despues(2))).toBeNull();
  });

  it('vence: pasado su plazo ya no se dice', () => {
    expect(vaciadoQueLeToca(marca, despues(-5), despues(SEGUNDOS_VACIADO_VIGENTE))).not.toBeNull();
    expect(vaciadoQueLeToca(marca, despues(-5), despues(SEGUNDOS_VACIADO_VIGENTE + 1))).toBeNull();
  });

  it('un envío de verdad (o ninguna marca) no es un vaciado', () => {
    const envio = { enviado_en: V, enviado_por_huella: 'a'.repeat(64) };
    expect(vaciadoQueLeToca(envio, despues(-5), despues(2))).toBeNull();
    expect(
      vaciadoQueLeToca({ enviado_en: null, enviado_por_huella: null }, despues(-5), V),
    ).toBeNull();
    expect(vaciadoQueLeToca(undefined, despues(-5), V)).toBeNull();
  });
});
