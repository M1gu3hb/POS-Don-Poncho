import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TARJETAS } from './secciones.ts';

/**
 * DP-21 · Bloque 14 · CADA CLAVE QUE LA PANTALLA GUARDA TIENE QUIEN LA LEE.
 *
 * Miguel encontró que el campo del IVA no estaba conectado a nada. Esta prueba recorre las claves
 * de `configuracion.valores` que guarda cada tarjeta de la Configuración y exige que alguien, fuera
 * de la propia lista de ajustes, la nombre: el servidor al cobrar, imprimir o armar el corte, o una
 * pantalla. Una clave sin lector sólo puede estar en `SIN_LECTOR` con SU razón (y la prueba falla
 * al revés: si ya tiene lector, la fila sobra).
 */
const RAIZ = join(__dirname, '..', '..', '..', '..');
const RAICES = [
  'apps/web/src',
  'apps/web/heredado',
  'apps/web/app',
  'packages/app/src',
  'packages/domain/src',
];
const SALTAR = new Set(['node_modules', '.next', 'dist']);
/** Quien sólo DECLARA la clave (el mapa, los formularios, los valores por omisión) no la lee. */
const SOLO_DECLARAN = [
  /configuracion[\\/]secciones\.ts$/,
  /configuracion[\\/]ajustes-de-tarjetas\.ts$/,
  /configuracion[\\/]inventario[\\/]destinos\.ts$/,
  /puente[\\/]configuracion\.ts$/,
  /ConfigContext\.jsx$/,
  // Los formularios que ESCRIBEN la clave tampoco son quien la lee.
  /IdentidadNegocio\.jsx$/,
  /ConfiguracionQRTab\.jsx$/,
];

/** Las que hoy ninguno lee, y por qué se quedan (no se borra nada sin el visto bueno de Miguel). */
export const SIN_LECTOR: Readonly<Record<string, string>> = {
  permitir_venta_sin_stock:
    'Decide cada producto (`productos.permite_venta_sin_stock`) y, desde DP-D116, lo que pasó por cocina se cobra aunque no haya existencia. El interruptor del negocio queda en Avanzado diciéndolo; no cambia el cobro.',
};

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    if (SALTAR.has(nombre)) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(ts|tsx|js|jsx)$/.test(nombre) && !nombre.includes('.test.')) salida.push(ruta);
  }
  return salida;
}

/** Un comentario que nombra la clave no es un lector. */
const sinComentarios = (codigo: string): string =>
  codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const textos = RAICES.flatMap((r) => archivos(join(RAIZ, r)))
  .filter((ruta) => !SOLO_DECLARAN.some((d) => d.test(relative(RAIZ, ruta))))
  .map((ruta) => sinComentarios(readFileSync(ruta, 'utf8')));

const lee = (clave: string): boolean => {
  const reglas = new RegExp(`(?<![a-z_])${clave}(?![a-z_])`);
  return textos.some((t) => reglas.test(t));
};

const CLAVES = [...new Set(TARJETAS.flatMap((t) => t.guarda))].sort();

describe('cada clave que la Configuración guarda tiene quien la lee', () => {
  it('hay claves que revisar', () => {
    expect(CLAVES.length).toBeGreaterThan(40);
  });

  it('ninguna clave queda sin lector, salvo las declaradas con su razón', () => {
    const sinLector = CLAVES.filter((c) => !lee(c) && SIN_LECTOR[c] === undefined);
    expect(sinLector).toEqual([]);
  });

  it('una clave declarada sin lector que ya tiene uno sobra en la lista', () => {
    const sobran = Object.keys(SIN_LECTOR).filter((c) => lee(c));
    expect(sobran).toEqual([]);
  });

  it('toda excepción dice por qué', () => {
    for (const [clave, razon] of Object.entries(SIN_LECTOR)) {
      expect(razon.length, clave).toBeGreaterThan(40);
      expect(CLAVES, clave).toContain(clave);
    }
  });
});
