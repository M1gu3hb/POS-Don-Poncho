import { describe, expect, it } from 'vitest';

import { totalesDelPapel } from './totales-del-papel.ts';

/**
 * DP-14 · ronda 2, bloqueante 1 · EL PAPEL SIEMPRE SUMA.
 *
 * El ticket calculaba TOTAL = suma de los renglones + propina, sobre el subtotal BRUTO: $500 con $50
 * de descuento imprimía TOTAL 500 y se cobraban 450. Ahora: renglones − descuento (+ IVA si no va
 * incluido) = TOTAL sin propina = el total del servidor, y + propina = lo cobrado.
 */

const renglones = (...subtotales: number[]) => subtotales.map((subtotal) => ({ subtotal }));

describe('totalesDelPapel', () => {
  it('$500 con $50 de descuento (IVA incluido): el TOTAL es 450, no 500', () => {
    const t = totalesDelPapel(
      { subtotal: 500, descuentos: 50, impuestos: 62.07, total: 450 },
      renglones(300, 200),
    );
    expect(t).toEqual({ renglones: 500, descuento: 50, iva: 62.07, ivaSeSuma: false, total: 450 });
  });

  it('con el IVA que se suma: renglones − descuento + IVA = TOTAL', () => {
    const t = totalesDelPapel(
      { subtotal: 500, descuentos: 50, impuestos: 72, total: 522 },
      renglones(500),
    );
    expect(t).toMatchObject({
      renglones: 500,
      descuento: 50,
      iva: 72,
      ivaSeSuma: true,
      total: 522,
    });
  });

  it('sin descuento ni IVA: el TOTAL son los renglones', () => {
    expect(totalesDelPapel({ subtotal: 329.9, total: 329.9 }, renglones(329.9))).toMatchObject({
      renglones: 329.9,
      descuento: 0,
      total: 329.9,
    });
  });

  it('si el servidor aún no trae el total (el respaldo de HOTFIX 6A), resta el descuento igual', () => {
    expect(
      totalesDelPapel({ subtotal: 0, descuentos: 50, total: 0 }, renglones(300, 200)),
    ).toMatchObject({ renglones: 500, descuento: 50, total: 450 });
  });

  it('sin renglones leídos, el subtotal de la venta', () => {
    expect(totalesDelPapel({ subtotal: 500, descuentos: 50, total: 450 }, [])).toMatchObject({
      renglones: 500,
      total: 450,
    });
  });

  it('centavos sin ruido de coma flotante', () => {
    const t = totalesDelPapel({ descuentos: 0.3, total: 0.3 }, renglones(0.1, 0.2, 0.3));
    expect(t.renglones).toBe(0.6);
    expect(t.total).toBe(0.3);
  });

  it('nada: ceros', () => {
    expect(totalesDelPapel(null, undefined)).toEqual({
      renglones: 0,
      descuento: 0,
      iva: 0,
      ivaSeSuma: false,
      total: 0,
    });
  });
});
