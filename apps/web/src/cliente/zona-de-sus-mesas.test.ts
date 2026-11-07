import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { zonaDeSusMesas } from './mesas-del-mapa';

/**
 * DP-14 · ronda 2 · LA MESERA ENTRA A LA ZONA DE SUS MESAS.
 *
 * Con la asignación encendida, la mesera ve SUS mesas y también las que no tienen mesero (las de
 * alguien que se fue: DP-D77). Si las sin mesero estaban en «Interior» y las suyas en «Barra», entraba
 * a «Interior» y la suya no se veía. Ahora entra a la zona de las suyas; las demás, en sus pestañas.
 */

const ZONAS = [{ zona: 'Interior' }, { zona: 'Terraza' }, { zona: 'Barra' }];

describe('zonaDeSusMesas', () => {
  it('la primera zona, en el orden de las pestañas, donde tiene una mesa SUYA', () => {
    const mesas = [
      { id: '1', zona: 'Interior', mesero_asignado_id: null },
      { id: '2', zona: 'Barra', mesero_asignado_id: 'lupita' },
      { id: '3', zona: 'Terraza', mesero_asignado_id: 'beto' },
    ];
    expect(zonaDeSusMesas(mesas, ZONAS, 'lupita')).toBe('Barra');
  });

  it('una mesa suya dada de baja no cuenta', () => {
    const mesas = [
      { id: '1', zona: 'Terraza', mesero_asignado_id: 'lupita', activo: false },
      { id: '2', zona: 'Barra', mesero_asignado_id: 'lupita' },
    ];
    expect(zonaDeSusMesas(mesas, ZONAS, 'lupita')).toBe('Barra');
  });

  it('sin mesas suyas, ninguna (la pantalla sigue con la primera zona con mesas)', () => {
    expect(
      zonaDeSusMesas([{ id: '1', zona: 'Interior', mesero_asignado_id: null }], ZONAS, 'lupita'),
    ).toBeNull();
  });

  it('una mesa sin zona es de «Interior», como en el plano', () => {
    expect(
      zonaDeSusMesas([{ id: '1', zona: null, mesero_asignado_id: 'lupita' }], ZONAS, 'lupita'),
    ).toBe('Interior');
  });
});

describe('la pantalla del mesero', () => {
  const mesero = () =>
    readFileSync(join(__dirname, '..', '..', 'heredado', 'pages', 'Mesero.jsx'), 'utf8');

  it('con la asignación encendida, entra UNA vez a la zona de sus mesas', () => {
    expect(mesero()).toMatch(
      /asignActiva && posUser\?\.rol === ROLES\.WAITER\s*\?\s*zonaDeSusMesas\(mesas, zonasConCount, posUser\.id\)\s*:\s*null/,
    );
    expect(mesero()).toMatch(
      /if \(zonaPropiaElegida\.current \|\| zonaPropia === null \|\| unirDesde\) return;\s*zonaPropiaElegida\.current = true;\s*setZonaActiva\(zonaPropia\);/,
    );
  });
});
