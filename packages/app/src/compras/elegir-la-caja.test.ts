import { describe, expect, it } from 'vitest';

import { elegirLaCajaDeLaQueSale } from './sesion-de-caja.ts';

/** DP-21 · Bloque 11 · la regla de la caja de la que sale el efectivo (DP-D115), sin lanzar. */
const caja = (id: string, terminal: string | null) => ({ id, terminal_id: terminal });

describe('elegirLaCajaDeLaQueSale', () => {
  it('sin cajas abiertas: ninguna (el efectivo no se registra)', () => {
    expect(elegirLaCajaDeLaQueSale([], 't1')).toEqual({ caso: 'ninguna' });
  });

  it('la de este aparato, aunque haya otra abierta', () => {
    const elegida = elegirLaCajaDeLaQueSale([caja('a', 't2'), caja('b', 't1')], 't1');
    expect(elegida).toEqual({ caso: 'una', fila: caja('b', 't1'), esDeEsteAparato: true });
  });

  it('un aparato sin caja propia y UNA sola abierta: sale de ésa, y lo dice', () => {
    const elegida = elegirLaCajaDeLaQueSale([caja('a', 't2')], 't9');
    expect(elegida).toEqual({ caso: 'una', fila: caja('a', 't2'), esDeEsteAparato: false });
    expect(elegirLaCajaDeLaQueSale([caja('a', 't2')], null)).toMatchObject({
      caso: 'una',
      esDeEsteAparato: false,
    });
  });

  it('un aparato sin caja propia y varias abiertas: no se adivina', () => {
    expect(elegirLaCajaDeLaQueSale([caja('a', 't2'), caja('b', 't3')], 't9')).toEqual({
      caso: 'varias',
    });
  });
});
