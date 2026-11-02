import { describe, expect, it } from 'vitest';

import {
  alturaDeLaMarca,
  alturaDeUnRenglon,
  cajaDelBoton,
  platillosDelBoton,
  precioDelBoton,
} from './botones-de-pagina.ts';

/**
 * DP-9.7 · LOS BOTONES SOBRE LA PÁGINA, del lado de la pantalla.
 *
 * En % de la imagen (iguales en cualquier teléfono y con zoom), con los platillos que el portal
 * sí tiene y el precio VIGENTE sólo si el botón lo pide y el negocio enseña precios.
 */
describe('los botones de una página', () => {
  it('se colocan en % de la imagen', () => {
    expect(cajaDelBoton({ x: 8.7, y: 37.98, ancho: 82.59, alto: 3.91 })).toEqual({
      left: '8.7%',
      top: '37.98%',
      width: '82.59%',
      height: '3.91%',
    });
  });

  it('sus platillos, en su orden, y sólo los que el portal tiene', () => {
    const productos = [{ id: 'a' }, { id: 'b' }];
    expect(platillosDelBoton({ productoIds: ['b', 'x', 'a'] }, productos)).toEqual([
      { id: 'b' },
      { id: 'a' },
    ]);
  });

  it('DP-12.6 · el alto de UN renglón es el del botón más bajo de la página', () => {
    expect(alturaDeUnRenglon([{ alto: 5.07 }, { alto: 2.75 }, { alto: 3.91 }])).toBe(2.75);
    // Sin botones no hay renglón que medir: se devuelve algo que nunca encoge una marca.
    expect(alturaDeUnRenglon([])).toBe(100);
  });

  it('DP-12.6 · la marca mide un renglón, anclada arriba, y nunca más que el botón', () => {
    // Un botón de una línea: la marca lo cubre entero.
    expect(alturaDeLaMarca({ alto: 2.75 }, 2.75)).toBe(100);
    // Uno de dos líneas (nombre y detalle): la marca cubre la primera, donde va el precio impreso.
    expect(alturaDeLaMarca({ alto: 5.5 }, 2.75)).toBe(50);
    // Un botón más bajo que un renglón (lo dibujó la dueña a mano): entero, no más.
    expect(alturaDeLaMarca({ alto: 2 }, 2.75)).toBe(100);
  });

  it('el precio vigente: sólo si el botón lo pide, si hay precios y si es un precio', () => {
    const taco = { precio_venta_centavos: '3500' };
    expect(precioDelBoton({ mostrarPrecio: true }, taco, true)).toBe(3500);
    expect(precioDelBoton({ mostrarPrecio: false }, taco, true)).toBeNull();
    expect(precioDelBoton({ mostrarPrecio: true }, taco, false)).toBeNull();
    expect(
      precioDelBoton({ mostrarPrecio: true }, { precio_venta_centavos: null }, true),
    ).toBeNull();
    expect(precioDelBoton({ mostrarPrecio: true }, undefined, true)).toBeNull();
  });
});
