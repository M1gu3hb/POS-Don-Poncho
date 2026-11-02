import { describe, expect, it } from 'vitest';

import {
  DISTANCIA_DE_LLAMADO,
  formaDeLaUnion,
  INCLINACION_MAXIMA,
  vecinaQueLlama,
} from './forma-de-la-union.ts';
import { IMAN } from './union.ts';

/** DP-12.3 · La forma de una unión y la vecina que «llama». */

const redonda = (id: string, x: number, y: number) => ({
  id,
  x,
  y,
  ancho: 80,
  alto: 80,
  forma: 'redonda',
});
const cuadrada = (id: string, x: number, y: number) => ({
  ...redonda(id, x, y),
  forma: 'cuadrada',
});

describe('la forma al fundirse depende de la dirección', () => {
  it('dos redondas lado a lado: una cápsula horizontal', () => {
    expect(formaDeLaUnion([redonda('a', 100, 100), redonda('b', 180, 100)])).toEqual({
      x: 100,
      y: 100,
      ancho: 160,
      alto: 80,
      radio: 40,
      figura: 'capsula-horizontal',
    });
  });

  it('una arriba de otra: una cápsula vertical', () => {
    expect(formaDeLaUnion([redonda('a', 100, 100), redonda('b', 100, 180)])).toMatchObject({
      ancho: 80,
      alto: 160,
      radio: 40,
      figura: 'capsula-vertical',
    });
  });

  it('dos cuadradas: un rectángulo; cuatro en 2 × 2: un cuadrado', () => {
    expect(formaDeLaUnion([cuadrada('a', 0, 0), cuadrada('b', 80, 0)])?.figura).toBe('rectangulo');
    expect(
      formaDeLaUnion([
        cuadrada('a', 0, 0),
        cuadrada('b', 80, 0),
        cuadrada('c', 0, 80),
        cuadrada('d', 80, 80),
      ]),
    ).toMatchObject({ ancho: 160, alto: 160, figura: 'cuadrado', radio: 12 });
    expect(
      formaDeLaUnion([
        redonda('a', 0, 0),
        redonda('b', 80, 0),
        redonda('c', 0, 80),
        redonda('d', 80, 80),
      ])?.figura,
    ).toBe('cuadrado');
  });

  it('sin mesas no hay forma', () => {
    expect(formaDeLaUnion([])).toBeNull();
  });
});

describe('el imán es una animación de la vecina, no del arrastre', () => {
  const fija = redonda('fija', 100, 100);

  it('lejos, nadie llama', () => {
    expect(vecinaQueLlama(redonda('mia', 180 + DISTANCIA_DE_LLAMADO + 1, 100), [fija])).toBeNull();
  });

  it('cuanto más cerca, más se inclina hacia la que va en el dedo, y al tocarse se funden', () => {
    const lejos = vecinaQueLlama(redonda('mia', 180 + DISTANCIA_DE_LLAMADO - 10, 100), [fija]);
    const cerca = vecinaQueLlama(redonda('mia', 180 + IMAN - 1, 100), [fija]);
    expect(lejos).toMatchObject({ id: 'fija', seFunden: false });
    expect(cerca).toMatchObject({ id: 'fija', seFunden: true });
    expect(cerca?.dx ?? 0).toBeGreaterThan(lejos?.dx ?? 0);
    expect(cerca?.dy).toBeCloseTo(0);
    const pegada = vecinaQueLlama(redonda('mia', 180, 100), [fija]);
    expect(pegada?.dx).toBeCloseTo(INCLINACION_MAXIMA);
    expect(pegada?.estiron).toBeGreaterThan(1);
  });

  it('se inclina hacia donde está la arrastrada (arriba, abajo, a los lados)', () => {
    expect(vecinaQueLlama(redonda('mia', 100, 0), [fija])?.dy ?? 0).toBeLessThan(0);
    expect(vecinaQueLlama(redonda('mia', 0, 100), [fija])?.dx ?? 0).toBeLessThan(0);
  });
});
