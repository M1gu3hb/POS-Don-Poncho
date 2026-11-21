import { describe, expect, it } from 'vitest';

import { entidadMapeada } from './mapa.ts';

/** DP-24 · 3.1 · El puente LEE el lugar del producto, pero no lo deja escribir: sólo el comando. */
describe('ProductoTerminado · orden_en_categoria', () => {
  it('se lee por el puente (la rejilla del mesero y la de la Caja) y no se escribe por él', () => {
    const producto = entidadMapeada('ProductoTerminado');
    expect(producto?.campos['orden_en_categoria']).toMatchObject({
      columna: 'orden_en_categoria',
      conversion: 'entero',
      escribible: false,
    });
  });

  it('el color de la categoría se lee y se escribe por el puente (con la paleta de las pantallas)', () => {
    const categoria = entidadMapeada('CategoriaProducto');
    expect(categoria?.campos['color']).toMatchObject({ columna: 'color', conversion: 'texto' });
    expect(categoria?.campos['color']?.escribible).not.toBe(false);
  });
});
