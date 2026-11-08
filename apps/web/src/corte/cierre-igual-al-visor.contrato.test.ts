import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · F2 (auditoría 1, M5) · EL PDF DEL CIERRE LEE LO MISMO QUE EL VISOR.
 *
 * `CorteEnPdf` (el documento que baja al cerrar, tanto en `/restaurante/cierre-diario-y-arqueo`
 * como en la Caja) tiene que pedir los descuentos con quién y por qué —igual que el visor de
 * Registros— y dárselos al armado del documento; y el visor y el documento dicen cada línea con
 * el mismo texto (`textoDeLaLinea`). Pantallas con JavaScript heredado: el contrato lee su texto.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

describe('el documento del cierre y el visor de Registros', () => {
  it('el PDF del cierre lee los descuentos del servidor y se los da al documento', () => {
    const pdf = leer('src/corte/CorteEnPdf.tsx');
    expect(pdf).toMatch(/leerDescuentosDelCorte\(sesionCajaId\)/);
    expect(pdf).toMatch(/documentoDelCorte\(hoja, descuentos\)/);
  });

  it('el visor (CorteTicket) dice cada línea con el mismo texto que el documento', () => {
    const ticket = leer('heredado/components/tickets/CorteTicket.jsx');
    expect(ticket).toMatch(/import \{ textoDeLaLinea \} from '~\/corte\/linea-de-venta'/);
    expect(ticket).toMatch(/textoDeLaLinea\(\{/);
    const hoja = leer('src/corte/hoja.ts');
    expect(hoja).toMatch(/textoDeLaLinea\(\{/);
  });
});
