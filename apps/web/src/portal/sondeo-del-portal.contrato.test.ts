import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SONDEO_DEL_PORTAL_MS } from './sondeo-del-portal';

/**
 * DP-15 · LA CAPACIDAD (docs/infra/CAPACIDAD.md). El portal del comensal volvía a bajar su estado
 * completo (el menú con sus 107 platillos) cada 4 s: con 10 teléfonos abiertos toda la jornada,
 * Vercel se pasaba del crédito del equipo. El estado completo se sondea más despacio; el carrito
 * compartido sigue con su sondeo ligero, cada comando del comensal refresca al instante, y al volver
 * a la pantalla (desbloquear el teléfono) se refresca en el momento.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const PORTAL = readFileSync(join(RAIZ, 'heredado/pages/PortalCliente.jsx'), 'utf8');

const consultaDelPortal = (): string => {
  const inicio = PORTAL.indexOf("queryKey: ['portal_publico', token]");
  expect(inicio).toBeGreaterThan(-1);
  return PORTAL.slice(inicio, PORTAL.indexOf('});', inicio));
};

describe('el sondeo del portal del comensal', () => {
  it('va cada 10 a 15 s: el agotado y la mesa abierta llegan a tiempo y el menú no se baja de más', () => {
    expect(SONDEO_DEL_PORTAL_MS).toBeGreaterThanOrEqual(10_000);
    expect(SONDEO_DEL_PORTAL_MS).toBeLessThanOrEqual(15_000);
  });

  it('la consulta pública lo usa y se refresca al volver a la pantalla', () => {
    const consulta = consultaDelPortal();
    expect(consulta).toContain('refetchInterval: SONDEO_DEL_PORTAL_MS,');
    expect(consulta).toContain('refetchOnWindowFocus: true,');
  });
});
