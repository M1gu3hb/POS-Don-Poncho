import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LIMITES } from './limite.ts';

/**
 * DP-14.6 · EL PIN DEL SUPERVISOR TIENE SU PROPIO CUBO. Los PIN fallidos de un gerente en la caja
 * no gastan la cuota de «entrar» de toda la IP del restaurante (todo el local sale por la misma).
 */

const RUTA = fileURLToPath(
  new URL('../../../../apps/web/app/api/identidad/supervisor/route.ts', import.meta.url),
);

describe('el cubo del PIN de supervisor', () => {
  it('es otro que el de entrar', () => {
    expect(LIMITES).toHaveProperty('supervisor');
    expect(LIMITES.supervisor).not.toBe(LIMITES.entrar);
  });

  it('la ruta cuenta y devuelve en SU cubo, nunca en el de «entrar»', () => {
    const codigo = readFileSync(RUTA, 'utf8');
    expect(codigo).toMatch(/permitir\('supervisor'/);
    expect(codigo).toMatch(/devolver\('supervisor'/);
    expect(codigo).not.toMatch(/permitir\('entrar'/);
    expect(codigo).not.toMatch(/devolver\('entrar'/);
  });
});
