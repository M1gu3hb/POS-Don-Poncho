import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * QA1-5 y QA1-6 (DP-13.5) · LA CAJA DIVIDE LA CUENTA DONDE LA COBRA, Y LLAMA A CADA PARTE POR SU
 * NOMBRE. Lo prueba de punta a punta `pruebas/e2e/dividir-en-la-caja.spec.ts`; esto cuida, sin
 * navegador, que la caja heredada siga montándolo.
 */

const CAJA = readFileSync(join(__dirname, '..', '..', 'heredado', 'pages', 'Caja.jsx'), 'utf8');

describe('la caja heredada', () => {
  it('monta «Dividir» en el cobro de la cuenta de una mesa, con sus líneas', () => {
    expect(CAJA).toMatch(
      /ventaSeleccionada\?\.mesa_id && ventaSeleccionada\.total > 0 && \(\s*<DividirLaCuenta\s+ordenId=\{ventaSeleccionada\.id\}\s+lineas=\{detallesSeleccionados\}/,
    );
  });

  it('al dividir cierra el cobro de la madre y relee las pendientes', () => {
    expect(CAJA).toMatch(
      /onDividida=\{\(\) => \{\s*setVentaSeleccionada\(null\);\s*queryClient\.invalidateQueries\(\{ queryKey: \['ventas_pendientes_caja'\] \}\);/,
    );
  });

  it('cada cuenta pendiente se llama por su rótulo, no «Mesa —»', () => {
    expect(CAJA).toMatch(
      /<p className="font-heading font-bold text-base">\{rotuloDeCaja\(v\)\}<\/p>/,
    );
    expect(CAJA).not.toMatch(/Mesa \{v\.mesa_numero \|\| '—'\}/);
  });
});
