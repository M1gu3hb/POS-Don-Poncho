import { describe, expect, it } from 'vitest';

import { MESA_STATUS_CONFIG } from '../../heredado/lib/constants.js';

import { ESTADOS_DE_LA_LEYENDA, paletaDeLaMesa } from './colores-de-la-mesa';

/**
 * LOS COLORES DE UNA MESA, y que el estado SE LEA.
 *
 * `estados-de-mesa.spec.ts` mide en el navegador el contraste de la etiqueta de cada estado
 * (4.5:1, o 3:1 si es grande) contra lo que hay DETRÁS del texto. Antes la mesa era un degradado y
 * la etiqueta flotaba sobre una pastilla translúcida: había que retratar el renglón para saberlo.
 * Ahora el relleno es sólido y la etiqueta lleva fondo propio, así que la razón se calcula aquí,
 * con la fórmula de WCAG 2, en los diez estados y en los dos modos. Si alguien toca un color y la
 * etiqueta deja de leerse, esto falla antes que el navegador.
 */

type Rgb = readonly [number, number, number];

function rgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminancia([r, g, b]: Rgb): number {
  const canal = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function razon(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(rgb(a)), luminancia(rgb(b))].sort((x, y) => y - x);
  return ((claro ?? 0) + 0.05) / ((oscuro ?? 0) + 0.05);
}

const ESTADOS = Object.keys(MESA_STATUS_CONFIG);

describe('la etiqueta del estado se lee (4.5:1) en los diez estados y los dos modos', () => {
  for (const oscuro of [false, true]) {
    for (const estado of ESTADOS) {
      it(`${estado} · ${oscuro ? 'oscuro' : 'claro'}`, () => {
        const p = paletaDeLaMesa(estado, oscuro);
        expect(razon(p.texto, p.fondoDeLaEtiqueta)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('el número de la mesa se lee sobre el relleno (3:1: es grande y en negrita)', () => {
  for (const oscuro of [false, true]) {
    for (const estado of ESTADOS) {
      it(`${estado} · ${oscuro ? 'oscuro' : 'claro'}`, () => {
        const p = paletaDeLaMesa(estado, oscuro);
        expect(razon(p.texto, p.relleno)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe('de dónde sale cada color', () => {
  it('en claro, el relleno, el borde y el texto son los de `MESA_STATUS_CONFIG`', () => {
    const p = paletaDeLaMesa('ocupada', false);
    expect(p).toMatchObject({
      etiqueta: 'Ocupada',
      relleno: '#E63946',
      borde: '#A41E2A',
      texto: '#FFFFFF',
    });
  });

  it('con texto blanco, en claro, la etiqueta lleva el tono oscuro de la familia (el borde)', () => {
    expect(paletaDeLaMesa('ocupada', false).fondoDeLaEtiqueta).toBe('#A41E2A');
  });

  it('con texto oscuro, en claro, la etiqueta va sobre el mismo relleno', () => {
    const p = paletaDeLaMesa('libre', false);
    expect(p.fondoDeLaEtiqueta).toBe(p.relleno);
  });

  it('en oscuro usa la paleta oscura, con su halo; la palabra sigue siendo la misma', () => {
    const p = paletaDeLaMesa('ocupada', true);
    expect(p).toMatchObject({ etiqueta: 'Ocupada', relleno: '#4a1922', texto: '#ffffff' });
    expect(p.fondoDeLaEtiqueta).toBe('#4a1922');
    expect(p.brillo).toContain('rgba(');
  });

  it('en claro no hay halo', () => {
    expect(paletaDeLaMesa('ocupada', false).brillo).toBeNull();
  });

  it('un estado que no existe se pinta como «libre»', () => {
    expect(paletaDeLaMesa('inventado', false).etiqueta).toBe('Libre');
    expect(paletaDeLaMesa(undefined, true).etiqueta).toBe('Libre');
  });
});

describe('la leyenda', () => {
  it('enseña todos los estados menos «pagada» y «cancelada», que ninguna pantalla puede dar', () => {
    expect(ESTADOS_DE_LA_LEYENDA.map((e) => e.clave)).not.toContain('pagada');
    expect(ESTADOS_DE_LA_LEYENDA.map((e) => e.clave)).not.toContain('cancelada');
    expect(ESTADOS_DE_LA_LEYENDA).toHaveLength(ESTADOS.length - 2);
  });

  it('cada uno con su palabra y los dos colores de su muestra', () => {
    const libre = ESTADOS_DE_LA_LEYENDA.find((e) => e.clave === 'libre');
    expect(libre).toEqual({
      clave: 'libre',
      etiqueta: 'Libre',
      relleno: '#FFF8E8',
      borde: '#D9C28A',
    });
  });
});
