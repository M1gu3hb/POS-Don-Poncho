import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * DP-15.1 (DP-D92) · LAS ESCRITURAS DE LA APP VAN DENTRO DE `conTransaccion`.
 *
 * `conTransaccion` abre `read write` explícito: una conexión del pooler heredada en sólo lectura
 * no la tumba (`solo-lectura-heredada.integracion.test.ts`). Una escritura suelta sobre
 * `obtenerDb()` no tiene esa protección y moría con `25006`. Este contrato busca las dos formas de
 * escribir suelto: el constructor de Kysely sobre `obtenerDb()` y el SQL de escritura ejecutado
 * sobre `obtenerDb()`. Las pruebas y sus ayudantes (`/pruebas/`) quedan fuera.
 */

const RAIZ = fileURLToPath(new URL('../../../', import.meta.url));
const CARPETAS = ['packages/app/src', 'packages/data/src', 'apps/web/src'];

const CONSTRUCTOR_SUELTO = /obtenerDb\(\)\s*\.\s*(insertInto|updateTable|deleteFrom|mergeInto)\b/g;
const SQL_SUELTO =
  /sql(?:<[^>]*>)?`\s*(?:insert|update|delete|merge)\b[\s\S]{0,2000}?`\s*\.execute\(\s*obtenerDb\(\)\s*\)/gi;

function archivosDeLaApp(): string[] {
  const salida = execFileSync('git', ['ls-files', ...CARPETAS], { cwd: RAIZ, encoding: 'utf8' });
  return salida
    .split('\n')
    .filter((ruta) => /\.(ts|tsx)$/.test(ruta))
    .filter((ruta) => !/\.test\.tsx?$|\/pruebas\//.test(ruta));
}

function escriturasSueltas(texto: string): string[] {
  const halladas: string[] = [];
  for (const patron of [CONSTRUCTOR_SUELTO, SQL_SUELTO]) {
    for (const coincidencia of texto.matchAll(patron)) {
      halladas.push(`línea ${String(texto.slice(0, coincidencia.index).split('\n').length)}`);
    }
  }
  return halladas;
}

describe('las escrituras de la app', () => {
  it('el detector sí ve las dos formas de escribir suelto', () => {
    expect(escriturasSueltas('await obtenerDb()\n  .updateTable("x")')).toHaveLength(1);
    expect(
      escriturasSueltas('await sql`insert into x values (1)`.execute(obtenerDb())'),
    ).toHaveLength(1);
    expect(escriturasSueltas('await obtenerDb().selectFrom("x")')).toHaveLength(0);
    expect(escriturasSueltas('await tx.updateTable("x")')).toHaveLength(0);
  });

  it('ninguna escribe sobre obtenerDb() fuera de conTransaccion', () => {
    const sueltas = archivosDeLaApp().flatMap((ruta) =>
      escriturasSueltas(readFileSync(`${RAIZ}${ruta}`, 'utf8')).map((donde) => `${ruta} ${donde}`),
    );
    expect(sueltas).toEqual([]);
  });

  it('conTransaccion pide read write en el begin', () => {
    const cliente = readFileSync(fileURLToPath(new URL('./cliente.ts', import.meta.url)), 'utf8');
    expect(cliente).toMatch(
      /export async function conTransaccion[\s\S]*?\.transaction\(\)\.setAccessMode\('read write'\)\.execute\(fn\)/,
    );
  });
});
