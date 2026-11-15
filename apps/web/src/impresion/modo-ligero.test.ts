import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { aplicarModoLigero, estaActivo, MARCA_DE_LIGERO } from './modo-ligero.ts';

/**
 * DP-20 · Parte 6 · EL MODO LIGERO: la app avisa, la página se marca y el CSS quita lo pesado.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

function raizFalsa(): {
  atributos: Map<string, string>;
  setAttribute(n: string, v: string): void;
  removeAttribute(n: string): void;
} {
  const atributos = new Map<string, string>();
  return {
    atributos,
    setAttribute: (n, v) => {
      atributos.set(n, v);
    },
    removeAttribute: (n) => {
      atributos.delete(n);
    },
  };
}

describe('la marca en la página', () => {
  it('se pone al encender y se quita al apagar', () => {
    const raiz = raizFalsa();
    aplicarModoLigero(raiz, true);
    expect(raiz.atributos.has(MARCA_DE_LIGERO)).toBe(true);
    aplicarModoLigero(raiz, false);
    expect(raiz.atributos.has(MARCA_DE_LIGERO)).toBe(false);
  });

  it('sólo `activo: true` enciende; lo que no se entiende deja la pantalla completa', () => {
    expect(estaActivo({ activo: true, origen: 'auto', motivo: 'Poca memoria' })).toBe(true);
    for (const raro of [{ activo: false }, { activo: 'sí' }, {}, null, undefined, 'true', 1]) {
      expect(estaActivo(raro)).toBe(false);
    }
  });
});

describe('el CSS del modo ligero', () => {
  const css = readFileSync(join(RAIZ, 'heredado', 'index.css'), 'utf8');
  const inicio = css.indexOf('Modo ligero (DP-20');
  const bloque = css.slice(inicio, inicio + 1800);

  it('existe y se engancha a la misma marca que pone la página', () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(bloque).toContain(`html[${MARCA_DE_LIGERO}]`);
  });

  it('quita el desenfoque y las sombras pesadas', () => {
    expect(bloque).toMatch(/backdrop-filter: none !important/);
    expect(bloque).toMatch(/\.shadow-lg[\s\S]*box-shadow:/);
  });

  it('deja las duraciones en cero, como «reducir movimiento»', () => {
    expect(bloque).toMatch(/--duracion-rapida: 0ms/);
    expect(bloque).toMatch(/--duracion-normal: 0ms/);
    expect(bloque).toMatch(/--duracion-lenta: 0ms/);
    expect(bloque).toMatch(/transition-duration: 0ms !important/);
  });
});
