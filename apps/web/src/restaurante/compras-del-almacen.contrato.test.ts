import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · EL ALMACÉN NO VE BOTONES QUE EL SERVIDOR LE NIEGA (M4 de la auditoría).
 *
 * `compras.registrar` y `gastos.registrar` son de dueño, administrador y gerente. El almacén abría
 * Compras y veía «Registrar compra» y «Registrar gasto» (403 al usarlos), y la pantalla pedía los
 * gastos y las plantillas que no puede leer (cuatro 403 en la consola).
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const codigo = () =>
  readFileSync(join(RAIZ_WEB, 'heredado', 'pages', 'Compras.jsx'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\s+/g, '');

describe('DP-15 · Compras para el almacén', () => {
  it('los botones, las plantillas y los gastos sólo para quien registra', () => {
    const c = codigo();
    expect(c).toContain("constPUEDEN_REGISTRAR=['dueno','administrador','gerente'];");
    expect(c).toContain('constregistra=PUEDEN_REGISTRAR.includes(usePuesto());');
    expect(c).toContain('{registra&&(<divclassName="gridgrid-cols-1md:grid-cols-2gap-4">');
    expect(c).toContain('{registra&&<PlantillasGastoSection/>}');
    expect(c).toContain('enabled:registra,');
  });
});
