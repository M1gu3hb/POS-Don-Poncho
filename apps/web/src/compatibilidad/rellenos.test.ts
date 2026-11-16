import { createContext, runInContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { GUION_DE_RELLENOS, RELLENOS_INSTALADOS } from './rellenos.ts';

/**
 * DP-20.1 · LOS RELLENOS: el guion que llega al navegador, corrido tal cual en un mundo al que se
 * le quitaron esas funciones (un Chromium 99 no trae `toSorted` ni `URL.canParse`).
 */

/** Un mundo aparte, con o sin las funciones nuevas, en el que ya corrió el guion. */
function mundo(viejo: boolean): (cuerpo: string) => unknown {
  const contexto = createContext({ URL });
  if (viejo) {
    // `URL` es la del proceso: se envuelve para poder quitarle `canParse` sin tocar la de verdad.
    runInContext(
      `(function () {
        ['toSorted', 'toReversed', 'toSpliced', 'with'].forEach(function (n) { delete Array.prototype[n]; });
        var U = URL;
        URL = function (u, b) { return b === undefined ? new U(u) : new U(u, b); };
      })();`,
      contexto,
    );
  }
  runInContext(GUION_DE_RELLENOS, contexto);
  // Cada pregunta corre en su propia función: lo que declare no se queda en el mundo.
  return (cuerpo) => runInContext(`(function () { ${cuerpo} })()`, contexto) as unknown;
}

describe('en un motor viejo, el guion pone lo que falta', () => {
  const preguntar = mundo(true);

  it('el mundo de la prueba es de verdad viejo antes del guion', () => {
    const contexto = createContext({});
    runInContext('delete Array.prototype.toSorted;', contexto);
    expect(runInContext('typeof [].toSorted', contexto)).toBe('undefined');
  });

  it('instala cada relleno que declara', () => {
    for (const nombre of RELLENOS_INSTALADOS) {
      const donde = nombre === 'canParse' ? 'URL' : 'Array.prototype';
      expect(preguntar(`return typeof ${donde}[${JSON.stringify(nombre)}];`)).toBe('function');
    }
    // Y son los rellenos, no las nativas.
    expect(
      preguntar('return /native code/.test(Function.prototype.toString.call([].toSorted));'),
    ).toBe(false);
  });

  it('`toSorted` ordena una COPIA, con o sin comparación', () => {
    expect(
      preguntar('var a = [3, 1, 2]; var b = a.toSorted(); return JSON.stringify([a, b, a === b]);'),
    ).toBe('[[3,1,2],[1,2,3],false]');
    expect(
      preguntar(
        'return [{ f: "b" }, { f: "a" }, { f: "c" }].toSorted(function (x, y) { return x.f.localeCompare(y.f); }).map(function (x) { return x.f; }).join("");',
      ),
    ).toBe('abc');
    expect(() => preguntar('return [1].toSorted(5);')).toThrow(/no es una funcion/);
  });

  it('`toReversed`, `toSpliced` y `with` tampoco tocan el original', () => {
    expect(
      preguntar(
        'var a = [1, 2, 3]; return JSON.stringify([a.toReversed(), a.toSpliced(1, 1, 9, 8), a.with(-1, 7), a]);',
      ),
    ).toBe('[[3,2,1],[1,9,8,3],[1,2,7],[1,2,3]]');
    expect(() => preguntar('return [1, 2].with(5, 0);')).toThrow(/fuera del arreglo/);
  });

  it('`URL.canParse` dice si la dirección se puede leer, sin lanzar', () => {
    expect(
      preguntar(
        'return JSON.stringify([URL.canParse("https://pos.example/a"), URL.canParse("/a", "https://pos.example"), URL.canParse("no es una url"), URL.canParse("/a")]);',
      ),
    ).toBe('[true,true,false,false]');
  });

  it('no deja nada enumerable colgado de los arreglos', () => {
    expect(
      preguntar('var llaves = []; for (var k in [1]) llaves.push(k); return llaves.join();'),
    ).toBe('0');
  });
});

describe('en un motor moderno, el guion no toca nada', () => {
  it('las funciones nativas siguen siendo las nativas', () => {
    const preguntar = mundo(false);
    expect(
      preguntar('return /native code/.test(Function.prototype.toString.call([].toSorted));'),
    ).toBe(true);
    expect(preguntar('return URL.canParse("https://pos.example");')).toBe(true);
  });
});

describe('el guion viaja en línea y tiene que entenderlo cualquier motor', () => {
  it('sin sintaxis moderna: ni flechas, ni `let`/`const`, ni `?.`, ni plantillas', () => {
    expect(GUION_DE_RELLENOS).not.toMatch(/=>|\blet\b|\bconst\b|\?\.|\?\?|`|\.\.\./);
  });

  it('es pequeño: va en cada página', () => {
    expect(GUION_DE_RELLENOS.length).toBeLessThan(1200);
  });
});
