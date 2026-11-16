import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 9 · M16 · EL TECLADO EN PANTALLA, CABLEADO.
 *
 * La lógica del alto visible y de llevar el campo al centro tiene sus pruebas unitarias; esto
 * comprueba que está CONECTADA: la hoja se importa, apunta a las ventanas por `data-slot` (no por
 * `role="dialog"`, que un popover también trae) y el armazón monta las dos piezas.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

describe('los diálogos y paneles usan el alto visible', () => {
  const css = leer('src/tacto/teclado-en-pantalla.css');

  it('la importa la hoja global', () => {
    expect(leer('app/globals.css')).toMatch(
      /@import '\.\.\/src\/tacto\/teclado-en-pantalla\.css';/,
    );
  });

  it('sólo entra con el teclado arriba (`data-teclado`): sin él, un diálogo se ve como siempre', () => {
    const selectores = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].map((m) =>
      (m[1] ?? '').trim(),
    );
    expect(selectores.length).toBeGreaterThan(0);
    for (const selector of selectores) expect(selector).toMatch(/^html\[data-teclado\]/);
  });

  it('centra el diálogo en lo que se ve y le pone tope de alto, con scroll por dentro', () => {
    expect(css).toMatch(/top: calc\(var\(--alto-visible\) \/ 2\);/);
    expect(css).toMatch(/max-height: calc\(var\(--alto-visible\) - var\(--espacio-4\)\);/);
    expect(css).toMatch(/overflow-y: auto;/);
  });

  it('el panel lateral mide lo visible, de arriba abajo', () => {
    expect(css).toMatch(/\[data-slot='sheet-content'\][^{]*\{[^}]*height: var\(--alto-visible\);/);
  });

  it('apunta a las ventanas por `data-slot`, no por `role="dialog"` (un popover también lo trae)', () => {
    expect(css).toMatch(/data-slot='dialog-content'/);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/role=/);
  });

  it('no anima nada de layout: sin `transition` ni `animation` en la hoja', () => {
    const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(sinComentarios).not.toMatch(/transition|animation/);
  });
});

describe('el armazón monta lo del teclado', () => {
  const armazon = leer('src/tacto/ArmazonTactil.tsx');

  it('mantiene --alto-visible y lleva el campo al centro, una vez, sin animar si se pidió', () => {
    expect(armazon).toMatch(/montarAltoVisible\(window, document\.documentElement\)/);
    expect(armazon).toMatch(/montarLlevarAlCentro\(/);
    expect(armazon).toMatch(/scrollIntoView\(\{ block: 'center', behavior: comportamiento \}\)/);
    expect(armazon).toMatch(/prefers-reduced-motion: reduce/);
    expect(armazon).toMatch(/data-ligero/);
  });

  it('sólo con dedo (`(any-pointer: coarse)`)', () => {
    expect(armazon).toMatch(/hayPunteroGrueso\(\)/);
  });
});
