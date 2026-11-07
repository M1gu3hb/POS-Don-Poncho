import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as comodin from '../../app/api/[...ruta]/route';

/**
 * DP-14.6 · Un POST (o lo que sea) a una ruta de `/api` que no existe contesta 404 con JSON, no
 * 200 con la página de «no encontrada».
 */

describe('la ruta comodín de /api', () => {
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const)(
    '%s contesta 404 con un cuerpo de error',
    async (metodo) => {
      const respuesta = comodin[metodo]();
      expect(respuesta.status).toBe(404);
      const cuerpo = (await respuesta.json()) as { ok: boolean; error: { codigo: string } };
      expect(cuerpo.ok).toBe(false);
      expect(cuerpo.error.codigo).toBe('RUTA_NO_ENCONTRADA');
    },
  );

  it('no lee el cuerpo ni toca sesión o base', () => {
    const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
    const codigo = readFileSync(join(RAIZ, 'app/api/[...ruta]/route.ts'), 'utf8');
    expect(codigo).not.toMatch(/import /);
    expect(codigo).not.toMatch(/\.json\(\)\s*\)|peticion/);
  });
});
