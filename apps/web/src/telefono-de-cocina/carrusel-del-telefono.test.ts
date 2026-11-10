import { describe, expect, it } from 'vitest';

import {
  chipsDeLaTira,
  comandaALaVista,
  comandasDeLaPantalla,
  fraseDeLaLlegada,
  indiceALaVista,
  notaDelPlatillo,
  ordenarComandas,
  platillosDeLaComanda,
  porAnunciarLasNuevas,
  textoDeLaOpcion,
} from './carrusel-del-telefono.ts';
import type { ComandaDelTelefono, MesaDelTelefono } from './pantalla-del-telefono.ts';

/**
 * DP-16 · 2.3 · EL CARRUSEL DEL TELÉFONO SIN PANTALLA.
 *
 * El orden (la más vieja primero), qué comanda está a la vista según el desplazamiento, qué se
 * anuncia por voz y la frase corta de cada llegada.
 */

type Platillo = ComandaDelTelefono['platillos'][number];

const platillo = (extra: Partial<Platillo> = {}): Platillo => ({
  nombre: 'Taco',
  cantidad: '1.0000',
  porPeso: false,
  unidadVariable: null,
  cantidadVariable: null,
  notas: null,
  opciones: [],
  ...extra,
});

const comanda = (id: string, extra: Partial<ComandaDelTelefono> = {}): ComandaDelTelefono => ({
  id,
  estado: 'nuevo',
  mesaNumero: 4,
  nombrePedido: null,
  canal: 'aqui',
  numeroPedido: null,
  creadaEn: '2026-11-10T18:00:00.000Z',
  notas: null,
  alergias: null,
  celebracion: false,
  tipoCelebracion: null,
  platillos: [platillo()],
  ...extra,
});

describe('la nota sin el pliegue de las opciones', () => {
  it('el mesero escribe las opciones también en la nota: el teléfono deja sólo lo escrito a mano', () => {
    const conPliegue = platillo({
      notas: 'Relleno: Queso · bien dorada',
      opciones: [{ grupo: 'Relleno', nombres: ['Queso'] }],
    });
    expect(notaDelPlatillo(conPliegue)).toBe('bien dorada');
    const soloPliegue = platillo({
      notas: 'Relleno: Queso',
      opciones: [{ grupo: 'Relleno', nombres: ['Queso'] }],
    });
    expect(notaDelPlatillo(soloPliegue)).toBe('');
    // Y la voz no la cuenta como nota.
    expect(fraseDeLaLlegada(comanda('x', { platillos: [conPliegue, soloPliegue] }))).toBe(
      'Mesa 4: 2 platillos, 1 con nota',
    );
  });

  it('sin opciones estructuradas (una comanda vieja), la nota sale entera', () => {
    expect(notaDelPlatillo(platillo({ notas: 'Relleno: Queso' }))).toBe('Relleno: Queso');
  });
});

describe('la frase corta de una llegada', () => {
  it('mesa: «Mesa 4: 7 platillos, 2 con nota»', () => {
    const c = comanda('a', {
      platillos: [
        platillo({ cantidad: '3.0000', notas: 'sin cebolla' }),
        platillo({ cantidad: '2.0000' }),
        platillo({ cantidad: '2.0000', notas: 'bien cocido' }),
      ],
    });
    expect(fraseDeLaLlegada(c)).toBe('Mesa 4: 7 platillos, 2 con nota');
  });

  it('para llevar: «Para llevar 3: 4 platillos», sin «con nota» si no hay', () => {
    const c = comanda('a', {
      mesaNumero: null,
      canal: 'llevar',
      numeroPedido: 3,
      platillos: [platillo({ cantidad: '4.0000', notas: '  ' })],
    });
    expect(fraseDeLaLlegada(c)).toBe('Para llevar 3: 4 platillos');
  });

  it('un solo platillo va en singular y una alergia nunca se calla', () => {
    expect(fraseDeLaLlegada(comanda('a'))).toBe('Mesa 4: 1 platillo');
    expect(fraseDeLaLlegada(comanda('a', { alergias: 'cacahuate' }))).toBe(
      'Mesa 4: 1 platillo, con alergia',
    );
  });

  it('lo que va por peso cuenta como un platillo, no como 0.5', () => {
    const c = comanda('a', { platillos: [platillo({ porPeso: true, cantidad: '0.5000' })] });
    expect(platillosDeLaComanda(c)).toBe(1);
  });
});

