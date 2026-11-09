import { describe, expect, it } from 'vitest';

import { conLaCuentaCobrada, sinPlatillosQuitados } from './platos-de-la-estacion';

/** DP-15 · F1 · El Jugo quitado ya preparado seguía en «Listos» de Bebidas. */
describe('sinPlatillosQuitados', () => {
  it('el platillo quitado no se pinta, el resto de la comanda sí', () => {
    const [comanda] = sinPlatillosQuitados([
      { id: 'c', items: [{ estado: 'listo' }, { estado: 'cancelado' }] },
    ]);
    expect(comanda?.items).toEqual([{ estado: 'listo' }]);
  });

  it('una comanda con todos los platillos quitados desaparece', () => {
    expect(sinPlatillosQuitados([{ id: 'c', items: [{ estado: 'cancelado' }] }])).toEqual([]);
  });

  it('una comanda sin renglones cargados se respeta (aún no llegan los hijos)', () => {
    expect(sinPlatillosQuitados([{ id: 'c', items: [] }])).toHaveLength(1);
  });
});

describe('conLaCuentaCobrada', () => {
  const ventas = { v1: { estado: 'pagada' }, v2: { estado: 'abierta' } };

  it('marca la comanda de una cuenta pagada y sólo esa', () => {
    const r = conLaCuentaCobrada(
      [{ venta_id: 'v1' }, { venta_id: 'v2' }, { venta_id: null }],
      ventas,
    );
    expect(r.map((c) => c.cuenta_cobrada === true)).toEqual([true, false, false]);
  });
});
