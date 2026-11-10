import { describe, expect, it } from 'vitest';

import { notaSinLasOpciones, renglonesDeLasOpciones } from './opciones-del-renglon';

const instantanea = [
  {
    grupoId: 'g1',
    grupo: 'Término',
    opciones: [{ id: 'o1', nombre: 'Tres cuartos', precioCentavos: '0' }],
  },
  {
    grupoId: 'g2',
    grupo: 'Extras',
    opciones: [
      { id: 'o2', nombre: 'Queso', precioCentavos: '1500' },
      { id: 'o3', nombre: 'Sin crema', precioCentavos: '-500' },
    ],
  },
];

describe('renglonesDeLasOpciones (DP-16 · el ticket y la precuenta)', () => {
  it('un renglón por grupo, con el precio de cada opción que lo cambia', () => {
    expect(renglonesDeLasOpciones(instantanea)).toEqual([
      'Término: Tres cuartos',
      'Extras: Queso (+$15.00), Sin crema (−$5.00)',
    ]);
  });

  it('lee la instantánea también como texto JSON (así la guarda la base)', () => {
    expect(renglonesDeLasOpciones(JSON.stringify(instantanea))).toHaveLength(2);
  });

  it('una instantánea vieja, sin precio, sale sin precio', () => {
    expect(renglonesDeLasOpciones([{ grupo: 'Salsa', opciones: [{ nombre: 'Verde' }] }])).toEqual([
      'Salsa: Verde',
    ]);
  });

  it('la nota deja de repetir las opciones que ya salen con su precio', () => {
    // El mesero guarda las opciones también en la nota, en texto plano, para la cocina.
    const nota = 'Término: Tres cuartos · Extras: Queso, Sin crema · sin cebolla';
    expect(notaSinLasOpciones(nota, instantanea)).toBe('sin cebolla');
    expect(notaSinLasOpciones('Término: Tres cuartos', instantanea)).toBe('');
  });

  it('sin instantánea, la nota sale entera (una línea vieja o sin opciones)', () => {
    expect(notaSinLasOpciones('Salsa: Verde · bien dorado', null)).toBe(
      'Salsa: Verde · bien dorado',
    );
    expect(notaSinLasOpciones('Término: medio', instantanea)).toBe('Término: medio');
    expect(notaSinLasOpciones(null, instantanea)).toBe('');
  });

  it('sin opciones, o con basura, no inventa renglones', () => {
    expect(renglonesDeLasOpciones(null)).toEqual([]);
    expect(renglonesDeLasOpciones('')).toEqual([]);
    expect(renglonesDeLasOpciones('{no es json')).toEqual([]);
    expect(renglonesDeLasOpciones({ grupo: 'x' })).toEqual([]);
    expect(renglonesDeLasOpciones([{ grupo: 'Vacío', opciones: [] }])).toEqual([]);
  });
});
