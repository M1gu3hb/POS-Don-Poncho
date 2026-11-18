import { describe, expect, it } from 'vitest';

import { motivoDeLaCancelacion } from './motivo-de-la-cancelacion';

/**
 * DP-D179 · El motivo de una cancelación lleva, cuando la hubo, quién la autorizó con su PIN
 * (gerente, administrador o dueño). Sin autorización queda el motivo solo.
 */
describe('motivoDeLaCancelacion', () => {
  it('con autorización: «motivo · Autorizó Beatriz»', () => {
    expect(motivoDeLaCancelacion({ motivo: 'Se fueron sin pagar', autorizo: 'Beatriz' })).toBe(
      'Se fueron sin pagar · Autorizó Beatriz',
    );
  });

  it('sin autorización: sólo el motivo', () => {
    expect(motivoDeLaCancelacion({ motivo: 'Capturé mal', autorizo: null })).toBe('Capturé mal');
    expect(motivoDeLaCancelacion({ motivo: 'Capturé mal' })).toBe('Capturé mal');
  });

  it('sin motivo pero con autorización, dice quién autorizó', () => {
    expect(motivoDeLaCancelacion({ motivo: null, autorizo: 'Beatriz' })).toBe('Autorizó Beatriz');
  });

  it('sin nada, null (la pantalla pone su raya)', () => {
    expect(motivoDeLaCancelacion({ motivo: null, autorizo: null })).toBeNull();
    expect(motivoDeLaCancelacion({ motivo: '  ', autorizo: '' })).toBeNull();
  });
});
