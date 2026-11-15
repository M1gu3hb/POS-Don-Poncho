import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { buscarSecreto, formasDelSecreto, LARGO_MINIMO } from './buscar-secreto.mjs';

/**
 * DP-20 · refuerzo §5 · LA CONTRASEÑA DEL PROVEEDOR NO APARECE EN LO PUBLICADO.
 *
 * La de estas pruebas es inventada. Se comprueba que la búsqueda la caza en cada forma en que
 * podría colarse, y que no dice «limpio» cuando no miró nada.
 */

const buscar = buscarSecreto;
const formas = formasDelSecreto;

const SECRETO = 'Inventada-ñ-0147!';
const carpeta = mkdtempSync(join(tmpdir(), 'buscar-secreto-'));
afterAll(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

function archivo(nombre: string, contenido: string | Buffer): void {
  const ruta = join(carpeta, nombre);
  mkdirSync(join(ruta, '..'), { recursive: true });
  writeFileSync(ruta, contenido);
}

describe('buscar la contraseña en una carpeta', () => {
  it('limpia: mira los archivos y no encuentra nada', () => {
    archivo('static/chunks/app.js', 'const saludo = "hola";');
    archivo('server/pagina.html', '<p>Sólo tu proveedor MORPHIQ puede entrar aquí</p>');
    const { mirados, hallazgos } = buscar(carpeta, SECRETO);
    expect(mirados).toBe(2);
    expect(hallazgos).toEqual([]);
  });

  it('la caza tal cual, en base64, en hexadecimal, escapada y en UTF-16', () => {
    const bytes = Buffer.from(SECRETO, 'utf8');
    archivo('fuga/tal-cual.js', `const clave = "${SECRETO}";`);
    archivo('fuga/base64.js', `atob("${bytes.toString('base64')}")`);
    archivo('fuga/hex.txt', bytes.toString('hex'));
    archivo('fuga/url.txt', `?clave=${encodeURIComponent(SECRETO)}`);
    archivo(
      'fuga/binario.exe',
      Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(SECRETO, 'utf16le')]),
    );
    const { hallazgos } = buscar(carpeta, SECRETO);
    const donde = hallazgos
      .map((h) => `${h.archivo.split(/[\\/]/).pop() ?? ''} · ${h.forma}`)
      .sort();
    expect(donde).toEqual([
      'base64.js · base64',
      'binario.exe · UTF-16',
      'hex.txt · hexadecimal',
      'tal-cual.js · tal cual',
      'url.txt · escapada para URL',
    ]);
  });

  it('no mira `node_modules` ni la caché', () => {
    archivo('node_modules/paquete/index.js', SECRETO);
    archivo('cache/algo.bin', SECRETO);
    const { hallazgos } = buscar(carpeta, SECRETO);
    expect(hallazgos.some((h) => /node_modules|cache/.test(h.archivo))).toBe(false);
  });

  it('una contraseña demasiado corta no se busca (daría falsos positivos)', () => {
    expect(LARGO_MINIMO).toBe(8);
    expect(() => buscar(carpeta, '1234')).toThrow(/al menos 8/);
  });

  it('las formas no se repiten (una contraseña sin símbolos es igual escapada que tal cual)', () => {
    const nombres = formas('sololetras').map((f) => f.nombre);
    expect(nombres).toContain('tal cual');
    expect(nombres).not.toContain('escapada para URL');
  });
});
