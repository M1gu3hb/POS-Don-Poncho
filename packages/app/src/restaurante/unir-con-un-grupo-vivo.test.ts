import { describe, expect, it } from 'vitest';

import { aDondeVaLaUnion, type MesaDeLaUnion } from './unir-con-un-grupo-vivo.ts';

/**
 * DP-25 · P6 — «Unir mesas» con una mesa que YA está en un grupo no es un error: se agrega al
 * grupo (con su principal de siempre). Aquí, sin base de datos, la decisión pura.
 *
 *   · grupo A: principal `a` con la `b` y la `c` (unión `ua`)
 *   · grupo D: principal `d` con la `e`          (unión `ud`)
 *   · libres: `x`, `y`
 */

function mesa(id: string, resto: Partial<MesaDeLaUnion> = {}): MesaDeLaUnion {
  return { id, unidaAMesaId: null, encabezaUnionId: null, ...resto };
}

const SALON: readonly MesaDeLaUnion[] = [
  mesa('a', { encabezaUnionId: 'ua' }),
  mesa('b', { unidaAMesaId: 'a' }),
  mesa('c', { unidaAMesaId: 'a' }),
  mesa('d', { encabezaUnionId: 'ud' }),
  mesa('e', { unidaAMesaId: 'd' }),
  mesa('x'),
  mesa('y'),
];

describe('a dónde va una unión', () => {
  it('sin ninguna mesa en un grupo es una unión normal', () => {
    expect(aDondeVaLaUnion('x', ['y'], SALON)).toEqual({ tipo: 'unir' });
  });

  it('una libre elegida como principal que se une a la principal de un grupo: entra al grupo', () => {
    expect(aDondeVaLaUnion('x', ['a'], SALON)).toEqual({
      tipo: 'agregar',
      unionId: 'ua',
      principalId: 'a',
      mesaIds: ['x'],
      delGrupo: ['a'],
    });
  });

  it('la principal de un grupo elegida como principal recibe a las libres', () => {
    expect(aDondeVaLaUnion('a', ['x', 'y'], SALON)).toEqual({
      tipo: 'agregar',
      unionId: 'ua',
      principalId: 'a',
      mesaIds: ['x', 'y'],
      delGrupo: ['a'],
    });
  });

  it('una mesa ya absorbida como «principal»: manda la principal de su grupo', () => {
    const r = aDondeVaLaUnion('b', ['x'], SALON);
    expect(r).toMatchObject({ tipo: 'agregar', unionId: 'ua', principalId: 'a', mesaIds: ['x'] });
  });

  it('una mesa absorbida entre las que se unen: la libre entra al grupo de esa mesa', () => {
    const r = aDondeVaLaUnion('x', ['c'], SALON);
    expect(r).toMatchObject({ tipo: 'agregar', unionId: 'ua', principalId: 'a', mesaIds: ['x'] });
  });

  it('dos grupos distintos: gana el de la principal elegida y el otro entra entero, por su principal', () => {
    const r = aDondeVaLaUnion('b', ['e', 'x'], SALON);
    expect(r).toEqual({
      tipo: 'agregar',
      unionId: 'ua',
      principalId: 'a',
      mesaIds: ['d', 'x'],
      delGrupo: ['b', 'a'],
    });
  });

  it('con la principal libre, gana el grupo de la primera mesa que se nombró', () => {
    const r = aDondeVaLaUnion('x', ['e', 'c'], SALON);
    expect(r).toMatchObject({
      tipo: 'agregar',
      unionId: 'ud',
      principalId: 'd',
      mesaIds: ['x', 'a'],
    });
  });

  it('si todas las elegidas ya son del mismo grupo no hay nada que agregar', () => {
    const r = aDondeVaLaUnion('a', ['b', 'c'], SALON);
    expect(r.tipo).toBe('nada');
    expect(r.tipo === 'nada' ? r.mensaje : '').toMatch(/ya están unidas/);
  });
});
