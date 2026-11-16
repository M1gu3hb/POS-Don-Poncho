import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 16 (M21) · TODO BLANCO TÁCTIL MIDE 44 PX COMO MÍNIMO: el cableado, leído.
 *
 * El barrido (`pruebas/e2e/barrido-visual.spec.ts`) mide en el navegador; esto comprueba que el piso
 * existe, que sólo corre donde hay un dedo (la galería de la CI, con ratón, no cambia) y que no
 * deforma lo que no debe. Se valida mutando el código real.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const css = readFileSync(join(RAIZ, 'src/tacto/blancos-tactiles.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

describe('el piso de 44 px', () => {
  it('la importa la hoja global', () => {
    expect(readFileSync(join(RAIZ, 'app/globals.css'), 'utf8')).toMatch(
      /@import '\.\.\/src\/tacto\/blancos-tactiles\.css';/,
    );
  });

  it('el token vale 44 px (2.75rem) y el piso lo usa en alto y ancho', () => {
    expect(css).toMatch(/--altura-tactil: 2\.75rem;/);
    expect(css).toMatch(/min-height: var\(--altura-tactil\);/);
    expect(css).toMatch(/min-width: var\(--altura-tactil\);/);
  });

  it('sólo donde hay un dedo: con ratón, la densidad de siempre', () => {
    // El piso (`min-height`) vive DENTRO del bloque `any-pointer: coarse`, no antes de él.
    const inicio = css.indexOf('@media (any-pointer: coarse)');
    expect(inicio).toBeGreaterThan(-1);
    expect(css.slice(0, inicio)).not.toContain('min-height');
    expect(css.slice(inicio)).toContain('min-height');
  });

  it('sólo en el POS (`data-pos-tactil`) y en `@layer base`: un tamaño mayor propio se conserva', () => {
    expect(css).toMatch(/@layer base \{/);
    expect(css).toMatch(/html\[data-pos-tactil\]/);
  });

  it('cubre botones, pestañas, campos y enlaces del menú', () => {
    for (const parte of [
      'button',
      "[role='tab']",
      "[role='combobox']",
      'nav a[href]',
      'textarea',
      'select',
    ]) {
      expect(css).toContain(parte);
    }
  });

  it('los interruptores y las casillas ganan un área de 44 px sin estirarse', () => {
    expect(css).toContain("[role='switch'], [role='checkbox'])::after");
    expect(css).toContain('width: max(100%, var(--altura-tactil));');
  });

  it('los enlaces con forma de botón (`inline-flex`) también', () => {
    expect(css).toContain("a[href][class*='inline-flex']");
  });

  it('no deforma interruptores, casillas ni opciones', () => {
    expect(css).toMatch(/:not\(\[role='switch'\], \[role='checkbox'\], \[role='radio'\]/);
  });
});
