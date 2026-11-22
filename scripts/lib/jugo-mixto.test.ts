import { describe, expect, it } from 'vitest';

import { OPCION, planDelJugoMixto, pesosConSigno } from './jugo-mixto.mjs';

/** DP-25 · Parte 8.2 · El plan del guion que agrega «Mixto» al «Sabor del jugo». */

const GRUPO = {
  id: 'g1',
  nombre: 'Sabor del jugo',
  tipo: 'unica',
  obligatorio: true,
  activo: true,
  minimo_elecciones: null,
  maximo_elecciones: null,
};

const estado = (cambios: Record<string, unknown> = {}) => ({
  productos: [{ id: 'p1', nombre: 'Jugo', activo: true }],
  grupos: [GRUPO],
  asignaciones: [{ producto_id: 'p1', modificador_id: 'g1' }],
  opciones: [
    {
      id: 'o1',
      modificador_id: 'g1',
      nombre: 'Naranja',
      orden: 0,
      activa: true,
      delta_precio_centavos: 0n,
    },
    {
      id: 'o2',
      modificador_id: 'g1',
      nombre: 'Zanahoria',
      orden: 1,
      activa: true,
      delta_precio_centavos: 0n,
    },
  ],
  ...cambios,
});

describe('pesosConSigno', () => {
  it.each([
    [0n, '0.00'],
    [2000n, '20.00'],
    [550n, '5.50'],
    [-550n, '-5.50'],
    [5, '0.05'],
  ])('%s centavos → %s', (centavos, texto) => {
    expect(pesosConSigno(centavos)).toBe(texto);
  });
});

describe('planDelJugoMixto', () => {
  it('con las dos opciones de hoy manda el grupo entero con «Mixto» al final y a $0', () => {
    const plan = planDelJugoMixto(estado());
    expect(plan.accion).toBe('agregar');
    expect(plan.entrada).toEqual({
      grupoId: 'g1',
      nombre: 'Sabor del jugo',
      tipo: 'unica',
      obligatorio: true,
      minimo: null,
      maximo: null,
      activo: true,
      opciones: [
        { id: 'o1', nombre: 'Naranja', precio: '0.00', activa: true },
        { id: 'o2', nombre: 'Zanahoria', precio: '0.00', activa: true },
        { nombre: OPCION, precio: '0', activa: true },
      ],
    });
  });

  it('conserva el precio de cada opción que ya tiene (nunca borra ni cambia lo que hay)', () => {
    const plan = planDelJugoMixto(
      estado({
        opciones: [
          {
            id: 'o1',
            modificador_id: 'g1',
            nombre: 'Naranja',
            orden: 0,
            activa: true,
            delta_precio_centavos: 500n,
          },
        ],
      }),
    );
    expect(plan.entrada?.opciones[0]).toEqual({
      id: 'o1',
      nombre: 'Naranja',
      precio: '5.00',
      activa: true,
    });
  });

  it('si «Mixto» ya existe no hace nada y lo dice, aunque se escriba distinto', () => {
    const plan = planDelJugoMixto(
      estado({
        opciones: [
          {
            id: 'o1',
            modificador_id: 'g1',
            nombre: 'Naranja',
            orden: 0,
            activa: true,
            delta_precio_centavos: 0n,
          },
          {
            id: 'o3',
            modificador_id: 'g1',
            nombre: ' mixto ',
            orden: 1,
            activa: true,
            delta_precio_centavos: 0n,
          },
        ],
      }),
    );
    expect(plan.accion).toBe('nada');
    expect(plan.entrada).toBeUndefined();
    expect(plan.mensaje).toContain('Mixto');
  });

  it.each([
    ['no hay Jugo', { productos: [] }],
    [
      'hay dos Jugos activos',
      {
        productos: [
          { id: 'p1', nombre: 'Jugo', activo: true },
          { id: 'p2', nombre: 'Jugo', activo: true },
        ],
      },
    ],
    ['el Jugo no tiene el grupo', { asignaciones: [] }],
    ['el grupo no se llama «Sabor del jugo»', { grupos: [{ ...GRUPO, nombre: 'Sabor' }] }],
  ])('se detiene sin escribir si %s', (_caso, cambio) => {
    const plan = planDelJugoMixto(estado(cambio));
    expect(plan.accion).toBe('problema');
    expect(plan.entrada).toBeUndefined();
    expect(plan.mensaje.length).toBeGreaterThan(10);
  });
});
