import { describe, expect, it } from 'vitest';

import {
  cajaConSuAparato,
  lugarParaAbrir,
  lugaresLibres,
  nombreDeLaCaja,
  nombresDeCajasEn,
} from './lugares.ts';

/**
 * DP-21 · Bloque 5 · «Las cajas se suman. Deben ser 1 o 2 fijas, que se trasladen, y mejor con
 * nombre» (M1). La caja es un LUGAR de la sucursal, no el aparato que la tiene abierta.
 */
describe('nombresDeCajasEn', () => {
  it('lee los nombres por lugar', () => {
    expect(nombresDeCajasEn({ nombres_de_cajas: ['Caja principal', 'Caja barra'] })).toEqual([
      'Caja principal',
      'Caja barra',
    ]);
  });

  it('sin nada guardado no hay nombres (cada caja se llama «Caja N»)', () => {
    expect(nombresDeCajasEn({})).toEqual([]);
    expect(nombresDeCajasEn(null)).toEqual([]);
    expect(nombresDeCajasEn({ nombres_de_cajas: 'Caja principal' })).toEqual([]);
  });

  it('un nombre vacío o que no es texto queda sin nombre, sin mover a los demás de lugar', () => {
    expect(nombresDeCajasEn({ nombres_de_cajas: ['', 'Caja barra', 7] })).toEqual([
      null,
      'Caja barra',
      null,
    ]);
  });

  it('no hay más de cuatro lugares, y un nombre no pasa de 40 letras', () => {
    const muchos = { nombres_de_cajas: ['a', 'b', 'c', 'd', 'e', 'f'] };
    expect(nombresDeCajasEn(muchos)).toHaveLength(4);
    const largo = nombresDeCajasEn({ nombres_de_cajas: ['x'.repeat(90)] })[0];
    expect(largo).toHaveLength(40);
  });
});

describe('nombreDeLaCaja', () => {
  const nombres = ['Caja principal', null];

  it('el nombre que le puso el dueño', () => {
    expect(nombreDeLaCaja(1, nombres, 'Aparato 33')).toBe('Caja principal');
  });

  it('sin nombre, «Caja N»: por el lugar, nunca por el aparato', () => {
    expect(nombreDeLaCaja(2, nombres, 'Aparato 33')).toBe('Caja 2');
    expect(nombreDeLaCaja(3, [], 'Aparato 7')).toBe('Caja 3');
  });

  it('el nombre no cambia por el aparato: 20 aparatos distintos, la misma caja', () => {
    const vistos = new Set<string>();
    for (let n = 1; n <= 20; n += 1) vistos.add(nombreDeLaCaja(1, nombres, `Aparato ${String(n)}`));
    expect([...vistos]).toEqual(['Caja principal']);
  });

  it('una sesión de antes (sin lugar) se llama como su aparato', () => {
    expect(nombreDeLaCaja(null, nombres, 'Caja 33')).toBe('Caja 33');
    expect(nombreDeLaCaja(null, nombres, null)).toBe('Caja');
  });
});

describe('cajaConSuAparato', () => {
  it('dice la caja y en qué aparato está', () => {
    expect(cajaConSuAparato(1, ['Caja principal'], 'iMin mostrador')).toBe(
      'Caja principal · iMin mostrador',
    );
  });

  it('sin aparato conocido, sólo la caja', () => {
    expect(cajaConSuAparato(2, [], null)).toBe('Caja 2');
  });

  it('una sesión de antes no repite su nombre', () => {
    expect(cajaConSuAparato(null, [], 'Caja 33')).toBe('Caja 33');
  });
});

describe('lugaresLibres y lugarParaAbrir', () => {
  it('con cupo 1 y nada abierto, el lugar 1', () => {
    expect(lugaresLibres(1, [])).toEqual([1]);
    expect(lugarParaAbrir(1, [])).toBe(1);
  });

  it('con cupo 1 y la caja abierta en otro aparato, no hay lugar: se trae, no se abre una tercera', () => {
    expect(lugaresLibres(1, [1])).toEqual([]);
    expect(lugarParaAbrir(1, [1])).toBeNull();
  });

  it('con cupo 2 y la Caja 1 abierta, el segundo aparato abre la Caja 2', () => {
    expect(lugarParaAbrir(2, [1])).toBe(2);
  });

  it('con cupo 2 y las dos abiertas, un tercer aparato sólo puede traer', () => {
    expect(lugarParaAbrir(2, [1, 2])).toBeNull();
  });

  it('si se cerró la Caja 1 y sigue la 2, el que abre toma la 1', () => {
    expect(lugaresLibres(2, [2])).toEqual([1]);
  });

  it('se puede pedir un lugar, si existe y está libre', () => {
    expect(lugarParaAbrir(2, [], 2)).toBe(2);
    expect(lugarParaAbrir(2, [2], 2)).toBeNull();
    expect(lugarParaAbrir(2, [], 3)).toBeNull();
    expect(lugarParaAbrir(2, [], 0)).toBeNull();
  });

  it('una sesión de antes (sin lugar) no ocupa ninguno', () => {
    expect(lugaresLibres(2, [null, undefined])).toEqual([1, 2]);
  });

  it('el cupo nunca da más de cuatro lugares ni menos de uno', () => {
    expect(lugaresLibres(9, [])).toEqual([1, 2, 3, 4]);
    expect(lugaresLibres(0, [])).toEqual([1]);
  });
});
