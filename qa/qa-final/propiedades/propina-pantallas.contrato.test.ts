import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * DP-22 · La propina por porcentaje se calcula en UN sitio (`propinaPorPorcentaje`, centavos enteros,
 * medio centavo hacia arriba como el servidor). Las pantallas que la ofrecen no pueden volver a la
 * cuenta en pesos de punto flotante, que daba $4,315.72 donde el servidor da $4,315.73.
 */

const PANTALLAS = [
  'apps/web/heredado/components/propinas/PropinaDialog.jsx',
  'apps/web/heredado/components/portalqr/PedirCuentaQR.jsx',
];
const leer = (ruta: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../${ruta}`, import.meta.url)), 'utf8');

describe('el cálculo de la propina en las pantallas', () => {
  it.each(PANTALLAS)('%s usa propinaPorPorcentaje y no la cuenta en punto flotante', (ruta) => {
    const texto = leer(ruta);
    expect(texto).toContain('propinaPorPorcentaje(');
    expect(texto).not.toMatch(/Math\.round\([^)]*\*\s*\(\w+\s*\/\s*100\)\s*\*\s*100\)/u);
  });
});
