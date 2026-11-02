import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-12.5 · DESACTIVAR UNA ESTACIÓN NO DEJA CATEGORÍAS COLGADAS EN SILENCIO.
 *
 * Al desactivar una estación, Configuración mueve sus categorías a la general y luego la apaga.
 * Cada movimiento se tragaba su error (`.catch(() => {})`): si uno fallaba, la estación se
 * apagaba igual, la categoría quedaba apuntando a una estación apagada y la pantalla decía
 * «desactivada». Es JavaScript heredado que un test de componentes no alcanza: el contrato lee su
 * texto. Si un movimiento falla, no se apaga y se dice por qué.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const SECCION = 'heredado/components/configuracion/EstacionesPreparacionSection.jsx';

describe('desactivar una estación', () => {
  const texto = readFileSync(join(RAIZ, SECCION), 'utf8');
  const desactivar = texto.slice(
    texto.indexOf('const confirmarDesactivar'),
    texto.indexOf('const mover'),
  );

  it('mueve sus categorías sin tragarse el error de ninguna', () => {
    expect(desactivar).toMatch(/CategoriaProducto\.update\(c\.id, reasigna\)/);
    expect(desactivar).not.toMatch(/\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)/);
  });

  it('apaga la estación DESPUÉS de mover sus categorías', () => {
    const mueve = desactivar.indexOf('CategoriaProducto.update');
    const apaga = desactivar.indexOf('EstacionPreparacion.update(estacion.id, { activo: false })');
    expect(mueve).toBeGreaterThan(-1);
    expect(apaga).toBeGreaterThan(mueve);
  });
});
