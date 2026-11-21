import { describe, expect, it } from 'vitest';

import {
  nuncaPideElPin,
  pideElPinSiempre,
  puedeAjustarLaCuenta,
  puedeCancelarPedidos,
} from './ajustes-de-la-cuenta-por-rol.ts';

/**
 * Día completo del restaurante (2.4) · QUIÉN VE «ANULAR» Y «DIVIDIR».
 *
 * La mesa activa los ofrecía al mesero, a quien el servidor se los niega: cada toque
 * terminaba en «Tu rol no puede hacer eso». La autorización sigue siendo del servidor; esto es
 * lo que se enseña.
 */
describe('quién ve los botones que quitan o reparten un importe', () => {
  it('la caja y la dirección sí: son los roles que el servidor deja', () => {
    expect(puedeAjustarLaCuenta('caja')).toBe(true);
    expect(puedeAjustarLaCuenta('administrador')).toBe(true);
  });

  it('el mesero NO: él comanda y pide la cuenta, no hace desaparecer dinero', () => {
    expect(puedeAjustarLaCuenta('mesero')).toBe(false);
  });

  it('cocina y almacén tampoco, y nadie sin identificar: falla cerrado', () => {
    expect(puedeAjustarLaCuenta('cocina')).toBe(false);
    expect(puedeAjustarLaCuenta('almacen')).toBe(false);
    expect(puedeAjustarLaCuenta(null)).toBe(false);
    expect(puedeAjustarLaCuenta('')).toBe(false);
  });
});

// DP-24 · Quitar lo ya enviado y cancelar la cuenta son de la caja y la gerencia; el mesero ya no.
describe('quién ve «Quitar un platillo» y «Cancelar la cuenta»', () => {
  it('la caja y la dirección: los roles que el servidor deja', () => {
    expect(puedeCancelarPedidos('caja')).toBe(true);
    expect(puedeCancelarPedidos('administrador')).toBe(true);
  });

  it('el mesero NO los ve: el servidor se los niega (sólo quita su carrito, sin comando)', () => {
    expect(puedeCancelarPedidos('mesero')).toBe(false);
  });

  it('la caja pide el PIN de entrada; la gerencia nunca; nadie más lo pide por rol', () => {
    expect(pideElPinSiempre('caja')).toBe(true);
    expect(pideElPinSiempre('administrador')).toBe(false);
    expect(nuncaPideElPin('administrador')).toBe(true);
    expect(nuncaPideElPin('caja')).toBe(false);
    expect(pideElPinSiempre('mesero')).toBe(false);
    expect(pideElPinSiempre(null)).toBe(false);
    expect(nuncaPideElPin(null)).toBe(false);
  });

  it('cocina, almacén y quien no se sabe quién es, no: falla cerrado', () => {
    expect(puedeCancelarPedidos('cocina')).toBe(false);
    expect(puedeCancelarPedidos('almacen')).toBe(false);
    expect(puedeCancelarPedidos(null)).toBe(false);
    expect(puedeCancelarPedidos('')).toBe(false);
  });

  it('repartir la cuenta sigue siendo de caja y de dirección: el mesero ni cancela ni divide', () => {
    expect(puedeAjustarLaCuenta('mesero')).toBe(false);
  });
});
