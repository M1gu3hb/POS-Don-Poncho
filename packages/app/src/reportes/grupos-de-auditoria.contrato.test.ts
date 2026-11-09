import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { GRUPOS_DE_AUDITORIA } from '@morphiqpos/domain/auditoria';
import { describe, expect, it } from 'vitest';

/**
 * DP-15.1 · Cada acción de un grupo de la auditoría es un comando REAL del catálogo y de los que
 * escriben (los que leen no dejan renglón de cambio). Si se renombra un comando, esto falla en vez
 * de dejar un filtro que nunca encuentra nada.
 */

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return fuentes(ruta);
    return e.name.endsWith('.ts') && !e.name.includes('.test.') ? [ruta] : [];
  });
}

describe('DP-15.1 · los grupos de la auditoría nombran comandos reales que escriben', () => {
  const raiz = join(
    process.cwd().includes('packages') ? process.cwd() : join(process.cwd(), 'packages', 'app'),
    'src',
  );
  const texto = fuentes(raiz)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  for (const [grupo, { acciones }] of Object.entries(GRUPOS_DE_AUDITORIA)) {
    for (const accion of acciones) {
      it(`${grupo}: «${accion}» existe y escribe`, () => {
        const patron = new RegExp(
          String.raw`nombre:\s*'${accion.replace('.', '[.]')}',\s*entidad:\s*'[a-z_]+',\s*escribe:\s*true`,
        );
        expect(texto).toMatch(patron);
      });
    }
  }
});
