import { describe, expect, it } from 'vitest';

import { opcionesDeZona, zonaElegible } from './mesas-del-mapa';

describe('la zona de «Nueva mesa» nunca queda en blanco (DP-14.6, QA1-2)', () => {
  const salon = ['Salón', 'Terraza'];

  it('una zona del negocio se respeta', () => {
    expect(zonaElegible('Terraza', salon)).toBe('Terraza');
  });

  it('«Interior» en un negocio que no la tiene, o en blanco, cae en la primera', () => {
    expect(zonaElegible('Interior', salon)).toBe('Salón');
    expect(zonaElegible('', salon)).toBe('Salón');
    expect(zonaElegible(undefined, salon)).toBe('Salón');
    expect(zonaElegible('   ', salon)).toBe('Salón');
  });

  it('sin zonas del negocio, la de siempre', () => {
    expect(zonaElegible(null, [])).toBe('Interior');
  });

  it('las opciones incluyen la zona actual aunque el negocio ya no la liste', () => {
    expect(opcionesDeZona(salon, 'Patio')).toEqual(['Salón', 'Terraza', 'Patio']);
    expect(opcionesDeZona(salon, 'Salón')).toEqual(salon);
    expect(opcionesDeZona(salon, '')).toEqual(salon);
  });
});
