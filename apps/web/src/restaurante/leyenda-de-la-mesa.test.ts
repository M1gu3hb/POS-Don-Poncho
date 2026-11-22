import { describe, expect, it } from 'vitest';

import { INSTRUCCIONES_DE_LA_MESA, significadoDelColorDeLaMesa } from './leyenda-de-la-mesa.ts';

/**
 * DP-25 · Parte 3 · 3.3 · La leyenda de la mesa se explica sola: qué significa cada color de la
 * mesa y qué hacer con «entregado» y con los pendientes al pedir la cuenta.
 */

describe('significadoDelColorDeLaMesa', () => {
  it('cada estado vivo de la mesa del mapa tiene su frase', () => {
    for (const estado of [
      'libre',
      'esperando_orden',
      'pedido_enviado',
      'en_preparacion',
      'en_espera_entrega',
      'ocupada',
      'cuenta_solicitada',
      'limpieza',
    ]) {
      expect(significadoDelColorDeLaMesa(estado).length).toBeGreaterThan(10);
    }
  });

  it('un estado que no conoce no inventa una frase', () => {
    expect(significadoDelColorDeLaMesa('inventado')).toBe('');
  });
});

describe('INSTRUCCIONES_DE_LA_MESA', () => {
  const todo = INSTRUCCIONES_DE_LA_MESA.map((i) => `${i.titulo} ${i.texto}`).join(' ');

  it('dice cuándo marcar entregado', () => {
    expect(todo).toContain('Marcar entregado');
  });

  it('dice qué hacer si hay pendientes al pedir la cuenta, con los botones como se llaman', () => {
    expect(todo).toContain('Pedir la cuenta de todos modos');
    expect(todo).toContain('Regresar');
  });
});
