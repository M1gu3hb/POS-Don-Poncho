import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · «9 VENTAS» Y «VENTAS (13)» DICEN QUÉ CUENTA CADA UNO (informativo QA2-A5).
 *
 * El resumen de Registros cuenta las ventas COBRADAS del periodo; la pestaña lista todas, también
 * las canceladas y las divididas. Los dos números eran correctos y parecían contradecirse.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string) => readFileSync(join(RAIZ_WEB, ruta), 'utf8').replace(/\s+/g, '');

describe('DP-15 · los conteos de Registros', () => {
  it('el resumen dice «cobradas» y la pestaña, cuántas de la lista lo están', () => {
    expect(leer('heredado/components/registros/ResumenPeriodo.jsx')).toContain(
      "sub={`${totals.nVentas}${totals.nVentas===1?'ventacobrada':'ventascobradas'}`}",
    );
    expect(leer('heredado/pages/Registros.jsx')).toContain(
      "`·${ventasFiltradas.filter((v)=>v?.estado==='pagada').length}cobradas`",
    );
  });
});
