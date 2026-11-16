import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 16 (M21) · LOS BLANCOS TÁCTILES: el cableado, leído.
 *
 * La primera versión ponía un PISO GLOBAL (`min-height: 44px` a todo botón, pestaña, campo y enlace
 * del menú cuando hay un dedo). Estuvo una mañana en producción y se quitó: un `min-height`
 * explícito sustituye al mínimo automático (`min-height: auto`), que es el que hace que un botón
 * con forma de tarjeta nunca mida menos que su contenido. Con él, las tarjetas de platillos del
 * mesero —botones dentro de una rejilla con desplazamiento y filas automáticas— se aplastaban a
 * 44 px con el precio encima del borde, en el teléfono y en el iMin. Con ratón no pasaba: ni la
 * galería ni las e2e de escritorio lo vieron; lo enseñó una captura del simulador.
 *
 * Lo que queda: el token, y el área de toque de interruptores y casillas (un pseudo-elemento, que
 * no cambia el tamaño de nada). Un blanco de 44 px se da POR COMPONENTE, con su clase
 * (`any-pointer-coarse:min-h-(--altura-tactil)`), donde se sabe que el contenido cabe.
 * Se valida mutando el código real.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const css = readFileSync(join(RAIZ, 'src/tacto/blancos-tactiles.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

describe('la hoja de los blancos táctiles', () => {
  it('la importa la hoja global', () => {
    expect(readFileSync(join(RAIZ, 'app/globals.css'), 'utf8')).toMatch(
      /@import '\.\.\/src\/tacto\/blancos-tactiles\.css';/,
    );
  });

  it('el token vale 44 px (2.75rem)', () => {
    expect(css).toMatch(/--altura-tactil: 2\.75rem;/);
  });

  it('NO pone un mínimo global: aplasta las tarjetas que son botones dentro de una rejilla', () => {
    expect(css).not.toMatch(/\bmin-height\b/);
    expect(css).not.toMatch(/\bmin-width\b/);
    expect(css).not.toMatch(/\bmin-block-size\b|\bmin-inline-size\b/);
    // Ni por otro camino: ningún selector global de botones, pestañas, campos o enlaces.
    expect(css).not.toMatch(/:is\(\s*button\b/);
    expect(css).not.toContain("[role='tab']");
    expect(css).not.toContain('nav a[href]');
  });

  it('los interruptores y las casillas ganan un área de 44 px sin cambiar de tamaño', () => {
    expect(css).toContain("[role='switch'], [role='checkbox'])::after");
    expect(css).toContain('width: max(100%, var(--altura-tactil));');
    expect(css).toContain('height: max(100%, var(--altura-tactil));');
  });

  it('sólo donde hay un dedo, sólo en el POS y en `@layer base`', () => {
    const inicio = css.indexOf('@media (any-pointer: coarse)');
    expect(inicio).toBeGreaterThan(-1);
    expect(css.slice(0, inicio)).not.toContain('::after');
    expect(css).toMatch(/@layer base \{/);
    expect(css).toMatch(/html\[data-pos-tactil\]/);
  });
});

describe('la rejilla de platillos del mesero', () => {
  it('sus tarjetas son botones dentro de una rejilla con desplazamiento: por eso no hay piso global', () => {
    const mesero = readFileSync(join(RAIZ, 'heredado/pages/Mesero.jsx'), 'utf8');
    // Si esta rejilla cambia de forma, hay que volver a medirla con el dedo antes de tocar la hoja.
    expect(mesero).toContain(
      'flex-1 overflow-y-auto p-3 pb-32 md:pb-3 grid grid-cols-2 gap-2 content-start',
    );
  });
});
