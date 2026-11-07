import { describe, expect, it } from 'vitest';

import { mesasParaElegir, zonaYEstado } from './mesas-para-elegir';

describe('la lista de mesas sin cámara (DP-14.6)', () => {
  it('cada mesa dice su zona y su estado, con las palabras del mapa', () => {
    expect(zonaYEstado({ zona: 'Terraza', estado: 'cuenta_solicitada' })).toBe(
      'Terraza · Cuenta solicitada',
    );
    expect(zonaYEstado({ zona: 'Salón', estado: 'pedido_enviado' })).toBe('Salón · Pedido enviado');
  });

  it('sin zona es la de siempre y sin estado es libre', () => {
    expect(zonaYEstado({})).toBe('Interior · Libre');
    expect(zonaYEstado({ zona: '  ', estado: 'desconocido' })).toBe('Interior · Libre');
  });

  it('sigue sin ofrecer las bajas ni las absorbidas, por número', () => {
    const lista = mesasParaElegir([
      { id: 'c', numero: 3 },
      { id: 'a', numero: 1, activo: false },
      { id: 'b', numero: 2, unida_a_mesa_id: 'c' },
      { id: 'd', numero: 0 },
    ]);
    expect(lista.map((m) => m.id)).toEqual(['d', 'c']);
  });
});
