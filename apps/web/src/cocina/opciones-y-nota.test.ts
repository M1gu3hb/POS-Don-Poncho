import { describe, expect, it } from 'vitest';

import { opcionesDelServidor, separarOpcionesYNota } from './opciones-y-nota';

/**
 * DP-16 · 2.2 · LAS OPCIONES SE LEEN APARTE DE LA NOTA.
 *
 * El mesero y el portal pliegan «Grupo: opción» dentro de la nota; con la instantánea estructurada
 * (`orden_lineas.opciones`) la cocina las muestra aparte y la nota queda sólo con lo que escribió
 * la persona. Sin instantánea (comandas de antes), la nota se enseña tal cual: nada se esconde.
 */

const RELLENO = [{ grupo: 'Relleno', opciones: ['Queso'] }];

describe('separarOpcionesYNota', () => {
  it('quita de la nota el pliegue de las opciones y deja la nota propia', () => {
    expect(separarOpcionesYNota('Relleno: Queso — sin cebolla', RELLENO)).toEqual({
      opciones: RELLENO,
      nota: 'sin cebolla',
    });
  });

  it('con varios grupos y separadores de punto medio', () => {
    const opciones = [
      { grupo: 'Relleno', opciones: ['Queso'] },
      { grupo: 'Extras', opciones: ['Crema', 'Salsa'] },
    ];
    expect(
      separarOpcionesYNota('Relleno: Queso · Extras: Crema, Salsa — bien dorada', opciones),
    ).toEqual({ opciones, nota: 'bien dorada' });
  });

  it('si la nota era sólo el pliegue, la nota queda vacía', () => {
    expect(separarOpcionesYNota('Relleno: Queso', RELLENO)).toEqual({
      opciones: RELLENO,
      nota: '',
    });
  });

  it('lo que la persona escribió con otra forma se conserva entero', () => {
    expect(separarOpcionesYNota('Relleno especial: sin sal', RELLENO)).toEqual({
      opciones: RELLENO,
      nota: 'Relleno especial: sin sal',
    });
  });

  it('sin opciones estructuradas la nota se enseña tal cual', () => {
    expect(separarOpcionesYNota('Relleno: Queso · bien dorada', [])).toEqual({
      opciones: [],
      nota: 'Relleno: Queso · bien dorada',
    });
    expect(separarOpcionesYNota('Relleno: Queso', null)).toEqual({
      opciones: [],
      nota: 'Relleno: Queso',
    });
  });

  it('notas ausentes dan nota vacía', () => {
    expect(separarOpcionesYNota(null, RELLENO)).toEqual({ opciones: RELLENO, nota: '' });
    expect(separarOpcionesYNota(undefined, [])).toEqual({ opciones: [], nota: '' });
  });
});

describe('opcionesDelServidor', () => {
  it('toma grupo y nombres, sin ids ni nada más', () => {
    expect(
      opcionesDelServidor([
        {
          grupoId: 'g1',
          grupo: 'Extras',
          precio: 500,
          opciones: [
            { id: 'o1', nombre: 'Crema', precio_centavos: 500 },
            { id: 'o2', nombre: 'Salsa' },
          ],
        },
      ]),
    ).toEqual([{ grupo: 'Extras', opciones: ['Crema', 'Salsa'] }]);
  });

  it('acepta el texto JSON y descarta lo que no tiene forma', () => {
    expect(
      opcionesDelServidor(
        JSON.stringify([{ grupo: 'Relleno', opciones: [{ nombre: 'Queso' }] }, { raro: 1 }, 3]),
      ),
    ).toEqual([{ grupo: 'Relleno', opciones: ['Queso'] }]);
    expect(opcionesDelServidor('no es json')).toEqual([]);
    expect(opcionesDelServidor(null)).toEqual([]);
    expect(opcionesDelServidor({})).toEqual([]);
  });
});
