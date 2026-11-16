import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 9 · M5 · EL SCROLL CON EL DEDO EN LAS LISTAS: lo que se puede leer del código.
 *
 * «Caja → Movimientos» no respondía bien al tacto. La causa que se encontró LEYENDO el código es la
 * raíz de la página de Caja: `overflow-x-hidden`. Un `overflow-x` distinto de `visible` obliga a que
 * `overflow-y` valga `auto`: la raíz se volvía un scroller vertical ANIDADO dentro de la página, y
 * basta un píxel de margen que se le desborde para que el dedo que empieza ahí lo agarre y no
 * arrastre la página. `overflow-x-clip` recorta lo mismo SIN crear un scroller (Chromium 90+; el
 * piso del POS es el 99). Lo que no se puede leer —cómo se siente en el iMin— lo comprueba
 * `pruebas/e2e/tactil-scroll.spec.ts` con un deslizamiento táctil por pantalla.
 *
 * Se valida mutando el código real.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

const PAGINAS = readdirSync(join(RAIZ, 'heredado', 'pages')).filter((n) => n.endsWith('.jsx'));

describe('ninguna página se envuelve en un scroller anidado', () => {
  it('encuentra las páginas (la búsqueda no está ciega)', () => {
    expect(PAGINAS.length).toBeGreaterThanOrEqual(10);
  });

  it.each(PAGINAS)(
    '%s no usa `overflow-x-hidden` (crea un scroller vertical dentro de la página)',
    (pagina) => {
      expect(leer(`heredado/pages/${pagina}`)).not.toMatch(/\boverflow-x-hidden\b/);
    },
  );

  it('la raíz de Caja recorta lo de los lados con `overflow-x-clip`', () => {
    expect(leer('heredado/pages/Caja.jsx')).toMatch(
      /className="space-y-4 px-1 sm:px-0 max-w-full overflow-x-clip"/,
    );
  });
});

describe('los diálogos y paneles largos se desplazan con el dedo por omisión', () => {
  const css = leer('src/tacto/desplazamiento-tactil.css');

  it('la importa la hoja global', () => {
    expect(leer('app/globals.css')).toMatch(
      /@import '\.\.\/src\/tacto\/desplazamiento-tactil\.css';/,
    );
  });

  it('va en `@layer base`: un diálogo que pide su propio alto (`max-h-[92vh]`) lo conserva', () => {
    expect(css).toMatch(/@layer base \{/);
  });

  it('el diálogo tiene tope de alto con el alto visible y se desplaza por dentro', () => {
    expect(css).toMatch(
      /\[data-slot='dialog-content'\][^{]*\{[^}]*max-height: calc\(var\(--alto-visible, 100vh\) - var\(--espacio-4\)\);/,
    );
    expect(css).toMatch(/overflow-y: auto;/);
  });

  it('el gesto no se le pasa a la página de atrás al llegar al final', () => {
    expect(css).toMatch(/overscroll-behavior: contain;/);
  });

  it('también el panel lateral', () => {
    expect(css).toMatch(/\[data-slot='sheet-content'\]/);
  });
});
