import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { revisarTabla, tablaCompleta, type Fila, type Modelo } from './nucleo.ts';

/**
 * DP-22 · LAS TABLAS GUARDADAS CUBREN TODO, sin PICT ni base de datos.
 *
 * Las tablas de `qa/qa-final/datos/combinaciones/` se generan una vez (`scripts/qa-final/
 * generar-combinaciones.mjs`) y se guardan junto a su modelo. Esta prueba es la que corre la CI: cada
 * terna (dinero) y cada par (ajustes) válido del modelo está en algún renglón, y ningún renglón cae
 * en una combinación prohibida, se repite o trae un valor que el modelo no tiene.
 */

const DATOS = fileURLToPath(new URL('../datos/combinaciones/', import.meta.url));
const leer = (archivo: string): unknown => JSON.parse(readFileSync(`${DATOS}${archivo}`, 'utf8'));

const CASOS = [
  { nombre: 'dinero', fuerza: 3, tabla: 'dinero.ternas.json', modelo: 'dinero.modelo.json' },
  { nombre: 'ajustes', fuerza: 2, tabla: 'ajustes.pares.json', modelo: 'ajustes.modelo.json' },
] as const;

describe.each(CASOS)('la tabla de $nombre', ({ fuerza, tabla, modelo }) => {
  const elModelo = leer(modelo) as Modelo;
  const lasFilas = leer(tabla) as Fila[];

  it(`el modelo es de fuerza ${String(fuerza)} y tiene parámetros con valores`, () => {
    expect(elModelo.fuerza).toBe(fuerza);
    expect(elModelo.parametros.length).toBeGreaterThan(2);
    for (const p of elModelo.parametros) expect(p.valores.length).toBeGreaterThan(1);
  });

  it('cubre todas las tuplas válidas, sin renglones malos ni repetidos', () => {
    const revision = revisarTabla(elModelo, lasFilas);
    expect(revision.sinCubrir).toEqual([]);
    expect(tablaCompleta(revision)).toBe(true);
    expect(revision.requeridas).toBeGreaterThan(100);
  });

  it('MUTANTE: quitarle renglones a la tabla guardada hace fallar al verificador', () => {
    const mitad = lasFilas.slice(0, Math.floor(lasFilas.length / 2));
    expect(tablaCompleta(revisarTabla(elModelo, mitad))).toBe(false);
    // Los primeros renglones del generador voraz cubren muchas tuplas nuevas: sin alguno, falta algo.
    const imprescindible = lasFilas.slice(0, 5).some(
      (_, i) =>
        !tablaCompleta(
          revisarTabla(
            elModelo,
            lasFilas.filter((__, j) => j !== i),
          ),
        ),
    );
    expect(imprescindible).toBe(true);
  });
});
