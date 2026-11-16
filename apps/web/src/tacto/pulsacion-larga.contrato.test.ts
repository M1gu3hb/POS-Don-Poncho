import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 9 · M4 · LA PULSACIÓN LARGA NO SELECCIONA NADA: el cableado, leído.
 *
 * La lógica (qué menú se queda, el oyente) tiene su prueba unitaria. Esto comprueba que está
 * CONECTADA: la hoja se importa, las reglas existen y el armazón monta la pieza exactamente una vez.
 * Se valida mutando el código real.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

/** Parte un selector por sus comas de primer nivel (no las de dentro de :is(...) ni de [...]). */
function separarPorComas(selector: string): string[] {
  const partes: string[] = [];
  let profundidad = 0;
  let actual = '';
  for (const c of selector) {
    if (c === '(' || c === '[') profundidad += 1;
    if (c === ')' || c === ']') profundidad -= 1;
    if (c === ',' && profundidad === 0) {
      partes.push(actual);
      actual = '';
    } else actual += c;
  }
  return [...partes, actual];
}

describe('la hoja de «sin selección»', () => {
  const css = leer('src/tacto/sin-seleccion.css');

  it('la importa la hoja global, después de la heredada', () => {
    const globales = leer('app/globals.css');
    expect(globales).toMatch(/@import '\.\.\/src\/tacto\/sin-seleccion\.css';/);
    expect(globales.indexOf('sin-seleccion.css')).toBeGreaterThan(
      globales.indexOf("'../heredado/index.css'"),
    );
  });

  it('quita la selección y el menú táctil de todo el POS, con y sin prefijo', () => {
    expect(css).toMatch(/html\[data-pos-tactil\] body \{[^}]*-webkit-user-select: none;/);
    expect(css).toMatch(/html\[data-pos-tactil\] body \{[^}]*\buser-select: none;/);
    expect(css).toMatch(/html\[data-pos-tactil\] body \{[^}]*-webkit-touch-callout: none;/);
  });

  it('sólo en el POS: cada selector de cada regla cuelga de la marca del <html>, que el portal no pone', () => {
    const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const reglas = [...sinComentarios.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map((m) => (m[1] ?? '').replace('@layer base', '').trim())
      .filter((s) => s !== '');
    expect(reglas.length).toBeGreaterThan(0);
    for (const regla of reglas) {
      for (const selector of separarPorComas(regla)) {
        expect(selector.trim()).toMatch(/^html\[data-pos-tactil\]/);
      }
    }
  });

  it('los campos de texto, los contenteditable y lo marcado `data-seleccionable` sí se seleccionan', () => {
    for (const parte of ['input', 'textarea', 'contenteditable', 'data-seleccionable']) {
      expect(css).toContain(parte);
    }
    expect(css).toMatch(/-webkit-user-select: text;/);
    expect(css).toMatch(/\buser-select: text;/);
  });

  it('va en `@layer base`: una utilidad (`select-text`) que alguien pida a propósito, gana', () => {
    expect(css).toMatch(/@layer base \{/);
  });
});

describe('el armazón monta lo táctil una sola vez', () => {
  const layout = leer('heredado/components/common/AppLayout.jsx');

  it('AppLayout monta <ArmazonTactil /> exactamente una vez', () => {
    expect(layout).toMatch(/import \{ ArmazonTactil \} from '~\/tacto\/ArmazonTactil';/);
    expect(layout.match(/<ArmazonTactil \/>/g)).toHaveLength(1);
  });

  it('el portal del comensal (sus páginas) no monta ni el armazón ni lo táctil', () => {
    for (const ruta of ['app/qr/[token]/page.tsx', 'app/n/[negocio]/page.tsx']) {
      const codigo = leer(ruta);
      expect(codigo).not.toMatch(/ArmazonTactil|AppLayout/);
    }
  });

  it('ArmazonTactil conecta el oyente de contextmenu y la marca', () => {
    const armazon = leer('src/tacto/ArmazonTactil.tsx');
    expect(armazon).toMatch(/montarSinMenuNativo\(document\)/);
  });
});

describe('el globo de la mesa y la mesa', () => {
  it('el globo no deja seleccionar su texto ni sacar el menú del sistema', () => {
    const globo = leer('src/restaurante/portal-mesero/MenuDeLaMesa.tsx');
    expect(globo).toMatch(/\bselect-none\b/);
    expect(globo).toMatch(/\[-webkit-touch-callout:none\]/);
  });

  it('al abrir el globo se suelta lo que el navegador alcanzó a seleccionar', () => {
    const pulsacion = leer('src/restaurante/portal-mesero/use-pulsacion-larga.ts');
    expect(pulsacion).toMatch(/getSelection\(\)\?\.removeAllRanges\(\)/);
  });

  it('la mesa del mapa no se selecciona (select-none y sin menú táctil)', () => {
    const mesa = leer('heredado/components/mesas/MesaShape.jsx');
    expect(mesa).toMatch(/select-none \[-webkit-touch-callout:none\]/);
  });
});
