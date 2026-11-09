import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · EL POOL SE CIERRA ANTES DE QUE LA FUNCIÓN SE SUSPENDA.
 *
 * En Vercel con Fluid compute una función suspendida no corre sus temporizadores: las conexiones
 * ociosas no se cierran a los 10 s y, al despertar, el pooler de transacción ya pudo tirarlas.
 * `attachDatabasePool` (de `@vercel/functions`, la recomendación de Vercel para `pg`) mantiene viva
 * la función hasta que el pool las cierra. Fuera de Vercel no hace nada. (Las alertas intermitentes
 * de DP-15 resultaron ser otra cosa: un `SET` de sesión por el pooler, DP-D91.)
 *
 * Contrato de texto (el pool real necesita Vercel para probar la suspensión), validado por mutación.
 */

const CLIENTE = readFileSync(fileURLToPath(new URL('./cliente.ts', import.meta.url)), 'utf8');

describe('el pool de Postgres en Vercel', () => {
  it('se engancha con attachDatabasePool justo al crearse', () => {
    expect(CLIENTE).toContain("import { attachDatabasePool } from '@vercel/functions';");
    expect(CLIENTE).toMatch(
      /pool = new pg\.Pool\(configuracion\(cadena\)\);\s*(?:\/\/[^\n]*\n\s*)*attachDatabasePool\(pool\);/,
    );
  });
});
