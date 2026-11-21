import { describe, expect, it } from 'vitest';

import {
  bloquesPorColumna,
  columnaDelPlatillo,
  conLosToquesDePlatillos,
  contarPlatillos,
  esperaDelBloque,
} from './platillos-del-tablero';
import { resumenDeProduccion, textoDelResumen } from './resumen-de-produccion';
import type { ComandaDeCocina, ItemDeCocina } from './tipos';

/**
 * DP-24 · 4.1 · La cocina por platillo: columnas por PLATILLO, bloques por mesa.
 */

const item = (id: string, estado: string, parche: Partial<ItemDeCocina> = {}): ItemDeCocina => ({
  id,
  producto_nombre: `Platillo ${id}`,
  cantidad: 1,
  estado,
  ...parche,
});
const comanda = (id: string, parche: Partial<ComandaDeCocina> = {}): ComandaDeCocina => ({
  id,
  estado: 'nuevo',
  venta_id: 'cuenta-1',
  mesa_numero: 1,
  fecha_marchada: '2026-11-20T18:00:00.000Z',
  items: [],
  ...parche,
});

describe('columnaDelPlatillo', () => {
  it('pendiente es «nuevo»; lo entregado y lo anulado ya no se pintan', () => {
    const c = comanda('c');
    expect(columnaDelPlatillo(item('a', 'pendiente'), c)).toBe('nuevo');
    expect(columnaDelPlatillo(item('a', 'en_preparacion'), c)).toBe('en_preparacion');
    expect(columnaDelPlatillo(item('a', 'listo'), c)).toBe('listo');
    expect(columnaDelPlatillo(item('a', 'entregado'), c)).toBeNull();
    expect(columnaDelPlatillo(item('a', 'cancelado'), c)).toBeNull();
  });

  it('un platillo sin estado toma el de su comanda', () => {
    expect(columnaDelPlatillo({ id: 'a' }, comanda('c', { estado: 'listo' }))).toBe('listo');
  });
});

describe('bloquesPorColumna', () => {
  it('una misma mesa aparece en las tres columnas a la vez, cada platillo bajo su bloque', () => {
    const c = comanda('c1', {
      items: [item('a', 'pendiente'), item('b', 'en_preparacion'), item('c', 'listo')],
    });
    const b = bloquesPorColumna([c]);
    expect(b.nuevo.map((x) => x.platillos.map((p) => p.item.id))).toEqual([['a']]);
    expect(b.en_preparacion.map((x) => x.platillos.map((p) => p.item.id))).toEqual([['b']]);
    expect(b.listo.map((x) => x.platillos.map((p) => p.item.id))).toEqual([['c']]);
    expect(b.nuevo[0]?.clave).toBe('cuenta-1');
  });

  it('las comandas de la misma cuenta se juntan en UN bloque por columna; dos cuentas no se mezclan', () => {
    const b = bloquesPorColumna([
      comanda('c1', { items: [item('a', 'pendiente')] }),
      comanda('c2', { items: [item('b', 'pendiente')], estacion_preparacion_nombre: 'Cantina' }),
      comanda('c3', { venta_id: 'cuenta-2', items: [item('c', 'pendiente')] }),
    ]);
    expect(b.nuevo).toHaveLength(2);
    expect(b.nuevo[0]?.platillos).toHaveLength(2);
    expect(b.nuevo[0]?.comandas.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(contarPlatillos(b.nuevo)).toBe(3);
  });

  it('lo más viejo arriba; lo listo se ordena por cuándo salió', () => {
    const b = bloquesPorColumna([
      comanda('c1', {
        venta_id: 'nueva',
        fecha_marchada: '2026-11-20T18:10:00.000Z',
        items: [item('a', 'pendiente')],
      }),
      comanda('c2', {
        venta_id: 'vieja',
        fecha_marchada: '2026-11-20T18:00:00.000Z',
        items: [item('b', 'pendiente')],
      }),
    ]);
    expect(b.nuevo.map((x) => x.clave)).toEqual(['vieja', 'nueva']);
    const listos = bloquesPorColumna([
      comanda('c1', {
        venta_id: 'x',
        items: [item('a', 'listo', { fecha_listo: '2026-11-20T18:30:00.000Z' })],
      }),
      comanda('c2', {
        venta_id: 'y',
        items: [item('b', 'listo', { fecha_listo: '2026-11-20T18:20:00.000Z' })],
      }),
    ]);
    expect(listos.listo.map((x) => x.clave)).toEqual(['y', 'x']);
    expect(esperaDelBloque(listos.listo[0]!)).toBe('2026-11-20T18:20:00.000Z');
  });

  it('un platillo anulado no aparece y una comanda sin platillos vivos no deja bloque', () => {
    const b = bloquesPorColumna([comanda('c1', { items: [item('a', 'cancelado')] })]);
    expect(
      contarPlatillos(b.nuevo) + contarPlatillos(b.en_preparacion) + contarPlatillos(b.listo),
    ).toBe(0);
  });
});

describe('los toques en camino sobre los platillos', () => {
  it('el platillo tocado se ve ya en su columna nueva; los demás no cambian', () => {
    const c = comanda('c1', { items: [item('a', 'pendiente'), item('b', 'pendiente')] });
    const toques = new Map([['a', { parche: { estado: 'en_preparacion' } }]]);
    const b = bloquesPorColumna(conLosToquesDePlatillos([c], toques));
    expect(b.en_preparacion[0]?.platillos.map((p) => p.item.id)).toEqual(['a']);
    expect(b.nuevo[0]?.platillos.map((p) => p.item.id)).toEqual(['b']);
  });
});

describe('el resumen de producción cuenta por platillo', () => {
  it('un platillo listo de una comanda a medias ya no es producción pendiente', () => {
    const c = comanda('c1', {
      estado: 'en_preparacion',
      items: [
        item('a', 'listo', { producto_id: 'p1', producto_nombre: 'Consomé' }),
        item('b', 'en_preparacion', { producto_id: 'p1', producto_nombre: 'Consomé' }),
      ],
    });
    expect(resumenDeProduccion([c]).map(textoDelResumen)).toEqual(['Consomé ×1']);
  });
});
