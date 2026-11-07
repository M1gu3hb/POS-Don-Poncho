import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ColaDeUnoEnUno } from './cola-de-uno-en-uno.ts';

/** Dos toques rápidos en platillos con opciones: el primero no se pierde (DP-14, ronda 2). */
describe('ColaDeUnoEnUno', () => {
  it('el primero que llega se atiende; el segundo espera su turno sin pisarlo', () => {
    const cola = new ColaDeUnoEnUno<string>();

    expect(cola.llegar('tacos')).toBe(true);
    expect(cola.llegar('quesadillas')).toBe(false);

    expect(cola.actual).toBe('tacos');
  });

  it('al terminar el primero se abre el segundo, y luego no queda nada', () => {
    const cola = new ColaDeUnoEnUno<string>();
    cola.llegar('tacos');
    cola.llegar('quesadillas');
    cola.llegar('tostadas');

    expect(cola.terminar()).toBe('quesadillas');
    expect(cola.terminar()).toBe('tostadas');
    expect(cola.terminar()).toBeNull();
    expect(cola.actual).toBeNull();
  });

  it('con la cola vacía, el siguiente que llega se atiende de inmediato', () => {
    const cola = new ColaDeUnoEnUno<string>();
    cola.llegar('tacos');
    cola.terminar();

    expect(cola.llegar('tostadas')).toBe(true);
    expect(cola.actual).toBe('tostadas');
  });
});

/**
 * Y en la pantalla del mesero: cada turno de la cola abre un diálogo NUEVO. Si el siguiente es el
 * MISMO platillo (dos quesadillas tocadas casi a la vez), `producto.id` no cambia, el diálogo no se
 * reiniciaba y la segunda salía con las opciones y la nota de la primera. La revisión lo encontró;
 * `key` por turno lo monta desde cero. Pantalla heredada: el contrato lee su texto.
 */
describe('Mesero: cada turno de la cola es un diálogo nuevo', () => {
  const mesero = () =>
    readFileSync(join(__dirname, '..', '..', 'heredado', 'pages', 'Mesero.jsx'), 'utf8');

  it('el diálogo de opciones lleva la llave del turno', () => {
    expect(mesero()).toMatch(
      /<SeleccionModificadoresDialog\s+key=\{turnoDePersonalizar\}\s+producto=\{productoParaPersonalizar\}/,
    );
  });

  it('abrir y pasar al siguiente cambian el turno', () => {
    expect(mesero()).toMatch(
      /if \(colaDePersonalizarRef\.current\.llegar\(producto\)\) \{\s*setTurnoDePersonalizar\(\(n\) => n \+ 1\);\s*setProductoParaPersonalizar\(producto\);/,
    );
    expect(mesero()).toMatch(
      /const cerrarPersonalizacion = \(\) => \{\s*setTurnoDePersonalizar\(\(n\) => n \+ 1\);\s*setProductoParaPersonalizar\(colaDePersonalizarRef\.current\.terminar\(\)\);/,
    );
  });
});
