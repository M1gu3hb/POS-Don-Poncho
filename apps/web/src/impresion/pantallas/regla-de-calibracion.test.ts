import { describe, expect, it } from 'vitest';

import { PUNTOS_POR_PAPEL } from '../termico/perfil.ts';
import {
  bordesDeLaRegla,
  LADO_DEL_CUADRO,
  marcasDeLaRegla,
  PASO_DE_LA_REGLA,
  TEXTO_DEL_CUADRO,
} from './regla-de-calibracion.ts';

describe('DP-20 · la regla de calibración', () => {
  it('lleva una raya cada 8 puntos (1 mm) de 0 al ancho', () => {
    const marcas = marcasDeLaRegla(576);
    expect(PASO_DE_LA_REGLA).toBe(8);
    expect(marcas).toHaveLength(576 / 8 + 1);
    expect(marcas.at(0)?.x).toBe(0);
    expect(marcas.at(-1)?.x).toBe(576);
    expect(marcas.every((m, i) => m.x === i * 8)).toBe(true);
  });

  it('rotula cada 80 puntos (10 mm) con su número de punto, y sólo ahí', () => {
    const rotuladas = marcasDeLaRegla(576).filter((m) => m.rotulo !== null);
    expect(rotuladas.map((m) => m.rotulo)).toEqual([
      '0',
      '80',
      '160',
      '240',
      '320',
      '400',
      '480',
      '560',
    ]);
    expect(rotuladas.every((m) => m.largo === 'larga')).toBe(true);
  });

  it('la marca de en medio (cada 40) es media y el resto corta', () => {
    const marcas = marcasDeLaRegla(160);
    expect(marcas.find((m) => m.x === 40)?.largo).toBe('media');
    expect(marcas.find((m) => m.x === 120)?.largo).toBe('media');
    expect(marcas.find((m) => m.x === 8)?.largo).toBe('corta');
  });

  it('las marcas de borde son 384, 512 y 576, las que caben', () => {
    expect(bordesDeLaRegla(576)).toEqual([384, 512, 576]);
    expect(bordesDeLaRegla(512)).toEqual([384, 512]);
    expect(bordesDeLaRegla(384)).toEqual([384]);
    expect(bordesDeLaRegla(300)).toEqual([]);
  });

  it('el cuadro mide 80 × 80 puntos: 10 × 10 mm a 203 dpi', () => {
    expect(LADO_DEL_CUADRO).toBe(80);
    expect(TEXTO_DEL_CUADRO).toBe('Este cuadro debe medir 10 × 10 mm a 203 dpi');
  });

  it('cabe en cada ancho de los rollos comunes sin pasarse', () => {
    for (const puntos of [...PUNTOS_POR_PAPEL[58], ...PUNTOS_POR_PAPEL[80]]) {
      expect(marcasDeLaRegla(puntos).every((m) => m.x <= puntos)).toBe(true);
    }
  });
});
