import { describe, expect, it } from 'vitest';

import {
  mesasQueSePuedenAgregar,
  posicionesAlAgregar,
  type MesaParaAgregar,
} from './agregar-mesas';

/** DP-24 · P5 — qué mesas se ofrecen al agregar y dónde quedan en el plano. */

const mesa = (id: string, numero: number, x: number, resto: Partial<MesaParaAgregar> = {}) =>
  ({
    id,
    numero,
    posicion_x: x,
    posicion_y: 100,
    forma: 'redonda',
    tamano: 'mediana',
    estado: 'libre',
    unida_a_mesa_id: null,
    ...resto,
  }) satisfies MesaParaAgregar;

// Un grupo A+B (A principal) y, aparte, la C suelta y el grupo D+E (D principal), la F en limpieza.
const SALON: readonly MesaParaAgregar[] = [
  mesa('a', 1, 100),
  mesa('b', 2, 180, { unida_a_mesa_id: 'a' }),
  mesa('c', 3, 500),
  mesa('d', 4, 700),
  mesa('e', 5, 780, { unida_a_mesa_id: 'd' }),
  mesa('f', 6, 900, { estado: 'limpieza' }),
];

describe('mesas que se ofrecen', () => {
  it('las sueltas y la principal de otro grupo, por número; no la principal, ni las ocultas, ni limpieza', () => {
    const ids = mesasQueSePuedenAgregar([...SALON].reverse(), 'a').map((m) => m.id);
    expect(ids).toEqual(['c', 'd']);
  });

  it('una mesa libre sin posición también se ofrece', () => {
    const sinLugar = { id: 'g', numero: 7 } satisfies MesaParaAgregar;
    expect(mesasQueSePuedenAgregar([sinLugar], 'a')).toEqual([sinLugar]);
  });
});

describe('dónde queda cada mesa al agregar', () => {
  it('una suelta se pega a la derecha del grupo', () => {
    expect(posicionesAlAgregar(SALON, ['a', 'b'], ['c'])).toEqual([
      { mesaId: 'c', x: 260, y: 100 },
    ]);
  });

  it('el grupo de otra principal se corre ENTERO lo mismo que ella', () => {
    const r = posicionesAlAgregar(SALON, ['a', 'b'], ['d']);
    // La D va a 260; la E, que estaba 80 a su derecha, sigue 80 a su derecha.
    expect(r).toEqual([
      { mesaId: 'd', x: 260, y: 100 },
      { mesaId: 'e', x: 340, y: 100 },
    ]);
  });

  it('varias, una tras otra: cada una pega con la anterior', () => {
    const r = posicionesAlAgregar(SALON, ['a', 'b'], ['c', 'd']);
    expect(r).toEqual([
      { mesaId: 'c', x: 260, y: 100 },
      { mesaId: 'd', x: 340, y: 100 },
      { mesaId: 'e', x: 420, y: 100 },
    ]);
  });

  it('sin elegidas no hay nada que acomodar', () => {
    expect(posicionesAlAgregar(SALON, ['a', 'b'], [])).toEqual([]);
  });
});
