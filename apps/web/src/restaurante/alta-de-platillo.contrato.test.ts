import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · EN EL RESTAURANTE TAMBIÉN SE DA DE ALTA UN PLATILLO (M3 de la auditoría).
 *
 * Con el módulo de recetas, Productos sólo ofrecía «Ir a Recetas», y «Nueva receta» se niega sin un
 * insumo registrado: el sábado no se podía dar de alta el platillo del día. Ahora quien escribe
 * productos (dueño, administrador, gerente) tiene «Agregar producto» también en el restaurante, y
 * «Ir a Recetas» sigue al lado.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const codigo = () =>
  readFileSync(join(RAIZ_WEB, 'heredado', 'pages', 'Productos.jsx'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\s+/g, '');

describe('DP-15 · alta de platillo en el restaurante', () => {
  it('«Agregar producto» se ofrece también con recetas, a quien escribe productos', () => {
    const c = codigo();
    expect(c).toContain('{(sinRecetas||PUEDEN_CREAR.includes(miPuesto))&&(<Button');
    expect(c).toContain("constPUEDEN_CREAR=['dueno','administrador','gerente'];");
    expect(c).toContain('{!sinRecetas&&(<Linkto="/recetas">');
  });
});
