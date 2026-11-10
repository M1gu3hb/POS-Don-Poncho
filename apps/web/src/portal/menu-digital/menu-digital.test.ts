import { describe, expect, it } from 'vitest';

import {
  fondoDeLaTarjeta,
  inicialDelPlatillo,
  precioDeLaTarjeta,
  SECCION_SIN_CATEGORIA,
  seccionALaVista,
  seccionesDelMenu,
} from './menu-digital';

const taco = { id: 't', nombre: 'Taco', categoria_id: 'c1', precio_venta: 35 };
const agua = { id: 'a', nombre: 'Agua', categoria_id: 'c2', precio_venta: 25 };
const raro = { id: 'r', nombre: 'Raro', categoria_id: 'c-borrada', precio_venta: 10 };

describe('seccionesDelMenu (DP-16 · el menú digital)', () => {
  it('una sección por categoría, en el orden de las categorías, sin las vacías', () => {
    const secciones = seccionesDelMenu(
      [agua, taco],
      [
        { id: 'c1', nombre: 'Tacos' },
        { id: 'c9', nombre: 'Postres' },
        { id: 'c2', nombre: 'Bebidas' },
      ],
    );
    expect(secciones.map((s) => [s.nombre, s.productos.map((p) => p.id)])).toEqual([
      ['Tacos', ['t']],
      ['Bebidas', ['a']],
    ]);
  });

  it('lo que no tiene categoría conocida va al final, en «Más»', () => {
    const secciones = seccionesDelMenu([raro, taco], [{ id: 'c1', nombre: 'Tacos' }]);
    expect(secciones.at(-1)).toEqual({
      id: SECCION_SIN_CATEGORIA,
      nombre: 'Más',
      productos: [raro],
    });
  });
});

describe('fondoDeLaTarjeta', () => {
  it('el elegido si es de la lista; si no (o nada), el de omisión', () => {
    expect(fondoDeLaTarjeta({ ...taco, fondo_tarjeta: 'ilustracion:talavera' })).toBe(
      'ilustracion:talavera',
    );
    expect(fondoDeLaTarjeta({ ...taco, fondo_tarjeta: 'red; background:url(x)' })).toBe(
      'color:crema',
    );
    expect(fondoDeLaTarjeta(taco)).toBe('color:crema');
  });

  it('sin elegir, alterna por su lugar en la sección (un menú sin fotos no es una pared lisa)', () => {
    expect([0, 1, 2, 3, 4].map((lugar) => fondoDeLaTarjeta(taco, lugar))).toEqual([
      'color:crema',
      'ilustracion:papel-picado',
      'degradado:papel',
      'ilustracion:talavera',
      'color:crema',
    ]);
    // Lo elegido manda sobre el lugar.
    expect(fondoDeLaTarjeta({ ...taco, fondo_tarjeta: 'color:marca' }, 3)).toBe('color:marca');
  });

  it('la inicial del platillo, en mayúscula', () => {
    expect(inicialDelPlatillo(' ñoquis')).toBe('Ñ');
    expect(inicialDelPlatillo('')).toBe('');
  });
});

describe('precioDeLaTarjeta', () => {
  it('pieza, por peso y por porción; nada si el negocio esconde precios', () => {
    expect(precioDeLaTarjeta(taco, true)).toBe('$35.00');
    expect(
      precioDeLaTarjeta(
        {
          ...taco,
          tipo_venta: 'variable_medida',
          precio_por_unidad_variable: 795,
          unidad_variable: 'kg',
        },
        true,
      ),
    ).toBe('$795.00 / kg');
    expect(
      precioDeLaTarjeta(
        {
          ...taco,
          tipo_venta: 'porcion_contenedor',
          precio_por_porcion: 40,
          nombre_porcion: 'shot',
        },
        true,
      ),
    ).toBe('$40.00 / shot');
    expect(precioDeLaTarjeta(taco, false)).toBeNull();
    expect(precioDeLaTarjeta({ ...taco, precio_venta: 0 }, true)).toBeNull();
  });
});

describe('seccionALaVista', () => {
  const posiciones = [
    { id: 'a', arriba: 120 },
    { id: 'b', arriba: 600 },
    { id: 'c', arriba: 1400 },
  ];
  it('la última que ya pasó bajo la barra; antes de la primera, la primera', () => {
    expect(seccionALaVista(posiciones, 130)).toBe('a');
    expect(seccionALaVista(posiciones, 100)).toBe('a');
    expect(seccionALaVista(posiciones, 650)).toBe('b');
    expect(seccionALaVista(posiciones, 2000)).toBe('c');
    expect(seccionALaVista([], 0)).toBeNull();
  });
});
