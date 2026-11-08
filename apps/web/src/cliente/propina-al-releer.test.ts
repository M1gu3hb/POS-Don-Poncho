import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { propinaAlReleer } from '../../heredado/utils/tipsUtils.js';

/**
 * DP-14 · ronda 2 · QA2-A3 · LA PROPINA ELEGIDA EN LA CAJA SOBREVIVE AL DESCUENTO.
 *
 * El cajero eligió la propina al abrir el cobro; aplicó un descuento con PIN; la cuenta se relee del
 * servidor (que no guarda la propina hasta cobrar) y el cobro volvía a decir «Cliente no eligió
 * propina en QR — toca para definirla», y «Cobrar» no cobraba hasta elegirla otra vez. Ahora la
 * elegida se conserva: el porcentaje sobre el total NUEVO, el monto tal cual.
 */

const RELEIDA = { id: 'v1', total: 291.6, propina_tipo: 'pendiente_cliente', propina_monto: 0 };

describe('propinaAlReleer', () => {
  it('el 10 % elegido en la caja se recalcula sobre el total con descuento', () => {
    const antes = {
      id: 'v1',
      total: 324,
      propina_tipo: 'porcentaje',
      propina_porcentaje: 10,
      propina_monto: 32.4,
      propina_origen: 'caja',
    };
    expect(propinaAlReleer(antes, RELEIDA)).toEqual({
      propina_monto: 29.16,
      propina_porcentaje: 10,
      propina_tipo: 'porcentaje',
      propina_origen: 'caja',
    });
  });

  it('un monto elegido a mano se queda igual; «sin propina» también', () => {
    const aMano = {
      id: 'v1',
      propina_tipo: 'monto_manual',
      propina_porcentaje: 0,
      propina_monto: 50,
      propina_origen: 'caja',
    };
    expect(propinaAlReleer(aMano, RELEIDA)).toMatchObject({
      propina_monto: 50,
      propina_tipo: 'monto_manual',
    });
    const sinPropina = { ...aMano, propina_tipo: 'sin_propina', propina_monto: 0 };
    expect(propinaAlReleer(sinPropina, RELEIDA)).toMatchObject({
      propina_monto: 0,
      propina_tipo: 'sin_propina',
    });
  });

  it('sin elegirla en la caja (u otra cuenta), manda lo que diga la cuenta releída', () => {
    expect(propinaAlReleer(null, RELEIDA)).toEqual({ propina_monto: 0 });
    expect(
      propinaAlReleer(
        { id: 'otra', propina_origen: 'caja', propina_tipo: 'porcentaje', propina_porcentaje: 10 },
        RELEIDA,
      ),
    ).toEqual({ propina_monto: 0 });
  });
});

describe('el cobro de la Caja', () => {
  it('al releer la cuenta conserva la propina elegida', () => {
    const caja = readFileSync(join(__dirname, '..', '..', 'heredado', 'pages', 'Caja.jsx'), 'utf8');
    expect(caja).toMatch(
      /const releerLaCuentaDelCobro = async \(ordenId\) => \{[\s\S]{0,400}setVentaSeleccionada\(\(previa\) => \(\{ \.\.\.venta, \.\.\.propinaAlReleer\(previa, venta\) \}\)\);/,
    );
  });
});
