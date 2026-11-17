import { describe, expect, it } from 'vitest';

import {
  esFactible,
  generarTabla,
  modeloParaPict,
  revisarTabla,
  tablaCompleta,
  tuplasRequeridas,
  type Fila,
  type Modelo,
} from './nucleo.ts';

const CHICO: Modelo = {
  nombre: 'chico',
  fuerza: 2,
  parametros: [
    { nombre: 'a', valores: ['a1', 'a2'] },
    { nombre: 'b', valores: ['b1', 'b2', 'b3'] },
    { nombre: 'c', valores: ['c1', 'c2'] },
  ],
  prohibidas: [{ a: 'a1', b: 'b3' }],
};

describe('el núcleo de las combinaciones', () => {
  it('cuenta las tuplas que hay que cubrir y deja fuera las que ninguna regla deja existir', () => {
    // a×b: 6 − 1 prohibida = 5 · a×c: 4 · b×c: 6  → 15
    expect(tuplasRequeridas(CHICO)).toHaveLength(15);
  });

  it('una tupla que sólo choca con una regla a través de otro parámetro tampoco es factible', () => {
    const encadenado: Modelo = {
      ...CHICO,
      prohibidas: [
        { a: 'a1', c: 'c1' },
        { a: 'a1', c: 'c2' },
      ],
    };
    // a1 no puede tener ningún valor de c: ni a1×b1 ni a1×c1 son alcanzables.
    expect(esFactible(encadenado, { a: 'a1' })).toBe(false);
    expect(esFactible(encadenado, { a: 'a2', b: 'b1' })).toBe(true);
  });

  it('el generador cubre todo, no viola reglas y es determinista con su semilla', () => {
    const una = generarTabla(CHICO, 7);
    const otra = generarTabla(CHICO, 7);
    expect(otra).toEqual(una);
    expect(tablaCompleta(revisarTabla(CHICO, una))).toBe(true);
    expect(una.length).toBeLessThanOrEqual(8);
  });

  it('con otra semilla puede salir otra tabla, igual de completa', () => {
    const tabla = generarTabla(CHICO, 99);
    expect(tablaCompleta(revisarTabla(CHICO, tabla))).toBe(true);
  });

  it('MUTANTE: quitar un renglón de la tabla deja tuplas sin cubrir y el verificador lo dice', () => {
    const tabla = generarTabla(CHICO, 7);
    const sinUno = tabla.slice(1);
    const revision = revisarTabla(CHICO, sinUno);
    expect(tablaCompleta(revision)).toBe(false);
    expect(revision.sinCubrir.length).toBeGreaterThan(0);
  });

  it('un renglón prohibido, repetido o mal formado se señala', () => {
    const buena = generarTabla(CHICO, 7);
    const prohibido: Fila = { a: 'a1', b: 'b3', c: 'c1' };
    expect(revisarTabla(CHICO, [...buena, prohibido]).prohibidos).toEqual([buena.length]);
    const repetido = buena[0]!;
    expect(revisarTabla(CHICO, [...buena, repetido]).repetidos).toEqual([buena.length]);
    expect(revisarTabla(CHICO, [...buena, { a: 'a1' }]).malFormados).toEqual([buena.length]);
    expect(
      revisarTabla(CHICO, [...buena, { a: 'a1', b: 'b1', c: 'inventado' }]).malFormados,
    ).toEqual([buena.length]);
  });

  it('las ternas: cubre cada terna posible del modelo', () => {
    const ternas: Modelo = { ...CHICO, fuerza: 3 };
    const tabla = generarTabla(ternas, 3);
    expect(tablaCompleta(revisarTabla(ternas, tabla))).toBe(true);
    // 2 × 3 × 2 = 12 renglones posibles, menos los 2 con a1·b3 = 10
    expect(tuplasRequeridas(ternas)).toHaveLength(10);
    expect(tabla).toHaveLength(10);
  });

  it('el modelo se escribe en la sintaxis de PICT, con sus reglas', () => {
    const texto = modeloParaPict(CHICO);
    expect(texto).toContain('a: a1, a2');
    expect(texto).toContain('IF [a] = "a1" THEN [b] <> "b3";');
  });
});
