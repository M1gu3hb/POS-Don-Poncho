import { describe, expect, it } from 'vitest';

import {
  hayCambios,
  hayNombresRepetidos,
  nombrePorOmision,
  nombresGuardados,
  nombresParaGuardar,
} from './nombres-de-cajas';

/** DP-21 · Bloque 5 · «El nombre de cada caja»: un campo por lugar, no por aparato. */
describe('los nombres de las cajas en Configuración', () => {
  it('hay un campo por lugar del cupo, con lo guardado en su sitio', () => {
    expect(nombresGuardados(['Caja principal', 'Caja barra'], 2)).toEqual([
      'Caja principal',
      'Caja barra',
    ]);
    expect(nombresGuardados(['Caja principal'], 2)).toEqual(['Caja principal', '']);
    expect(nombresGuardados(['Caja principal', 'Caja barra'], 1)).toEqual(['Caja principal']);
  });

  it('sin nada guardado, o con algo que no se entiende, los campos nacen vacíos', () => {
    expect(nombresGuardados(undefined, 2)).toEqual(['', '']);
    expect(nombresGuardados('Caja principal', 1)).toEqual(['']);
    expect(nombresGuardados([null, 7], 2)).toEqual(['', '']);
  });

  it('sin nombre, la caja se llama «Caja N»', () => {
    expect(nombrePorOmision(2)).toBe('Caja 2');
  });

  it('al guardar se recorta, sin mover a nadie de lugar', () => {
    expect(nombresParaGuardar(['  ', ' Caja barra '])).toEqual(['', 'Caja barra']);
    expect(nombresParaGuardar(['x'.repeat(60)])[0]).toHaveLength(40);
  });

  it('dos cajas no se llaman igual, tampoco contra el nombre por omisión', () => {
    expect(hayNombresRepetidos(['Barra', 'barra'])).toBe(true);
    expect(hayNombresRepetidos(['Caja 2', ''])).toBe(true);
    expect(hayNombresRepetidos(['Caja principal', ''])).toBe(false);
    expect(hayNombresRepetidos(['', ''])).toBe(false);
  });

  it('sólo hay algo que guardar si cambió un nombre', () => {
    expect(hayCambios(['Caja principal ', ''], ['Caja principal', ''])).toBe(false);
    expect(hayCambios(['Caja principal', 'Barra'], ['Caja principal', ''])).toBe(true);
  });
});
