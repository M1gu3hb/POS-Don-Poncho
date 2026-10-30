import { describe, expect, it } from 'vitest';

import { primeroConTexto, textoDe } from './texto';

/**
 * EL TEXTO CON RESPALDO. `''` es «no hay» (como el `||` que hacía `Mesero.jsx`), y lo que no es un
 * texto —un número, un objeto— tampoco cuenta.
 */
describe('textoDe', () => {
  it('un texto con contenido, tal cual', () => {
    expect(textoDe('cocina', 'x')).toBe('cocina');
  });

  it('vacío, ausente o de otro tipo: el respaldo', () => {
    for (const valor of ['', null, undefined, 0, 12, {}, []]) {
      expect(textoDe(valor, 'respaldo')).toBe('respaldo');
    }
  });
});

describe('primeroConTexto', () => {
  it('el primero que tiene contenido, saltando vacíos y ausentes', () => {
    expect(primeroConTexto('', null, undefined, 'nuez', 'otro')).toBe('nuez');
  });

  it('un espacio sí es contenido (quien lo escribió lo escribió)', () => {
    expect(primeroConTexto('', ' ')).toBe(' ');
  });

  it('si ninguno sirve, el texto vacío', () => {
    expect(primeroConTexto()).toBe('');
    expect(primeroConTexto('', null, 3)).toBe('');
  });
});
