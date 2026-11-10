import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * DP-15.1 (DP-D92) · LAS ESCRITURAS DE LA APP VAN DENTRO DE `conTransaccion`.
 *
 * `conTransaccion` abre `read write` explícito: una conexión del pooler heredada en sólo lectura
 * no la tumba (`solo-lectura-heredada.integracion.test.ts`). Una escritura suelta sobre
 * `obtenerDb()` no tiene esa protección y moría con `25006`. Este contrato busca las formas de
 * escribir suelto: el constructor de Kysely sobre `obtenerDb()`, el SQL de escritura ejecutado
 * sobre `obtenerDb()` y —desde DP-16— las dos MISMAS cosas a través de una variable
 * (`const db = obtenerDb(); db.updateTable(…)`). Las pruebas y sus ayudantes (`/pruebas/`) quedan fuera.
 */

const RAIZ = fileURLToPath(new URL('../../../', import.meta.url));
const CARPETAS = ['packages/app/src', 'packages/data/src', 'apps/web/src'];

const ESCRITURAS = String.raw`(?:insertInto|updateTable|deleteFrom|mergeInto)\b`;
const CONSTRUCTOR_SUELTO = /obtenerDb\(\)\s*\.\s*(insertInto|updateTable|deleteFrom|mergeInto)\b/g;
const SQL_SUELTO =
  /sql(?:<[^>]*>)?`\s*(?:insert|update|delete|merge)\b[\s\S]{0,2000}?`\s*\.execute\(\s*obtenerDb\(\)\s*\)/gi;
/** `const db = obtenerDb();` (con o sin tipo): la conexión suelta guardada en una variable. */
const ALIAS_DE_LA_CONEXION = /\b(?:const|let|var)\s+([\w$]+)\s*(?::[^=;]+)?=\s*obtenerDb\(\)/g;

function patronesDelAlias(nombre: string): RegExp[] {
  const n = nombre.replace(/\$/g, String.raw`\$`);
  return [
    new RegExp(String.raw`(?<![\w$.])${n}\s*\.\s*${ESCRITURAS}`, 'g'),
    new RegExp(
      String.raw`sql(?:<[^>]*>)?` +
        '`' +
        String.raw`\s*(?:insert|update|delete|merge)\b[\s\S]{0,2000}?` +
        '`' +
        String.raw`\s*\.execute\(\s*${n}\s*\)`,
      'gi',
    ),
  ];
}

function archivosDeLaApp(): string[] {
  const salida = execFileSync('git', ['ls-files', ...CARPETAS], { cwd: RAIZ, encoding: 'utf8' });
  return salida
    .split('\n')
    .filter((ruta) => /\.(ts|tsx)$/.test(ruta))
    .filter((ruta) => !/\.test\.tsx?$|\/pruebas\/|\/pruebas\.ts$/.test(ruta));
}

function escriturasSueltas(texto: string): string[] {
  const patrones: RegExp[] = [CONSTRUCTOR_SUELTO, SQL_SUELTO];
  // Cada patrón del alias vale desde donde se declara: un parámetro `db` de una función anterior
  // (otra variable con el mismo nombre) no es la conexión suelta.
  const desde = new Map<RegExp, number>();
  for (const alias of texto.matchAll(ALIAS_DE_LA_CONEXION)) {
    for (const patron of patronesDelAlias(alias[1] ?? '')) {
      patrones.push(patron);
      desde.set(patron, alias.index);
    }
  }
  const halladas: string[] = [];
  for (const patron of patrones) {
    for (const coincidencia of texto.matchAll(patron)) {
      if (coincidencia.index < (desde.get(patron) ?? 0)) continue;
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

  it('y ve la escritura suelta a través de una variable (const db = obtenerDb())', () => {
    // Antes de DP-16 estas dos pasaban sin que nadie las viera.
    expect(
      escriturasSueltas('const db = obtenerDb();\nawait db.updateTable("x").set({}).execute();'),
    ).toHaveLength(1);
    expect(
      escriturasSueltas(
        'const conexion = obtenerDb();\nawait sql`delete from x`.execute(conexion);',
      ),
    ).toHaveLength(1);
    // Leer por la variable, o escribir con la transacción, sigue siendo legítimo.
    expect(
      escriturasSueltas('const db = obtenerDb();\nawait db.selectFrom("x").selectAll().execute();'),
    ).toHaveLength(0);
    expect(escriturasSueltas('const db = obtenerDb();\nawait tx.updateTable("x");')).toHaveLength(
      0,
    );
    // Otro objeto que sólo termina en «db» no es la conexión suelta.
    expect(
      escriturasSueltas('const db = obtenerDb();\nawait otrodb.updateTable("x");'),
    ).toHaveLength(0);
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
