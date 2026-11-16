import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 15 · O12 · NINGÚN `color-mix` EN LÍNEA.
 *
 * El plugin del modo compatible (`scripts/modo-compatible/`) respalda las mezclas de la HOJA; un
 * `style={{ … }}` o un literal de JavaScript no lo ve, y en el motor del iMin (Chromium < 111) el
 * estilo entero se tira. Un color calculado va por `veloDeColor` (`velo-de-color.ts`), que lo hace en
 * JS con su respaldo. Las únicas excepciones: el propio `veloDeColor` (el respaldo moderno) y las
 * sondas, que PREGUNTAN al motor si entiende `color-mix` (`CSS.supports`). Se valida mutando el código.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

const PERMITIDOS = new Set(['src/compatibilidad/velo-de-color.ts', 'src/compatibilidad/sondas.ts']);

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return nombre === 'node_modules' ? [] : archivos(ruta);
    return /\.(tsx?|jsx?)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

const hallados = [...archivos(join(RAIZ, 'src')), ...archivos(join(RAIZ, 'heredado'))]
  .map((ruta) => ({
    ruta: relative(RAIZ, ruta).split(sep).join('/'),
    codigo: readFileSync(ruta, 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
      .join('\n'),
  }))
  .filter(({ codigo }) => codigo.includes('color-mix('));

describe('ningún color-mix escrito en JavaScript', () => {
  it('sólo el respaldo y las sondas lo mencionan', () => {
    const sueltos = hallados.map((h) => h.ruta).filter((r) => !PERMITIDOS.has(r));
    expect(sueltos, 'color-mix en línea: usa veloDeColor').toEqual([]);
  });

  it('la pantalla del PIN pinta el velo de la cara con veloDeColor', () => {
    const pin = readFileSync(join(RAIZ, 'src/restaurante/AccesoPorPin.tsx'), 'utf8');
    expect(pin).toMatch(/veloDeColor\(empleado\.color, 16\)/);
  });
});
