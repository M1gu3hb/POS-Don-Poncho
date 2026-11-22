import { describe, expect, it } from 'vitest';

import { avisoDeCuentaCerrada } from './cuenta-cerrada-por-otro.ts';

/**
 * DP-25 · Parte 3 · 3.5 · Si otra persona cancela o cobra la cuenta que el mesero tiene abierta,
 * se entera: el aviso dice qué pasó, con el número de SU mesa.
 */

describe('avisoDeCuentaCerrada', () => {
  it('cancelada: «La cuenta de la mesa 5 se canceló»', () => {
    expect(avisoDeCuentaCerrada(5, 'cancelada')).toEqual({
      tono: 'atencion',
      mensaje: 'La cuenta de la mesa 5 se canceló.',
    });
  });

  it('pagada, y lo que de ella se reembolsó: «ya se cobró»', () => {
    for (const estado of ['pagada', 'reembolsada', 'parcialmente_reembolsada']) {
      expect(avisoDeCuentaCerrada(5, estado)).toEqual({
        tono: 'info',
        mensaje: 'La cuenta de la mesa 5 ya se cobró.',
      });
    }
  });

  it('dividida: ya no es una sola cuenta de la mesa', () => {
    expect(avisoDeCuentaCerrada(2, 'dividida')?.mensaje).toBe(
      'La cuenta de la mesa 2 se dividió en la Caja.',
    );
  });

  it('una cuenta viva no avisa nada, ni la parcialmente pagada (sigue abierta en la Caja)', () => {
    for (const estado of [
      'abierta',
      'enviada',
      'en_preparacion',
      'lista',
      'cuenta_solicitada',
      'parcialmente_pagada',
      'borrador',
      '',
    ]) {
      expect(avisoDeCuentaCerrada(5, estado)).toBeNull();
    }
    expect(avisoDeCuentaCerrada(5, null)).toBeNull();
    expect(avisoDeCuentaCerrada(5, undefined)).toBeNull();
  });
});
