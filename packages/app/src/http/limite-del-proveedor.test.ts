import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * X4 · La ruta deja el rastro del bloqueo ANTES de contestar 429, y sólo en el primer rechazo.
 * (La fila misma y el tope por IP se prueban contra Postgres en `limite-del-proveedor.integracion.test.ts`.)
 */
const RUTA = fileURLToPath(
  new URL('../../../../apps/web/app/api/proveedor/entrar/route.ts', import.meta.url),
);

describe('/api/proveedor/entrar y su tope', () => {
  it('cuenta en el cubo «proveedor» y, al rechazar, deja rastro del primer rechazo antes del 429', () => {
    const codigo = readFileSync(RUTA, 'utf8');
    const rechazo = codigo.slice(codigo.indexOf('if (!permiso.ok)'));
    expect(codigo).toMatch(/permitir\('proveedor'/);
    expect(rechazo).toContain("esElPrimerRechazo('proveedor', permiso)");
    expect(rechazo.indexOf('dejarRastroDelBloqueo(')).toBeGreaterThan(-1);
    expect(rechazo.indexOf('dejarRastroDelBloqueo(')).toBeLessThan(rechazo.indexOf('negar(429'));
  });
});
