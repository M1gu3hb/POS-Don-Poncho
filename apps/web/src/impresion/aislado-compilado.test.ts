import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · QA de aparatos, H-01 (bloqueante) · EL TICKET SALÍA CORTADO POR LA IZQUIERDA.
 *
 * El diálogo del ticket trae de Tailwind `translate: -50% -50%`. La regla que aísla el documento
 * al imprimir (`[data-ruta-impresion]` en `heredado/index.css`) se lo quitaba con
 * `translate: none`, pero el minificador del build (lightningcss) funde `transform: none` y
 * `translate: none` en un solo `transform: translate(0, 0)`: la propiedad `translate` desaparece
 * de la hoja servida y el diálogo imprime corrido medio ancho a la izquierda.
 *
 * La prueba pasa la hoja real por el mismo minificador y exige que la regla conserve su
 * `translate` propio.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const desdeNext = createRequire(
  createRequire(join(RAIZ, 'package.json')).resolve('next/package.json'),
);
const { transform } = desdeNext('lightningcss') as {
  transform: (opciones: {
    filename: string;
    code: Buffer;
    minify: boolean;
    errorRecovery: boolean;
  }) => { code: Buffer };
};

const reglaCompilada = (selector: string): string => {
  const hoja = transform({
    filename: 'index.css',
    code: readFileSync(join(RAIZ, 'heredado', 'index.css')),
    minify: true,
    errorRecovery: true,
  }).code.toString();
  const inicio = hoja.indexOf(`${selector}{`);
  expect(inicio).toBeGreaterThan(-1);
  return hoja.slice(inicio, hoja.indexOf('}', inicio));
};

describe('el aislado de impresión, como lo sirve el build', () => {
  it('los contenedores del documento pierden el `translate` del diálogo', () => {
    const regla = reglaCompilada('[data-ruta-impresion]');
    expect(regla).toMatch(/[{;]translate:/);
  });
});
