import { describe, expect, it } from 'vitest';

import {
  avisoDePropinaPendiente,
  etiquetaDeLaMesa,
  insigniaDeQr,
  tieneTotalCero,
  type VentaPendiente,
} from './cuentas-pendientes.ts';

/**
 * LAS CUENTAS PENDIENTES DE LA CAJA, sin pantalla: qué dice cada tesela y su insignia del QR.
 *
 * Es lo que la lista heredada decidía dentro de su JSX, con las mismas reglas y en el mismo
 * orden: un cambio de orden cambiaría QUÉ insignia sale para una misma cuenta.
 */

function venta(parcial: Partial<VentaPendiente> = {}): VentaPendiente {
  return { id: 'v1', total: 350, ...parcial };
}

describe('la mesa de la tesela', () => {
  it('es el número de mesa, o un guion si la cuenta no tiene', () => {
    expect(etiquetaDeLaMesa(venta({ mesa_numero: 5 }))).toBe('Mesa 5');
    expect(etiquetaDeLaMesa(venta({ mesa_numero: '12' }))).toBe('Mesa 12');
    expect(etiquetaDeLaMesa(venta({ mesa_numero: null }))).toBe('Mesa —');
    expect(etiquetaDeLaMesa(venta({ mesa_numero: '' }))).toBe('Mesa —');
    expect(etiquetaDeLaMesa(venta({ mesa_numero: 0 }))).toBe('Mesa —');
    expect(etiquetaDeLaMesa(venta())).toBe('Mesa —');
  });
});

describe('el ticket en cero', () => {
  it('es el que no tiene total, o lo tiene en cero o negativo', () => {
    expect(tieneTotalCero(venta({ total: 0 }))).toBe(true);
    expect(tieneTotalCero(venta({ total: null }))).toBe(true);
    expect(tieneTotalCero(venta({ total: -5 }))).toBe(true);
    expect(tieneTotalCero({ id: 'v2' })).toBe(true);
    expect(tieneTotalCero(venta({ total: 0.5 }))).toBe(false);
  });
});

describe('la insignia del QR', () => {
  const delQr = { propina_origen: 'portal_qr' } as const;

  it('una cuenta que no vino del QR no lleva insignia', () => {
    expect(
      insigniaDeQr(venta({ propina_origen: 'mesero', propina_tipo: 'porcentaje' }), 35),
    ).toBeNull();
    expect(insigniaDeQr(venta(), 0)).toBeNull();
  });

  it('el comensal todavía no eligió propina: «esperando»', () => {
    expect(insigniaDeQr(venta({ propina_origen: 'pendiente_portal_qr' }), 0)).toEqual({
      tipo: 'esperando',
    });
    expect(insigniaDeQr(venta({ ...delQr, propina_tipo: 'pendiente_cliente' }), 0)).toEqual({
      tipo: 'esperando',
    });
  });

  it('«esperando» manda aunque haya porcentaje: es lo que el cajero tiene que resolver', () => {
    const cuenta = venta({
      propina_origen: 'pendiente_portal_qr',
      propina_tipo: 'porcentaje',
      propina_porcentaje: 10,
    });
    expect(insigniaDeQr(cuenta, 35)).toEqual({ tipo: 'esperando' });
  });

  it('delegó en la caja, o dijo que sin propina', () => {
    expect(insigniaDeQr(venta({ ...delQr, propina_tipo: 'decidir_en_caja' }), 0)).toEqual({
      tipo: 'decidir_en_caja',
    });
    expect(insigniaDeQr(venta({ ...delQr, propina_tipo: 'sin_propina' }), 0)).toEqual({
      tipo: 'sin_propina',
    });
  });

  it('con porcentaje, lo dice con su importe en pesos', () => {
    const cuenta = venta({ ...delQr, propina_tipo: 'porcentaje', propina_porcentaje: 10 });
    expect(insigniaDeQr(cuenta, 35)).toEqual({
      tipo: 'porcentaje',
      porcentaje: 10,
      propinaPesos: 35,
    });
  });

  it('un porcentaje en cero no es un porcentaje: cae al monto, o a «cuenta solicitada»', () => {
    const cuenta = venta({ ...delQr, propina_tipo: 'porcentaje', propina_porcentaje: 0 });
    expect(insigniaDeQr(cuenta, 0)).toEqual({ tipo: 'solicitada' });
    expect(insigniaDeQr(cuenta, 20)).toEqual({ tipo: 'monto', propinaPesos: 20 });
  });

  it('un monto que escribió el comensal', () => {
    expect(insigniaDeQr(venta({ ...delQr, propina_tipo: 'monto_manual' }), 50)).toEqual({
      tipo: 'monto',
      propinaPesos: 50,
    });
  });

  it('sin nada más que decir, pidió la cuenta y ya', () => {
    expect(insigniaDeQr(venta({ ...delQr }), 0)).toEqual({ tipo: 'solicitada' });
  });
});

describe('la propina por definir, dentro del cobro', () => {
  it('cada caso dice quién la dejó en el aire', () => {
    expect(avisoDePropinaPendiente('decidir_en_caja')).toBe(
      'Cliente eligió decidir en caja — toca para definir propina',
    );
    expect(avisoDePropinaPendiente('pendiente_cliente')).toBe(
      'Cliente no eligió propina en QR — toca para definirla',
    );
    expect(avisoDePropinaPendiente('pendiente')).toBe('Propina pendiente — toca para definirla');
  });

  it('una propina ya decidida no lleva aviso', () => {
    expect(avisoDePropinaPendiente('porcentaje')).toBeNull();
    expect(avisoDePropinaPendiente('sin_propina')).toBeNull();
    expect(avisoDePropinaPendiente(null)).toBeNull();
    expect(avisoDePropinaPendiente(undefined)).toBeNull();
  });
});
