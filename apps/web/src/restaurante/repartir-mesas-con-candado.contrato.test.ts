import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-14 · ronda 2 (revisión) · REPARTIR MESAS NO SE CRUZA CON UNA BAJA.
 *
 * Repartir lee al mesero «activo» y después le asigna las mesas. Si en ese instante el dueño lo
 * desactiva (lo que suelta sus mesas, `empleados.ts`), sin candado repartir escribía DESPUÉS y las
 * mesas quedaban atadas a alguien que ya no atiende: invisibles para el salón. Con `forUpdate` en
 * la fila del mesero, la baja espera a que termine el reparto (y suelta también esas mesas) o el
 * reparto espera a la baja y ya no lo encuentra activo. El contrato lee el comando.
 */

const COMANDO = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'app',
  'src',
  'restaurante',
  'repartir-mesas.ts',
);

describe('restaurante.repartir_mesas', () => {
  it('lee al mesero bloqueando su fila', () => {
    expect(readFileSync(COMANDO, 'utf8')).toMatch(
      /\.where\('rol', '=', 'mesero'\)\s*\.where\('activo', '=', true\)\s*\.forUpdate\(\)\s*\.executeTakeFirst\(\)/,
    );
  });
});
