import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import { revisar } from './contrato.mjs';
import modoCompatible from './plugin.mjs';

/**
 * DP-21 · Bloque 15 · `:has(:checked)` y `:has(:focus-visible)` EN UN MOTOR SIN `:has()`.
 *
 * `:has()` llega con Chromium 105: en el WebView del iMin la regla entera se tira, y la opción
 * elegida de una lista de opciones (`has-checked:border-primario`) o el anillo de foco de su tarjeta
 * (`has-focus-visible:ring-…`) no se ven. Un selector no se puede imitar sin JavaScript, así que el
 * plugin deja, justo después, la misma regla sobre una MARCA (`[data-tiene-checked]`,
 * `[data-tiene-focus-visible]`) dentro de `@supports not selector(:has(a))`, y
 * `compatibilidad/tiene-de-respaldo.ts` pone y quita esa marca. Un motor con `:has()` no entra al
 * bloque: no cambia nada.
 */

const SIN_HAS = '@supports not selector(:has(a))';
const compacto = (css: string): string => css.replace(/\s+/g, ' ').replace(/ ?([{}:;,]) ?/g, '$1');

async function pasar(css: string): Promise<string> {
  return compacto((await postcss([modoCompatible()]).process(css, { from: undefined })).css);
}

const REGLA = '.has-checked\\:border-primario:has(:checked){border-color:hsl(var(--primario))}';

describe('el respaldo de :has()', () => {
  it('`:has(:checked)` deja la misma regla sobre la marca `data-tiene-checked`', async () => {
    const css = await pasar(REGLA);
    expect(css).toBe(
      `${compacto(REGLA)}${compacto(SIN_HAS)}{.has-checked\\:border-primario[data-tiene-checked]{border-color:hsl(var(--primario))}}`,
    );
  });

  it('`:has(:focus-visible)` también, con su marca', async () => {
    const css = await pasar('.f:has(:focus-visible){--tw-ring-color:red}');
    expect(css).toContain('.f[data-tiene-focus-visible]{--tw-ring-color:red}');
  });

  it('un motor moderno ve lo mismo: quitado el bloque, queda la hoja de entrada', async () => {
    const salida = postcss.parse(
      (await postcss([modoCompatible()]).process(REGLA, { from: undefined })).css,
    );
    salida.walkAtRules('supports', (b) => void b.remove());
    expect(compacto(salida.toString())).toBe(compacto(REGLA));
  });

  it('los demás `:has()` (con selectores que no se pueden marcar) no se tocan', async () => {
    const otra = '.x:has(>svg){padding-inline:1px}';
    expect(await pasar(otra)).toBe(compacto(otra));
  });

  it('no repite el bloque si ya está', async () => {
    const una = (await postcss([modoCompatible()]).process(REGLA, { from: undefined })).css;
    expect(
      compacto((await postcss([modoCompatible()]).process(una, { from: undefined })).css),
    ).toBe(compacto(una));
  });
});

describe('el contrato', () => {
  it('un :has(:checked) sin su respaldo no pasa', () => {
    expect(revisar(postcss.parse(REGLA)).problemas).toEqual([
      ':has(:checked) sin respaldo sobre la marca: .has-checked\\:border-primario:has(:checked)',
    ]);
  });

  it('con su respaldo pasa y se cuenta', () => {
    const hoja = `${REGLA}${SIN_HAS}{.has-checked\\:border-primario[data-tiene-checked]{border-color:hsl(var(--primario))}}`;
    const { problemas, cuentas } = revisar(postcss.parse(hoja));
    expect(problemas).toEqual([]);
    expect(cuentas.tiene).toBe(1);
  });
});
