import { describe, expect, it } from 'vitest';

import { mismoOrden, moverEnLaLista, ordenarMenu } from './orden-del-menu.ts';

/** DP-24 · 3.1 · UN SOLO ORDEN del menú: categoría, luego lugar en la categoría, luego nombre. */
describe('ordenarMenu', () => {
  const categorias = [
    { id: 'sopas', nombre: 'Las sopas', orden: 2 },
    { id: 'empezar', nombre: 'Para empezar', orden: 1 },
    { id: 'dulce', nombre: 'Lo dulce', orden: 3 },
  ];
  const p = (id: string, categoria_id: string | null, orden: number | null, nombre = id) => ({
    id,
    nombre,
    categoria_id,
    orden_en_categoria: orden,
  });

  it('manda el orden de la categoría, no el nombre del producto', () => {
    const lista = [
      p('arroz', 'sopas', null),
      p('quesadilla', 'empezar', null),
      p('flan', 'dulce', null),
    ];
    expect(ordenarMenu(lista, categorias).map((x) => x.id)).toEqual([
      'quesadilla',
      'arroz',
      'flan',
    ]);
  });

  it('dentro de la categoría manda el lugar que se le dio', () => {
    const lista = [p('c', 'empezar', 3), p('a', 'empezar', 1), p('b', 'empezar', 2)];
    expect(ordenarMenu(lista, categorias).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('sin orden asignado: al final de su categoría y, entre ellos, por nombre', () => {
    const lista = [
      p('z', 'empezar', null, 'Zanahoria'),
      p('b', 'empezar', 2, 'Bolillo'),
      p('a', 'empezar', null, 'Aguacate'),
      p('c', 'empezar', 1, 'Caldo'),
    ];
    expect(ordenarMenu(lista, categorias).map((x) => x.id)).toEqual(['c', 'b', 'a', 'z']);
  });

  it('mientras nadie ordene, queda por nombre (con acentos como el español)', () => {
    const lista = [
      p('1', 'empezar', null, 'Nopales'),
      p('2', 'empezar', null, 'Ábaco'),
      p('3', 'empezar', null, 'Guacamole'),
    ];
    expect(ordenarMenu(lista, categorias).map((x) => x.nombre)).toEqual([
      'Ábaco',
      'Guacamole',
      'Nopales',
    ]);
  });

  it('un producto sin categoría, o con una que no existe, va al final del menú', () => {
    const lista = [p('suelto', null, 1), p('fantasma', 'nada', 1), p('flan', 'dulce', null)];
    expect(ordenarMenu(lista, categorias).map((x) => x.id)).toEqual(['flan', 'fantasma', 'suelto']);
  });

  it('las categorías sin orden van tras las ordenadas, por nombre', () => {
    const cats = [
      { id: 'x', nombre: 'Zeta', orden: null },
      { id: 'y', nombre: 'Alfa', orden: null },
      { id: 'z', nombre: 'Primera', orden: 1 },
    ];
    const lista = [p('1', 'x', null), p('2', 'y', null), p('3', 'z', null)];
    expect(ordenarMenu(lista, cats).map((x) => x.id)).toEqual(['3', '2', '1']);
  });

  it('no cambia la lista que recibe', () => {
    const lista = [p('b', 'empezar', 2), p('a', 'empezar', 1)];
    const copia = JSON.parse(JSON.stringify(lista)) as typeof lista;
    ordenarMenu(lista, categorias);
    expect(lista).toEqual(copia);
  });

  it('con la misma entrada da siempre el mismo orden (los empates se desatan por id)', () => {
    const lista = [p('b', 'empezar', 1, 'Igual'), p('a', 'empezar', 1, 'Igual')];
    expect(ordenarMenu(lista, categorias).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('moverEnLaLista y mismoOrden', () => {
  it('sube y baja un lugar, y en la orilla no hace nada', () => {
    expect(moverEnLaLista(['a', 'b', 'c'], 'b', 'arriba')).toEqual(['b', 'a', 'c']);
    expect(moverEnLaLista(['a', 'b', 'c'], 'b', 'abajo')).toEqual(['a', 'c', 'b']);
    expect(moverEnLaLista(['a', 'b', 'c'], 'a', 'arriba')).toEqual(['a', 'b', 'c']);
    expect(moverEnLaLista(['a', 'b', 'c'], 'c', 'abajo')).toEqual(['a', 'b', 'c']);
    expect(moverEnLaLista(['a', 'b', 'c'], 'x', 'abajo')).toEqual(['a', 'b', 'c']);
  });

  it('dice si dos listas están en el mismo orden', () => {
    expect(mismoOrden(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(mismoOrden(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(mismoOrden(['a'], ['a', 'b'])).toBe(false);
  });
});
