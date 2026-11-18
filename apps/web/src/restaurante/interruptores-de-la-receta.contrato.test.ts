import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-22 · Los dos interruptores del editor de la receta («Activo» y «Visible en POS») tienen nombre
 * accesible. Su `<Label>` no estaba asociado a ellos (sin `htmlFor`), así que el lector de pantalla —y
 * `getByRole('switch', { name })`— no los encontraba por nombre: «Visible en POS» es justo lo que
 * oculta un platillo del portal y de todas las cajas. Se valida mutando el código real.
 */
const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const dialogo = readFileSync(
  join(RAIZ, 'heredado', 'components', 'recetas', 'RecetaFormDialog.jsx'),
  'utf8',
);

describe('los interruptores del editor de la receta', () => {
  it.each([
    ['Activo', 'producto.activo'],
    ['Visible en POS', 'producto.visible_en_pos'],
  ])('«%s» trae su nombre accesible', (nombre, campo) => {
    const interruptor = new RegExp(
      String.raw`<Switch\s+aria-label="${nombre}"\s+checked=\{${campo.replace('.', String.raw`\.`)}\}`,
    );
    expect(dialogo).toMatch(interruptor);
  });
});
