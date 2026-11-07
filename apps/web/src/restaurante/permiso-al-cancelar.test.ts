import { describe, expect, it } from 'vitest';

import { ErrorApi } from '~/cliente/api';

import {
  NO_PUDE_COMPROBAR_LA_COCINA,
  TIEMPO_LIMITE_DE_LA_COCINA_MS,
  cocinaTrasElTiempo,
  estadoDeLaCocina,
  exigePinPorLaCocina,
  pideElPinDelSupervisor,
} from './permiso-al-cancelar.ts';

/**
 * DP-13.2 · Lo que la pantalla del mesero decide al cancelar, sin pantalla.
 *
 *   · Si el servidor contesta que la cuenta ya se pidió (o se imprimió) y hace falta el PIN de un
 *     gerente, el diálogo lo pide ahí mismo en vez de enseñar un error.
 *   · El aviso de «la cocina ya preparó X» no se enseña a ciegas: mientras se comprueba la cocina
 *     se espera, y si la lectura falla se dice «No pude comprobar la cocina».
 */

const errorDe = (regla: string): ErrorApi =>
  new ErrorApi({ codigo: 'REGLA_DE_NEGOCIO', mensaje: 'x', datos: { regla } }, 422, null);

describe('cuándo se pide el PIN del supervisor', () => {
  it('cuando el servidor dice que el puesto no alcanza (la cuenta ya se pidió)', () => {
    expect(pideElPinDelSupervisor(errorDe('PUESTO_NO_OTORGABLE'))).toBe(true);
  });

  it('cualquier otro fallo es un fallo, no un PIN', () => {
    expect(pideElPinDelSupervisor(errorDe('ORDEN_NO_EDITABLE'))).toBe(false);
    expect(
      pideElPinDelSupervisor(new ErrorApi({ codigo: 'SIN_PERMISO', mensaje: 'x' }, 403, null)),
    ).toBe(false);
    expect(pideElPinDelSupervisor(new Error('sin red'))).toBe(false);
  });
});

describe('el aviso de la cocina, nunca a ciegas', () => {
  it('mientras se comprueba, se espera', () => {
    expect(estadoDeLaCocina({ comprobando: true, leida: true, fallo: null })).toBe('comprobando');
    expect(estadoDeLaCocina({ comprobando: false, leida: false, fallo: null })).toBe('comprobando');
  });

  it('si la lectura falló, se dice que no se pudo comprobar', () => {
    expect(estadoDeLaCocina({ comprobando: false, leida: true, fallo: '503' })).toBe(
      'sin_comprobar',
    );
    expect(NO_PUDE_COMPROBAR_LA_COCINA).toBe('No pude comprobar la cocina');
  });

  it('leída, el aviso es el de lo que ya salió (o ninguno)', () => {
    expect(estadoDeLaCocina({ comprobando: false, leida: true, fallo: null })).toBe('comprobada');
  });
});

describe('DP-14.6-7 · «Comprobando la cocina…» no es eterno', () => {
  it('el tiempo límite es de 8 segundos', () => {
    expect(TIEMPO_LIMITE_DE_LA_COCINA_MS).toBe(8_000);
  });

  it('vencido el tiempo, lo que seguía comprobando pasa a «sin comprobar»', () => {
    expect(cocinaTrasElTiempo('comprobando', true)).toBe('sin_comprobar');
    expect(cocinaTrasElTiempo('comprobando', false)).toBe('comprobando');
  });

  it('el tiempo no toca una lectura que ya contestó', () => {
    expect(cocinaTrasElTiempo('comprobada', true)).toBe('comprobada');
    expect(cocinaTrasElTiempo('sin_comprobar', true)).toBe('sin_comprobar');
    expect(cocinaTrasElTiempo(undefined, true)).toBeUndefined();
  });

  it('sin respuesta, cancelar pide el PIN de un gerente; con respuesta no lo adelanta', () => {
    expect(exigePinPorLaCocina('comprobando', true)).toBe(true);
    expect(exigePinPorLaCocina('comprobando', false)).toBe(false);
    // Falle de inmediato o por tiempo, sin comprobar es lo mismo: PIN de un gerente.
    expect(exigePinPorLaCocina('sin_comprobar', false)).toBe(true);
    expect(exigePinPorLaCocina('sin_comprobar', true)).toBe(true);
    expect(exigePinPorLaCocina('comprobada', true)).toBe(false);
    expect(exigePinPorLaCocina('comprobada', false)).toBe(false);
  });
});
