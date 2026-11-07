import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  TIEMPO_LIMITE_DE_LAS_OPCIONES_MS,
  guardarOpciones,
  leerOpcionesGuardadas,
  pideOpciones,
  type GrupoDelPlatillo,
} from './opciones-de-los-platillos';

/**
 * DP-14.1-4 · SI FALLA LA LECTURA DE OPCIONES, EL MESERO SIGUE AGREGANDO LO QUE NO LAS PIDE.
 *
 * Qué platillo pide opciones se sabe sin red por la última lectura buena (guardada en el
 * navegador) o por la pista `tiene_opciones` del producto; la lectura tiene tiempo límite.
 */

const RELLENO: GrupoDelPlatillo = {
  id: 'g',
  nombre: 'Relleno',
  obligatorio: true,
  tipo: 'unica',
  activo: true,
  opciones: [{ id: 'o', nombre: 'Pollo', activo: true }],
};

describe('pideOpciones', () => {
  it('con un mapa, el platillo con grupos las pide y el que no, no', () => {
    const mapa = { quesadilla: [RELLENO] };
    expect(pideOpciones({ id: 'quesadilla' }, mapa)).toBe('si');
    expect(pideOpciones({ id: 'agua' }, mapa)).toBe('no');
    expect(pideOpciones({ id: 'agua' }, {})).toBe('no');
  });

  it('la pista del puente manda sobre un mapa guardado viejo (DP-14.1)', () => {
    // El platillo ganó (o perdió) su grupo después de la última lectura guardada: la pista sale de
    // la MISMA lectura de productos con la que se pinta la carta, así que es la de ahora.
    const viejo = { quesadilla: [RELLENO] };
    expect(pideOpciones({ id: 'quesadilla', tiene_opciones: false }, viejo)).toBe('no');
    expect(pideOpciones({ id: 'nuevo', tiene_opciones: true }, viejo)).toBe('si');
  });

  it('sin mapa, la pista del producto decide; sin pista, no se sabe', () => {
    expect(pideOpciones({ id: 'a', tiene_opciones: false }, undefined)).toBe('no');
    expect(pideOpciones({ id: 'a', tiene_opciones: true }, undefined)).toBe('si');
    expect(pideOpciones({ id: 'a' }, undefined)).toBe('no_se');
    expect(pideOpciones({ id: 'a', tiene_opciones: null }, undefined)).toBe('no_se');
  });
});

describe('la última lectura buena', () => {
  afterEach(() => vi.unstubAllGlobals());

  function almacenFalso(inicial: Record<string, string> = {}) {
    const datos = new Map(Object.entries(inicial));
    return {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => void datos.set(k, v),
    };
  }

  it('lo guardado se lee igual', () => {
    vi.stubGlobal('localStorage', almacenFalso());
    expect(leerOpcionesGuardadas()).toBeUndefined();
    guardarOpciones({ q: [RELLENO] });
    expect(leerOpcionesGuardadas()).toEqual({ q: [RELLENO] });
  });

  it('un almacenamiento que lanza o un JSON dañado no rompen nada', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    expect(leerOpcionesGuardadas()).toBeUndefined();
    expect(() => {
      guardarOpciones({});
    }).not.toThrow();
    vi.stubGlobal(
      'localStorage',
      almacenFalso({ 'morphiqpos:opciones_de_los_platillos:v1': '[1' }),
    );
    expect(leerOpcionesGuardadas()).toBeUndefined();
    // Algo que no es un mapa (un arreglo, un número) tampoco se toma por lectura buena.
    for (const crudo of ['[1,2]', '5', 'null']) {
      vi.stubGlobal(
        'localStorage',
        almacenFalso({ 'morphiqpos:opciones_de_los_platillos:v1': crudo }),
      );
      expect(leerOpcionesGuardadas(), crudo).toBeUndefined();
    }
  });
});

describe('el tiempo límite de la lectura', () => {
  it('es de 8 s y la consulta lo aplica, sin reintentos automáticos', () => {
    expect(TIEMPO_LIMITE_DE_LAS_OPCIONES_MS).toBe(8_000);
    const fuente = readFileSync(join(__dirname, 'use-opciones-de-los-platillos.ts'), 'utf8');
    expect(fuente).toMatch(/setTimeout\(cortar, TIEMPO_LIMITE_DE_LAS_OPCIONES_MS\)/);
    expect(fuente).toMatch(/\{ signal: conTiempoLimite\(signal\) \}/);
    expect(fuente).toMatch(/retry: false/);
  });
});
