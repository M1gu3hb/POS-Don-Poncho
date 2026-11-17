import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * A10 · «EDITAR RECETA» SÓLO CON EL RENGLÓN ABIERTO.
 *
 * El contenido del renglón se pliega con `grid-template-rows: 0fr`, pero los botones seguían en la
 * página (a la vista de los lectores de pantalla, del tabulador y de un navegador viejo que no
 * anima esa propiedad). Contrato sobre el texto de la pantalla: «Editar receta» (y los botones que
 * lo acompañan) sólo se pintan dentro de `{open && (…)}`.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..');
const RUTA = 'apps/web/heredado/components/recetas/RecetaAccordionRow.jsx';

/** El texto sin comentarios de JSX ni de línea: lo que dicen no cuenta para el contrato. */
function sinComentarios(texto: string): string {
  return texto.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
}

const fuente = sinComentarios(readFileSync(join(RAIZ, RUTA), 'utf8'));

/** Cuántas llaves y paréntesis siguen abiertos al final del trozo. */
function profundidad(trozo: string): number {
  let nivel = 0;
  for (const letra of trozo) {
    if (letra === '{' || letra === '(') nivel += 1;
    if (letra === '}' || letra === ')') nivel -= 1;
  }
  return nivel;
}

const GUARDA = '{open && (';

describe('Editar receta · sólo con el renglón abierto', () => {
  const editar = fuente.indexOf('Editar receta');
  const guarda = fuente.lastIndexOf(GUARDA, editar);

  it('hay un botón «Editar receta» en la fila de acciones', () => {
    expect(editar).toBeGreaterThan(0);
  });

  it('el botón queda dentro de `{open && (…)}`, sin que la guarda se cierre antes', () => {
    expect(guarda).toBeGreaterThan(-1);
    const condicion = fuente.lastIndexOf('{!readOnly && onEdit', editar);
    expect(condicion).toBeGreaterThan(guarda);
    expect(profundidad(fuente.slice(guarda, condicion))).toBeGreaterThanOrEqual(2);
  });

  it('la guarda es la del renglón: está después de la cabecera que lo abre y cierra', () => {
    const cabecera = fuente.indexOf('aria-expanded={open}');
    expect(cabecera).toBeGreaterThan(-1);
    expect(guarda).toBeGreaterThan(cabecera);
  });

  it('la guarda cubre también «Eliminar receta»: tampoco se ofrece con el renglón cerrado', () => {
    const eliminar = fuente.indexOf('Eliminar receta', editar);
    expect(eliminar).toBeGreaterThan(editar);
    const condicion = fuente.lastIndexOf('{!readOnly && onDelete', eliminar);
    expect(condicion).toBeGreaterThan(editar);
    expect(profundidad(fuente.slice(guarda, condicion))).toBeGreaterThanOrEqual(2);
  });

  it('conserva sus propias condiciones (sólo lectura, y que haya a dónde ir)', () => {
    expect(fuente).toMatch(
      /\{!readOnly && onEdit && \(\s*<Button[^>]*onClick=\{\(\) => onEdit\?\.\(producto\)\}/,
    );
  });
});
