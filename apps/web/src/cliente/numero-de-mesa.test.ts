import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { siguienteNumeroLibre } from './numero-de-mesa.ts';

describe('DP-15 · el número de la mesa nueva', () => {
  it('sin mesas, la 1; seguidas, la siguiente', () => {
    expect(siguienteNumeroLibre([])).toBe(1);
    expect(siguienteNumeroLibre([{ numero: 1 }, { numero: 2 }, { numero: 3 }])).toBe(4);
  });

  it('reusa el hueco de una mesa quitada o que nunca existió', () => {
    expect(
      siguienteNumeroLibre([
        { numero: 1 },
        { numero: 2 },
        { numero: 3, activo: false },
        { numero: 4 },
      ]),
    ).toBe(3);
    expect(siguienteNumeroLibre([{ numero: 2 }, { numero: 3 }])).toBe(1);
  });

  it('ignora lo que no es un número de mesa', () => {
    expect(siguienteNumeroLibre([null, { numero: null }, { numero: 0 }, { numero: 1 }])).toBe(2);
  });

  it('«Nueva mesa» de Configuración lo usa', () => {
    const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
    const c = readFileSync(join(raiz, 'heredado', 'pages', 'Configuracion.jsx'), 'utf8').replace(
      /\s+/g,
      '',
    );
    expect(c).toContain('numero:siguienteNumeroLibre(mesas),');
  });
});
