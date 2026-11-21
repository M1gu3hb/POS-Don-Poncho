import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { contrasteLegible, leerHsl, type ColorHsl } from './color.ts';
import { leerArchivo, resolverTokens } from './leerCss.ts';

/**
 * DP-24 · 3.4 · LA PALETA DE LAS CATEGORÍAS SE LEE, en claro y en oscuro.
 *
 * Cada color de la paleta (`categorias.css`) trae tres tokens: franja, fondo y texto. El texto va
 * sobre el fondo (la pestaña de la categoría): debe pasar AA (4.5:1). La franja va sobre la
 * superficie de la tarjeta: debe verse (3:1, el mínimo de un elemento gráfico), en el estilo de la
 * casa (`don-poncho`) y en el base (`morphiq`), en los dos modos.
 */

const CARPETA = join(dirname(fileURLToPath(import.meta.url)), '..', 'estilos');
const paleta = leerArchivo(join(CARPETA, 'categorias.css'));
const base = leerArchivo(join(CARPETA, 'base.css'));

const color = (tokens: ReadonlyMap<string, string>, nombre: string): ColorHsl => {
  const hsl = leerHsl(tokens.get(nombre) ?? '');
  if (hsl === null) throw new Error(`El token ${nombre} no está o no es un color HSL`);
  return hsl;
};

/** Las dieciséis claves de la paleta (las mismas de `COLORES_DE_CATEGORIA` en el dominio). */
const COLORES_DE_CATEGORIA = Array.from({ length: 16 }, (_, i) => ({
  clave: `cat-${String(i + 1)}`,
}));

/** Los tokens de un estilo y modo, con la paleta de categorías encima. */
function tokens(estilo: string, modo: 'claro' | 'oscuro'): Map<string, string> {
  const hoja = leerArchivo(join(CARPETA, `${estilo}.css`));
  const raiz = `[data-estilo='${estilo}']`;
  const activos =
    modo === 'claro'
      ? [':root', raiz]
      : [':root', "[data-modo='oscuro']", raiz, `${raiz}[data-modo='oscuro']`];
  return resolverTokens([...base, ...paleta, ...hoja], activos);
}

describe('la paleta de las categorías', () => {
  it('declara franja, fondo y texto para cada color, en claro y en oscuro', () => {
    for (const modo of ['claro', 'oscuro'] as const) {
      const t = tokens('don-poncho', modo);
      for (const { clave } of COLORES_DE_CATEGORIA) {
        for (const parte of ['franja', 'fondo', 'texto']) {
          expect(
            leerHsl(t.get(`${clave}-${parte}`) ?? ''),
            `${clave} ${parte} en ${modo}`,
          ).not.toBeNull();
        }
      }
    }
  });

  for (const modo of ['claro', 'oscuro'] as const) {
    it(`en ${modo}, el texto sobre el fondo de cada color pasa AA (4.5:1)`, () => {
      const t = tokens('don-poncho', modo);
      const fallas = COLORES_DE_CATEGORIA.flatMap(({ clave }) => {
        const razon = contrasteLegible(color(t, `${clave}-texto`), color(t, `${clave}-fondo`));
        return razon >= 4.5 ? [] : [`${clave}: ${razon.toFixed(2)}:1`];
      });
      expect(fallas).toEqual([]);
    });

    for (const estilo of ['don-poncho', 'morphiq']) {
      it(`en ${modo} y estilo ${estilo}, la franja de cada color se ve sobre la superficie (3:1)`, () => {
        const t = tokens(estilo, modo);
        const superficie = color(t, 'superficie');
        const fallas = COLORES_DE_CATEGORIA.flatMap(({ clave }) => {
          const razon = contrasteLegible(color(t, `${clave}-franja`), superficie);
          return razon >= 3 ? [] : [`${clave}: ${razon.toFixed(2)}:1`];
        });
        expect(fallas).toEqual([]);
      });
    }
  }

  it('los dieciséis colores son distintos entre sí (matiz o tono, en claro)', () => {
    const t = tokens('don-poncho', 'claro');
    const huellas = COLORES_DE_CATEGORIA.map(({ clave }) => t.get(`${clave}-franja`));
    expect(new Set(huellas).size).toBe(16);
  });
});