describe('el orden', () => {
  it('de la más vieja a la más nueva; a igual hora, por id', () => {
    const lista = ordenarComandas([
      comanda('c', { creadaEn: '2026-11-10T18:05:00.000Z' }),
      comanda('b', { creadaEn: '2026-11-10T18:00:00.000Z' }),
      comanda('a', { creadaEn: '2026-11-10T18:00:00.000Z' }),
    ]);
    expect(lista.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('con un servidor viejo (sin `comandas`) usa la única `comanda`', () => {
    const una = comanda('x');
    expect(comandasDeLaPantalla({ comanda: una }).map((c) => c.id)).toEqual(['x']);
    expect(comandasDeLaPantalla({ comanda: null })).toEqual([]);
  });
});

describe('qué comanda está a la vista', () => {
  it('el índice sale del desplazamiento, redondeado y acotado', () => {
    expect(indiceALaVista(0, 300, 3)).toBe(0);
    expect(indiceALaVista(149, 300, 3)).toBe(0);
    expect(indiceALaVista(151, 300, 3)).toBe(1);
    expect(indiceALaVista(900, 300, 3)).toBe(2);
    expect(indiceALaVista(-50, 300, 3)).toBe(0);
    expect(indiceALaVista(10, 0, 3)).toBe(0);
    expect(indiceALaVista(10, 300, 0)).toBe(0);
  });

  it('si la que se miraba sigue ahí, sigue; si llega una nueva, la vista no se mueve', () => {
    const antes = [comanda('a'), comanda('b')];
    const despues = [...antes, comanda('c')];
    expect(comandaALaVista(despues, 'b', 0)?.id).toBe('b');
  });

  it('si la que se miraba se fue, queda la que ocupa su lugar; la última si era la última', () => {
    expect(comandaALaVista([comanda('a'), comanda('c')], 'b', 1)?.id).toBe('c');
    expect(comandaALaVista([comanda('a'), comanda('b')], 'z', 2)?.id).toBe('b');
    expect(comandaALaVista([], 'a', 0)).toBeNull();
  });
});

describe('qué se anuncia', () => {
  it('la primera lectura no anuncia nada', () => {
    expect(porAnunciarLasNuevas([comanda('a')], null)).toEqual([]);
  });

  it('después, sólo las que no se habían anunciado, en su orden', () => {
    const nuevas = porAnunciarLasNuevas([comanda('a'), comanda('b'), comanda('c')], new Set(['a']));
    expect(nuevas.map((c) => c.id)).toEqual(['b', 'c']);
  });
});

describe('la tira y las opciones', () => {
  const mesa = (comandaId: string, extra: Partial<MesaDelTelefono> = {}): MesaDelTelefono => ({
    comandaId,
    estado: 'nuevo',
    mesaNumero: 4,
    nombrePedido: null,
    canal: 'aqui',
    numeroPedido: null,
    ...extra,
  });

  it('cada chip lleva rótulo, estado en texto y su lugar en el carrusel (null si ya no tiene)', () => {
    const chips = chipsDeLaTira(
      [
        mesa('a'),
        mesa('b', { estado: 'listo', mesaNumero: null, canal: 'llevar', numeroPedido: 3 }),
      ],
      [comanda('a')],
    );
    expect(chips[0]).toMatchObject({ rotulo: 'Mesa 4', estadoDicho: 'Nueva', indice: 0 });
    expect(chips[1]).toMatchObject({
      rotulo: 'PARA LLEVAR · 3',
      estadoDicho: 'Lista',
      indice: null,
    });
  });

  it('una opción se dice «Grupo: a, b»', () => {
    expect(textoDeLaOpcion({ grupo: 'Salsa', nombres: ['verde', 'roja'] })).toBe(
      'Salsa: verde, roja',
    );
  });
});
