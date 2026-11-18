import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * DP-22 · Hallazgo 17 · TODO INTERRUPTOR DE CONFIGURACIÓN TIENE NOMBRE ACCESIBLE.
 *
 * El interruptor «Modo espera en este aparato» parecía sin nombre porque la exploración sólo leía
 * `aria-label`; el nombre ya lo daba `aria-labelledby` (el título de su tarjeta), y el lector de
 * pantalla (y `getByRole('switch', { name })`) lo encuentra. Esta prueba fija la regla para que no
 * se pierda: cada `<Switch` de esta carpeta trae `aria-label`, `aria-labelledby` o un `id` que una
 * `<label htmlFor>` del mismo archivo nombra; y cuando es `aria-labelledby`, el id al que apunta
 * existe en el archivo (un `id={…}` con esa variable) — apuntar a nada deja el nombre vacío.
 */

const CARPETA = fileURLToPath(new URL('.', import.meta.url));
const archivos = readdirSync(CARPETA).filter((f) => f.endsWith('.tsx'));

interface Interruptor {
  readonly archivo: string;
  readonly propiedades: string;
  readonly texto: string;
}

/** Cada `<Switch …>` con sus propiedades (hasta el `>` que lo cierra, sin contar `=>` ni `{}` anidados). */
export function interruptoresDe(archivo: string, texto: string): Interruptor[] {
  const salida: Interruptor[] = [];
  const re = /<Switch\b/g;
  for (let m = re.exec(texto); m !== null; m = re.exec(texto)) {
    let llaves = 0;
    let i = m.index + 7;
    for (; i < texto.length; i += 1) {
      const c = texto[i];
      if (c === '{') llaves += 1;
      else if (c === '}') llaves -= 1;
      else if (c === '>' && llaves === 0 && texto[i - 1] !== '=') break;
    }
    salida.push({ archivo, propiedades: texto.slice(m.index, i), texto });
  }
  return salida;
}

const todos = archivos.flatMap((f) => interruptoresDe(f, readFileSync(join(CARPETA, f), 'utf8')));

describe('los interruptores de Configuración tienen nombre accesible', () => {
  it('hay interruptores que revisar (la prueba no se vacía)', () => {
    expect(todos.length).toBeGreaterThanOrEqual(9);
  });

  it.each(todos.map((t, i) => [`${t.archivo} #${String(i)}`, t] as const))(
    '%s trae aria-label, aria-labelledby o un id con su label',
    (_nombre, t) => {
      const conEtiqueta = /aria-label=/.test(t.propiedades);
      const conReferencia = /aria-labelledby=\{?([A-Za-z_]\w*)\}?/.exec(t.propiedades);
      const conId = /\bid=\{([A-Za-z_]\w*)\}/.exec(t.propiedades);
      expect(conEtiqueta || conReferencia !== null || conId !== null).toBe(true);
      if (conReferencia?.[1] !== undefined) {
        // El id al que apunta existe como `id={variable}` en el archivo.
        expect(t.texto).toMatch(new RegExp(String.raw`\bid=\{${conReferencia[1]}\}`));
      }
      if (!conEtiqueta && conReferencia === null && conId?.[1] !== undefined) {
        expect(t.texto).toMatch(new RegExp(String.raw`htmlFor=\{${conId[1]}\}`));
      }
    },
  );

  it('«Modo espera en este aparato» se nombra con su título', () => {
    const modo = todos.find((t) => t.archivo === 'ModoEsperaDelAparato.tsx');
    expect(modo?.propiedades).toMatch(/aria-labelledby=\{titulo\}/);
    expect(modo?.texto).toMatch(/<h3 id=\{titulo\}[^>]*>[\s\S]*Modo espera en este aparato/);
  });
});
