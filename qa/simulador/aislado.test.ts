import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * EL SIMULADOR NO ENTRA EN LA APP.
 *
 * El reloj de QA, los bots y el servidor del simulador viven en `qa/simulador/` y sólo los arranca
 * quien corre el simulador en la laptop. Si un archivo de la app los importara (o nombrara el
 * esquema `qa_reloj` o la variable del reloj), el build de Vercel los llevaría a producción. Esta
 * prueba busca, con `git grep`, en lo que el repositorio guarda de `apps/` y `packages/` (lo que
 * Vercel construye) y exige que nada los mencione.
 */
const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const CARPETAS_QUE_SE_DESPLIEGAN = ['apps', 'packages'];
const PROHIBIDO = 'qa/simulador|qa_reloj|MORPHIQPOS_RELOJ_QA';

function git(args: readonly string[]): { estado: number; salida: string } {
  try {
    const salida = execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' });
    return { estado: 0, salida };
  } catch (error: unknown) {
    const e = error as { status?: number; stdout?: string };
    return { estado: e.status ?? -1, salida: e.stdout ?? '' };
  }
}

/** Los archivos que mencionan el patrón (git grep sale con 1 cuando no hay ninguno). */
function quienesMencionan(patron: string, carpetas: readonly string[]): string[] {
  const r = git(['grep', '-l', '-E', patron, '--', ...carpetas]);
  if (r.estado === 1) return [];
  if (r.estado !== 0) throw new Error(`git grep falló (${String(r.estado)})`);
  return r.salida.split('\n').filter((l) => l.trim() !== '');
}

describe('el simulador queda fuera de lo que se despliega', () => {
  it('ningún archivo de apps/ ni packages/ menciona el simulador ni el reloj de QA', () => {
    const guardados = git(['ls-files', '--', ...CARPETAS_QUE_SE_DESPLIEGAN]).salida.split('\n');
    expect(guardados.length).toBeGreaterThan(500);
    expect(quienesMencionan(PROHIBIDO, CARPETAS_QUE_SE_DESPLIEGAN)).toEqual([]);
  });

  it('la búsqueda sí ve una mención cuando la hay', () => {
    // El propio simulador se nombra a sí mismo: la misma búsqueda sobre qa/ lo encuentra.
    expect(quienesMencionan(PROHIBIDO, ['qa/simulador']).length).toBeGreaterThan(0);
  });
});
