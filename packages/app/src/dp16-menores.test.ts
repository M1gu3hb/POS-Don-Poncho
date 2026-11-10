import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { avisoDeLaReactivacion } from './restaurante/zona-activa.ts';
import { umbralDeRetiroEn, retiroPideAutorizacion } from './caja/retiro-con-pin.ts';
import { sanearAlLeer } from './saneado.ts';

/** DP-16 · Los menores del servidor que se prueban sin base. */

describe('auditoría: se vuelve a sanear al leer', () => {
  it('tapa correo y teléfono, a cualquier profundidad, y lo de siempre', () => {
    const fila = sanearAlLeer({
      motivo: 'cambio de datos',
      correo: 'ana@ejemplo.com',
      detalle: { telefono: '5512345678', celular: '5500000000', lista: [{ email: 'x@y.mx' }] },
      pin: '1234',
      autorizacion: `${'a'.repeat(40)}.${'b'.repeat(40)}`,
    }) as Record<string, unknown>;
    const texto = JSON.stringify(fila);
    expect(texto).not.toContain('ana@ejemplo.com');
    expect(texto).not.toContain('5512345678');
    expect(texto).not.toContain('5500000000');
    expect(texto).not.toContain('x@y.mx');
    expect(texto).not.toContain('1234');
    expect(texto).not.toContain('bbbbbbbb');
    expect(fila['motivo']).toBe('cambio de datos');
  });

  it('conserva el nonce de un solo uso de la autorización gastada', () => {
    expect(sanearAlLeer({ autorizacion: 'a1b2c3d4e5f60718' })).toEqual({
      autorizacion: 'a1b2c3d4e5f60718',
    });
  });
});

describe('zonas: el aviso al reactivar', () => {
  it('sin rastro de qué mesas se apagaron, lo dice', () => {
    expect(avisoDeLaReactivacion(null, 0)).toMatch(/no hay registro/);
  });
  it('si volvieron menos de las apagadas, lo dice con las cuentas', () => {
    expect(avisoDeLaReactivacion(['a', 'b', 'c'], 2)).toMatch(/2 de las 3/);
  });
  it('si cuadró (o no tenía mesas), no hay aviso', () => {
    expect(avisoDeLaReactivacion(['a', 'b'], 2)).toBeNull();
    expect(avisoDeLaReactivacion([], 0)).toBeNull();
  });
});

describe('retiro con PIN: la regla', () => {
  it('el umbral sólo es un entero positivo', () => {
    expect(umbralDeRetiroEn({ retiro_pin_arriba_de_centavos: 50_000 })).toBe(50_000);
    expect(umbralDeRetiroEn({ retiro_pin_arriba_de_centavos: 0 })).toBeNull();
    expect(umbralDeRetiroEn({})).toBeNull();
    expect(umbralDeRetiroEn(null)).toBeNull();
  });

  it('pide arriba del umbral y sólo a la cajera', () => {
    expect(retiroPideAutorizacion('cajero', 100_001n, 100_000)).toBe(true);
    expect(retiroPideAutorizacion('cajero', 100_000n, 100_000)).toBe(false);
    expect(retiroPideAutorizacion('cajero', 9_999_999n, null)).toBe(false);
    for (const rol of ['gerente', 'administrador', 'dueno']) {
      expect(retiroPideAutorizacion(rol, 9_999_999n, 100_000)).toBe(false);
    }
  });
});
