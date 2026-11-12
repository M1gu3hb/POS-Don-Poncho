import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * EL SIMULADOR NO ENTRA EN LA APP.
 *
 * El reloj de QA, los bots y el servidor del simulador viven en `qa/simulador/` y sólo los arranca
 * quien corre el simulador en la laptop. Si un archivo de la app los importara (o nombrara el
 * esquema `qa_reloj` o la variable del reloj), el build de Vercel los llevaría a producción. Esta
 * prueba recorre lo que el repositorio guarda de `apps/` y `packages/` (lo que Vercel construye) y
 * exige que no los mencione.
 */
const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const CARPETAS_QUE_SE_DESPLIEGAN = ['apps', 'packages'];
const EXTENSIONES = /\.(?:[cm]?[jt]sx?|json|sql)$/;
const PROHIBIDO = /qa\/simulador|qa_reloj|MORPHIQPOS_RELOJ_QA/;
const SEPARADOR = String.fromCharCode(0);

function archivos(): string[] {
  return execFileSync('git', ['ls-files', '-z', '--', ...CARPETAS_QUE_SE_DESPLIEGAN], {
    cwd: RAIZ,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split(SEPARADOR)
    .filter((ruta) => EXTENSIONES.test(ruta));
}

describe('el simulador queda fuera de lo que se despliega', () => {
  it('ningún archivo de apps/ ni packages/ menciona el simulador ni el reloj de QA', () => {
    const revisados = archivos();
    const culpables = revisados.filter((ruta) =>
      PROHIBIDO.test(readFileSync(join(RAIZ, ruta), 'utf8')),
    );
    expect(revisados.length).toBeGreaterThan(500);
    expect(culpables).toEqual([]);
  });

  it('la prueba ve una mención si la hubiera', () => {
    expect(
      PROHIBIDO.test("import { exigirCopiaLocal } from '../../qa/simulador/candado.ts';"),
    ).toBe(true);
    expect(PROHIBIDO.test('set search_path = qa_reloj, public')).toBe(true);
    expect(EXTENSIONES.test('apps/web/src/x.tsx')).toBe(true);
    expect(EXTENSIONES.test('apps/web/public/logo.png')).toBe(false);
  });
});
