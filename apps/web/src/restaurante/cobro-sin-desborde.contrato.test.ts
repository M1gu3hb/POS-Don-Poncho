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

/**
 * DP-24 · El cobro es la TARJETA DE COBRO (`src/venta/TarjetaDeCobro.tsx`): más ancha, casi cuadrada
 * y en dos columnas. La regla de DP-15 sigue siendo la misma y se vigila ahí: nada se sale de la
 * tarjeta. La tarjeta no pasa del alto de la pantalla (y se desplaza si no cabe), cada columna puede
 * encogerse (`minmax(0, …)`) y los botones que cambian la cuenta se envuelven.
 */
describe('DP-15 · la tarjeta de cobro', () => {
  const tarjeta = readFileSync(
    join(RAIZ_WEB, 'src', 'venta', 'TarjetaDeCobro.tsx'),
    'utf8',
  ).replace(/\s+/g, ' ');

  it('cabe en la pantalla: tiene tope de alto y de ancho, y se desplaza si el contenido no cabe', () => {
    const contenido = tarjeta.slice(tarjeta.indexOf('<DialogContent'));
    const clases = contenido.slice(0, contenido.indexOf('>'));
    expect(clases).toContain('max-h-[96vh]');
    expect(clases).toContain('overflow-y-auto');
    expect(clases).toContain('max-w-[calc(100%-1rem)]');
    expect(clases).toContain('sm:max-w-[min(97vw,70rem)]');
  });

  it('sus dos columnas pueden encogerse y los botones de la cuenta se envuelven', () => {
    expect(tarjeta).toContain('md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]');
    // Los botones de la cuenta van en rejilla y su texto se parte en vez de empujar la columna.
    expect(tarjeta).toContain('<div className="grid grid-cols-3 gap-(--espacio-1)');
    expect(tarjeta).toContain('[&>button]:whitespace-normal');
    expect(tarjeta).toContain('[&>button]:min-h-11');
  });
});
