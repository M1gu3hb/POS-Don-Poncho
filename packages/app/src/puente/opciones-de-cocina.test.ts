import { describe, expect, it } from 'vitest';

import { haciaEl } from './tipos.ts';
import { MAPA } from './mapa.ts';
import { opcionesParaCocina } from './opciones-de-cocina.ts';

/**
 * DP-16 · 2.2 · A la cocina llegan el grupo y los nombres de lo elegido: ni ids, ni precios.
 */

describe('opcionesParaCocina', () => {
  it('reduce la instantánea a grupo y nombres, y deja fuera todo lo demás', () => {
    const instantanea = [
      {
        grupoId: 'g1',
        grupo: 'Extras',
        precio_extra_centavos: 1500,
        opciones: [
          { id: 'o1', nombre: 'Crema', precio_centavos: 1500 },
          { id: 'o2', nombre: 'Salsa' },
        ],
      },
    ];
    const salida = opcionesParaCocina(instantanea);
    expect(salida).toEqual([{ grupo: 'Extras', opciones: ['Crema', 'Salsa'] }]);
    expect(JSON.stringify(salida)).not.toMatch(/precio|centavos|"id"|g1|o1/);
  });

  it('acepta el texto JSON de la columna', () => {
    expect(
      opcionesParaCocina(JSON.stringify([{ grupo: 'Relleno', opciones: [{ nombre: 'Queso' }] }])),
    ).toEqual([{ grupo: 'Relleno', opciones: ['Queso'] }]);
  });

  it('lo que no tiene forma es null, sin lanzar', () => {
    for (const raro of [
      null,
      undefined,
      'no es json',
      {},
      [],
      [3, 'x'],
      [{ grupo: 'A', opciones: [] }],
    ]) {
      expect(opcionesParaCocina(raro)).toBeNull();
    }
  });
});

describe('el puente sirve las opciones a la cocina', () => {
  it('el item de la comanda las deriva de su línea de venta, con la conversión de cocina', () => {
    const derivado = MAPA['PedidoPreparacionItem']?.derivados?.['opciones'];
    expect(derivado).toMatchObject({
      tabla: 'orden_lineas',
      porColumna: 'orden_linea_id',
      columna: 'opciones',
      conversion: 'opciones_de_cocina',
    });
  });

  it('la conversión de lectura aplica la reducción', () => {
    expect(
      haciaEl(
        [{ grupo: 'G', precio: 9, opciones: [{ nombre: 'A', precio: 9 }] }],
        'opciones_de_cocina',
      ),
    ).toEqual([{ grupo: 'G', opciones: ['A'] }]);
  });

  it('la comanda sirve desde cuándo espera (marchada_en)', () => {
    expect(MAPA['PedidoPreparacion']?.campos['fecha_marchada']).toMatchObject({
      columna: 'marchada_en',
      conversion: 'fecha',
      escribible: false,
    });
  });
});
