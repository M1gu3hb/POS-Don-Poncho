import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import { aRgb, valorSinColoresNuevos } from './colores-nuevos.mjs';
import modoCompatible from './plugin.mjs';

/**
 * DP-21 · Bloque 15 · LOS COLORES DE ESPACIOS NUEVOS (`lab()`, `lch()`, `oklab()`, `oklch()`).
 *
 * Chromium 111 los introdujo. Tailwind 4 escribe su paleta de fábrica en esos espacios
 * (`--color-gray-100: lab(…)`): en el WebView del iMin (99–103) el valor de la variable es válido
 * como variable pero INVÁLIDO al usarse, y la propiedad que la usa queda sin color. El plugin deja,
 * justo después, un bloque `@supports not (color: lab(0% 0 0))` que redefine la variable en `rgb()`.
 * Un motor moderno no entra al bloque: no cambia nada.
 */

const SIN_COLORES = '@supports not (color:lab(0% 0 0))';
const compacto = (css: string): string => css.replace(/\s+/g, ' ').replace(/ ?([{}:;,]) ?/g, '$1');

async function pasar(css: string): Promise<string> {
  return (await postcss([modoCompatible()]).process(css, { from: undefined })).css;
}

const cerca = (obtenido: readonly number[], esperado: readonly number[], margen = 2): void => {
  expect(obtenido).toHaveLength(3);
  esperado.forEach((canal, i) => {
    expect(Math.abs((obtenido[i] ?? 0) - canal)).toBeLessThanOrEqual(margen);
  });
};

describe('la conversión a sRGB', () => {
  it('lab() de la paleta de Tailwind: el gris 100 es #f3f4f6', () => {
    cerca(aRgb('lab(96.1596% -.082314 -1.13575)')?.rgb ?? [], [243, 244, 246]);
  });

  it('lab(): el gris medio y el blanco', () => {
    cerca(aRgb('lab(50% 0 0)')?.rgb ?? [], [119, 119, 119]);
    cerca(aRgb('lab(100% 0 0)')?.rgb ?? [], [255, 255, 255], 1);
  });

  it('lab(): los casi negros usan la parte lineal del gamma (12.92)', () => {
    cerca(aRgb('lab(1% 0 0)')?.rgb ?? [], [4, 4, 4], 0);
  });

  it('oklch(): el rojo de la paleta es el rojo', () => {
    cerca(aRgb('oklch(62.8% 0.2577 29.23)')?.rgb ?? [], [255, 0, 0], 3);
  });

  it('oklab() y lch()', () => {
    cerca(aRgb('oklab(0.5 0 0)')?.rgb ?? [], [99, 99, 99]);
    cerca(aRgb('lch(50% 0 0)')?.rgb ?? [], [119, 119, 119]);
  });

  it('el alfa viaja, en porcentaje o en fracción', () => {
    expect(aRgb('oklch(62.8% 0.2577 29.23 / 50%)')?.alfa).toBe(50);
    expect(aRgb('lab(50% 0 0 / .25)')?.alfa).toBe(25);
  });

  it('un componente `none` vale cero; lo que no se entiende, null', () => {
    cerca(aRgb('lab(50% none none)')?.rgb ?? [], [119, 119, 119]);
    expect(aRgb('hsl(var(--x))')).toBeNull();
    expect(aRgb('lab(var(--l) 0 0)')).toBeNull();
    expect(aRgb('#fff')).toBeNull();
  });

  it('un valor con varios colores cambia cada uno', () => {
    const v = valorSinColoresNuevos('0 0 0 1px lab(50% 0 0), 0 0 2px oklab(0.5 0 0 / 40%)');
    expect(v).toMatch(/^0 0 0 1px rgb\(\d+ \d+ \d+\), 0 0 2px rgb\(\d+ \d+ \d+ \/ 40%\)$/);
  });
});

describe('el plugin', () => {
  const gris = ':root,:host{--color-gray-100:lab(96.1596% -.082314 -1.13575)}';

  it('redefine la variable en rgb() dentro de un bloque `@supports not`, pegado a su regla', async () => {
    const css = compacto(await pasar(`@layer theme{${gris}}`));
    expect(css).toContain(`${gris}${SIN_COLORES}{:root,:host{--color-gray-100:rgb(`);
  });

  it('un motor moderno ve lo mismo que antes: quitado el bloque, queda la hoja de entrada', async () => {
    const entrada = `@layer theme{${gris}}.a{color:red}`;
    const salida = postcss.parse(await pasar(entrada));
    salida.walkAtRules('supports', (b) => void b.remove());
    expect(compacto(salida.toString())).toBe(compacto(entrada));
  });

  it('lo que se usa directo en una propiedad también: color, fondo, sombra', async () => {
    const css = compacto(
      await pasar(
        '.x{background-color:oklch(62.8% .2577 29.23);box-shadow:0 0 0 3px lab(50% 0 0)}',
      ),
    );
    expect(css).toMatch(
      /\.x\{background-color:oklch\([^)]*\);box-shadow:0 0 0 3px lab\([^)]*\)\}@supports not \(color:lab\(0% 0 0\)\)\{\.x\{background-color:rgb\(\d+ \d+ \d+\);box-shadow:0 0 0 3px rgb\(\d+ \d+ \d+\)\}\}/,
    );
  });

  it('no toca hex, hsl ni nombres, ni repite el bloque si ya lo trae', async () => {
    const sin = '.a{color:#fff;background:hsl(var(--x));border-color:red}';
    expect(await pasar(sin)).toBe(sin);
    const una = await pasar(`@layer theme{${gris}}`);
    expect(await pasar(una)).toBe(una);
  });

  it('un color que no se puede calcular se avisa, no se esconde', async () => {
    const r = await postcss([modoCompatible()]).process('.a{color:lab(var(--l) 0 0)}', {
      from: undefined,
    });
    expect(
      r
        .warnings()
        .map((a) => a.text)
        .join('|'),
    ).toMatch(/sin respaldo.*color/);
  });
});
