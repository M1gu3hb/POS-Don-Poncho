import { describe, expect, it } from 'vitest';

import {
  centavosDeLasOpciones,
  etiquetaDelPrecio,
  precioConOpciones,
} from './precio-de-las-opciones';

describe('DP-16 · el precio de las opciones en la pantalla', () => {
  const elegidas = [
    { opciones: [{ precioCentavos: '1500' }, { precioCentavos: '-500' }] },
    { opciones: [{ precioCentavos: '0' }] },
  ];

  it('suma lo que suman y resta lo que restan', () => {
    expect(centavosDeLasOpciones(elegidas)).toBe(1_000);
    expect(centavosDeLasOpciones(undefined)).toBe(0);
  });

  it('el precio de la unidad con sus opciones, sin bajar de cero', () => {
    expect(precioConOpciones(95, elegidas)).toBe(105);
    expect(precioConOpciones(3, [{ opciones: [{ precioCentavos: -1000 }] }])).toBe(0);
  });

  it('la etiqueta dice el signo y el monto, o nada', () => {
    expect(etiquetaDelPrecio('1500')).toMatch(/^\+\$15\.00$/);
    expect(etiquetaDelPrecio(-500)).toMatch(/^−\$5\.00$/);
    expect(etiquetaDelPrecio('0')).toBe('');
  });
});
