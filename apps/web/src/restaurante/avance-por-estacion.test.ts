import { describe, expect, it } from 'vitest';

import {
  contadorDeEntregados,
  contadorDeListos,
  etiquetaDeLaNube,
  nubeCompleta,
  hayQueEntregar,
  nubesDeLaMesa,
  resumenPorEstacion,
  type ComandaParaElAvance,
} from './avance-por-estacion.ts';

/**
 * DP-24 · 4.2 y 4.4 · El avance por estación: los contadores de la mesa y la nubecita del mapa
 * salen del MISMO cálculo.
 */

const cocina = (id: string, estados: readonly string[]): ComandaParaElAvance => ({
  id,
  estado: 'en_preparacion',
  estacion_preparacion_id: 'e-cocina',
  estacion_preparacion_nombre: 'Cocina',
  items: estados.map((estado) => ({ estado })),
});
const cantina = (id: string, estados: readonly string[]): ComandaParaElAvance => ({
  id,
  estado: 'nuevo',
  estacion_preparacion_id: 'e-cantina',
  estacion_preparacion_nombre: 'Cantina',
  items: estados.map((estado) => ({ estado })),
});

describe('resumenPorEstacion', () => {
  it('cuenta platillos por estación: listos, entregados y total', () => {
    const [c] = resumenPorEstacion([
      cocina('c1', ['listo', 'entregado', 'en_preparacion', 'pendiente']),
    ]);
    expect(c).toMatchObject({ nombre: 'Cocina', total: 4, listos: 1, entregados: 1, salidos: 2 });
    expect(contadorDeListos(c!)).toBe('Listos 2 de 4');
    expect(contadorDeEntregados(c!)).toBe('Entregados 1 de 4');
  });

  it('junta las rondas (comandas) de la misma estación en UNA tarjeta', () => {
    const r = resumenPorEstacion([cocina('c1', ['listo']), cocina('c2', ['pendiente', 'listo'])]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ total: 3, listos: 2, comandaIds: ['c1', 'c2'] });
  });

  it('un platillo anulado no cuenta, y una estación sin platillos vivos desaparece', () => {
    expect(resumenPorEstacion([cocina('c1', ['cancelado', 'cancelado'])])).toEqual([]);
    const [c] = resumenPorEstacion([cocina('c1', ['cancelado', 'listo'])]);
    expect(c?.total).toBe(1);
  });

  it('una comanda cancelada entera no aporta', () => {
    expect(resumenPorEstacion([{ ...cocina('c1', ['listo']), estado: 'cancelado' }])).toEqual([]);
  });

  it('«entregar» se ofrece mientras haya algo listo, y vuelve cuando sale otro platillo', () => {
    const [antes] = resumenPorEstacion([cocina('c1', ['entregado', 'pendiente'])]);
    expect(hayQueEntregar(antes!)).toBe(false);
    const [despues] = resumenPorEstacion([cocina('c1', ['entregado', 'listo'])]);
    expect(hayQueEntregar(despues!)).toBe(true);
    expect(despues?.comandaIds).toEqual(['c1']);
  });
});

describe('la nubecita del mapa', () => {
  it('«Cantina ✓» cuando toda la estación salió, «Cocina 2 de 4» cuando falta', () => {
    const nubes = nubesDeLaMesa([
      cocina('c1', ['listo', 'listo', 'pendiente', 'en_preparacion']),
      cantina('c2', ['listo']),
    ]);
    expect(nubes).toEqual(['Cocina 2 de 4', 'Cantina ✓']);
  });

  it('si terminó primero la cantina se ve ANTES de que termine la cocina', () => {
    expect(nubesDeLaMesa([cocina('c1', ['pendiente']), cantina('c2', ['listo', 'listo'])])).toEqual(
      ['Cantina ✓'],
    );
  });

  it('no dice nada cuando nada ha salido ni cuando todo ya se entregó', () => {
    expect(nubesDeLaMesa([cocina('c1', ['pendiente', 'en_preparacion'])])).toEqual([]);
    expect(nubesDeLaMesa([cocina('c1', ['entregado', 'entregado'])])).toEqual([]);
  });

  it('lo ya entregado cuenta como salido: «Cocina 3 de 4» con uno entregado y dos listos', () => {
    const [c] = resumenPorEstacion([cocina('c1', ['entregado', 'listo', 'listo', 'pendiente'])]);
    expect(etiquetaDeLaNube(c!)).toBe('Cocina 3 de 4');
  });

  it('usa el nombre REAL de la estación, no uno fijo', () => {
    expect(
      nubesDeLaMesa([
        { ...cantina('c1', ['listo']), estacion_preparacion_nombre: 'Barra de mezcal' },
      ]),
    ).toEqual(['Barra de mezcal ✓']);
  });
});

describe('DP-25 · 3.4 · la nubecita dice el conteo y se distingue la que terminó', () => {
  it('«Bebidas 2 de 3» mientras falta y «Cocina ✓» cuando terminó, con el nombre como esté configurado', () => {
    const bebidas: ComandaParaElAvance = {
      id: 'b1',
      estado: 'en_preparacion',
      estacion_preparacion_id: 'e-bebidas',
      estacion_preparacion_nombre: 'Bebidas',
      items: [{ estado: 'listo' }, { estado: 'listo' }, { estado: 'en_preparacion' }],
    };
    expect(nubesDeLaMesa([bebidas, cocina('c1', ['listo'])])).toEqual([
      'Bebidas 2 de 3',
      'Cocina ✓',
    ]);
  });

  it('nubeCompleta sólo es verdadera para la que terminó', () => {
    expect(nubeCompleta('Cocina ✓')).toBe(true);
    expect(nubeCompleta('Bebidas 2 de 3')).toBe(false);
  });
});
