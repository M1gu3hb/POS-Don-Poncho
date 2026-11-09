import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · EL DIÁLOGO «COBRAR» NO SE SALE DE SU TARJETA (M3 de la auditoría 1).
 *
 * El pie del cobro tenía cinco botones en una fila que no se envolvía (`DialogFooter` es
 * `sm:flex-row` sin `flex-wrap`). En una cuadrícula, esa fila dicta el ancho de la columna: a 768 px
 * o más, todo el contenido —importes, métodos, «Recibido», «Cobrar $…»— quedaba 300 px fuera de la
 * tarjeta de 448 px, sobre el velo oscuro. El pie ahora se envuelve y el diálogo es `sm:max-w-lg`.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

describe('DP-15 · el diálogo de cobro', () => {
  it('su pie se envuelve y el diálogo tiene ancho y alto para el contenido', () => {
    const c = readFileSync(join(RAIZ_WEB, 'heredado', 'pages', 'Caja.jsx'), 'utf8').replace(
      /\s+/g,
      ' ',
    );
    const cobro = c.slice(c.indexOf('{/* COBRO DIALOG */}'));
    expect(cobro).toContain('<DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">');
    expect(cobro).toContain('<DialogFooter className="flex-wrap gap-2 sm:space-x-0">');
  });
});
