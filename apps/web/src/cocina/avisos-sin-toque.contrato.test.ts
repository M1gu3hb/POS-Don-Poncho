import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-25 · Parte 4 · LOS AVISOS DE LA COCINA NO RECIBEN TOQUES.
 *
 * Cada toque de la cocina («Preparar», «Listo», «Todo listo», «Quitar de la lista») sacaba su aviso de
 * éxito, y en el teléfono y la tableta se apilaban hasta cuatro sobre las tarjetas. El toque siguiente
 * caía sobre el aviso (el navegador sí veía el clic) y no sobre el botón: el «Preparar» que se perdía y
 * dejaba la mesa sin avanzar. La prueba de navegador (`mini-jornada-de-cocina`, CPU 4×) lo atrapa de
 * verdad; ésta ata el código: TODO aviso de éxito que sale de mover un platillo, un bloque o quitarlo
 * lleva `pointer-events: none`.
 */

const fuente = readFileSync(join(__dirname, '..', '..', 'heredado', 'pages', 'Cocina.jsx'), 'utf8')
  // Sin comentarios: lo que se afirma es el código, no una frase que lo nombra.
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** El cuerpo de una función de la pantalla, de su nombre al siguiente `const` de ese nivel. */
function cuerpoDe(nombre: string): string {
  const inicio = fuente.indexOf(`const ${nombre} = async`);
  expect(inicio, `no está ${nombre}`).toBeGreaterThanOrEqual(0);
  const resto = fuente.slice(inicio + 1);
  const fin = resto.search(/\n {2}(?:\/\/ )?(?:const|if|return)\s/);
  return resto.slice(0, fin === -1 ? undefined : fin);
}

describe('los avisos de éxito de la cocina', () => {
  it('el aviso que no recibe toques deja pasar el toque (pointer-events: none)', () => {
    expect(fuente).toMatch(
      /const AVISO_SIN_TOQUE = \{\s*style:\s*\{\s*pointerEvents:\s*'none'\s*\}\s*\};/,
    );
  });

  it('el Toaster global NO deja de recibir toques: un aviso con botón (Deshacer, Reintentar, Ver) sigue tocable', () => {
    for (const ruta of [
      join(__dirname, '..', 'proveedores', 'Proveedores.tsx'),
      join(__dirname, '..', '..', 'heredado', 'components', 'ui', 'toaster.jsx'),
    ]) {
      let texto = '';
      try {
        texto = readFileSync(ruta, 'utf8');
      } catch {
        continue; // ese archivo no existe en este árbol: no hay nada que afirmar sobre él
      }
      expect(texto, ruta).not.toMatch(/pointer-?events/i);
    }
  });

  it('sólo los avisos informativos de la cocina lo llevan: ninguno con acción ni con botón', () => {
    const usos = [...fuente.matchAll(/toast\.[a-z]+\(([^;]*?AVISO_SIN_TOQUE[^;]*?)\);/g)];
    expect(usos.length).toBeGreaterThan(0);
    for (const uso of usos) expect(uso[1]).not.toMatch(/\b(action|cancel|onClick)\b/);
    // Y el objeto en sí no trae acción: es sólo estilo.
    const objeto = /const AVISO_SIN_TOQUE = (\{[^;]*\});/.exec(fuente)?.[1] ?? '';
    expect(objeto).not.toMatch(/\b(action|cancel)\b/);
  });

  it.each(['moverPlatillo', 'moverBloque', 'quitarBloqueListo'])(
    '%s: cada toast.success lleva AVISO_SIN_TOQUE',
    (funcion) => {
      const exitos = [...cuerpoDe(funcion).matchAll(/toast\.success\(([^;]*?)\);/g)];
      expect(exitos.length).toBeGreaterThan(0);
      for (const exito of exitos) expect(exito[1]).toMatch(/,\s*AVISO_SIN_TOQUE\s*,?\s*$/);
    },
  );
});
