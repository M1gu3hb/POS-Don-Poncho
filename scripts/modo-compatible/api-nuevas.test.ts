import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { API_NUEVAS, apiSinRelleno, rellenosDeclarados } from './api-nuevas.mjs';

/**
 * DP-20.1 · EL JAVASCRIPT DEL BUILD CONTRA EL MOTOR VIEJO: una función más nueva que Chromium 99
 * que aparezca sin relleno tiene que detener la CI, y lo que no es esa función no puede detenerla.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RELLENOS = readFileSync(
  join(AQUI, '..', '..', 'apps', 'web', 'src', 'compatibilidad', 'rellenos.ts'),
  'utf8',
);

describe('lo que usa el build y lo que le falta', () => {
  it('una función nueva con su relleno pasa; sin él, se dice cuál y desde cuándo existe', () => {
    const codigo = 'let o=[...i].toSorted((a,b)=>a-b);if(!URL.canParse(u))return!0';
    expect(apiSinRelleno(codigo, ['toSorted', 'canParse'])).toEqual({
      usadas: ['Array.prototype.toSorted', 'URL.canParse'],
      sinRelleno: [],
    });
    expect(apiSinRelleno(codigo, ['toSorted']).sinRelleno).toEqual([
      { nombre: 'URL.canParse', desde: 120 },
    ]);
  });

  it('una llamada protegida también cuenta: el motor viejo necesita el relleno igual', () => {
    const protegida =
      'if("function"==typeof URL.canParse)return URL.canParse(e);return new URL(e),!0';
    expect(apiSinRelleno(protegida, []).sinRelleno).toEqual([
      { nombre: 'URL.canParse', desde: 120 },
    ]);
  });

  it('no confunde el código que sólo SE LLAMA parecido', () => {
    // core-js (lo trae jspdf) pregunta por ellas con otros nombres; un `.with(` cualquiera; y el
    // `Response.json()` de leer una respuesta, que no es el `Response.json(dato)` estático.
    const ajeno =
      'Tg=a(function(){Ig.canParse()});zo.groupBy("ab",f);Zc=RegExp.escape;z.string().with(x);await respuesta.json()';
    expect(apiSinRelleno(ajeno, [])).toEqual({ usadas: [], sinRelleno: [] });
  });

  it('cada función de la lista dice desde qué Chromium existe, y ninguna es anterior al piso (99)', () => {
    for (const api of API_NUEVAS) {
      expect(api.desde).toBeGreaterThan(99);
      expect(api.relleno).toMatch(/^[A-Za-z]+$/);
    }
    expect(new Set(API_NUEVAS.map((a) => a.nombre)).size).toBe(API_NUEVAS.length);
  });
});

describe('los rellenos que el POS sí instala', () => {
  it('se leen del archivo que llega al navegador', () => {
    expect(rellenosDeclarados(RELLENOS)).toEqual([
      'toSorted',
      'toReversed',
      'toSpliced',
      'with',
      'canParse',
    ]);
  });

  it('un archivo sin la lista no declara nada (y el contrato lo denuncia)', () => {
    expect(rellenosDeclarados('export const OTRA = [1, 2];')).toEqual([]);
  });

  it('lo que hoy usa el POS queda cubierto', () => {
    const delPos = 'e.filter(a).toSorted(b);URL.canParse(t)';
    expect(apiSinRelleno(delPos, rellenosDeclarados(RELLENOS)).sinRelleno).toEqual([]);
  });
});
