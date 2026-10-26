import { describe, expect, it } from 'vitest';

import { ESTILOS_CONSTRUIDOS } from './contrato';
import { CLAVES_ESTILO, ESTILOS, ESTILO_PREDETERMINADO, estiloOPredeterminado } from './estilos';

/**
 * EL ESTILO CON QUE ARRANCA LO QUE NO TIENE PREFERENCIA GUARDADA.
 *
 * Es `don-poncho` (DP-3: el estilo de la casa), y esta es la prueba de que:
 *   1 · existe una sola respuesta a «¿y si no hay nada guardado?», y es un estilo construido;
 *   2 · lo que SÍ está guardado no se toca, sea cual sea: el negocio que eligió `noche`,
 *       `bloque` o `terminal` sigue en el suyo;
 *   3 · lo que no es un estilo —vacío, desconocido, de otra versión— cae a `don-poncho` en
 *       vez de lanzar o de dejar el `<html>` sin tokens de color.
 */
describe('ESTILO_PREDETERMINADO', () => {
  it('es don-poncho, el de la casa', () => {
    expect(ESTILO_PREDETERMINADO).toBe('don-poncho');
  });

  it('es un estilo que de verdad existe, con su paleta y sus perillas', () => {
    expect(CLAVES_ESTILO).toContain(ESTILO_PREDETERMINADO);
    expect(ESTILOS[ESTILO_PREDETERMINADO]).toBeDefined();
    expect(ESTILOS_CONSTRUIDOS).toContain(ESTILO_PREDETERMINADO);
  });

  it('conserva los ocho estilos del maestro y suma el de la casa: elegir otro sigue siendo posible', () => {
    expect([...ESTILOS_CONSTRUIDOS].sort()).toEqual(
      [
        'bloque',
        'cristal',
        'don-poncho',
        'morphiq',
        'noche',
        'papel',
        'relieve',
        'taller',
        'terminal',
      ].sort(),
    );
    expect([...CLAVES_ESTILO].sort()).toEqual([...ESTILOS_CONSTRUIDOS].sort());
  });
});

describe('estiloOPredeterminado', () => {
  it.each(ESTILOS_CONSTRUIDOS)('%s guardado se queda como está', (estilo) => {
    expect(estiloOPredeterminado(estilo)).toBe(estilo);
  });

  it('un negocio que guardó «noche» sigue viendo «noche»', () => {
    expect(estiloOPredeterminado('noche')).toBe('noche');
    expect(estiloOPredeterminado('noche')).not.toBe(ESTILO_PREDETERMINADO);
  });

  it('sin nada guardado arranca con don-poncho', () => {
    expect(estiloOPredeterminado(undefined)).toBe('don-poncho');
    expect(estiloOPredeterminado(null)).toBe('don-poncho');
    expect(estiloOPredeterminado('')).toBe('don-poncho');
  });

  it('un valor que no es un estilo construido también arranca con don-poncho', () => {
    for (const raro of [
      'premium',
      'base',
      'Morphiq',
      ' noche',
      'NOCHE',
      'Don-Poncho',
      'inexistente',
    ]) {
      expect(estiloOPredeterminado(raro)).toBe('don-poncho');
    }
  });

  it('no se deja engañar por las propiedades heredadas de cualquier objeto', () => {
    for (const trampa of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(estiloOPredeterminado(trampa)).toBe('don-poncho');
    }
  });
});
