import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

/**
 * EL RELOJ DE QA NUNCA SE ENCIENDE EN PRODUCCIÓN.
 *
 * El reloj vive en dos piezas que sólo arranca el simulador: `precarga.ts` (el `Date` del servidor) y
 * `en-la-base.ts` (el `now()` de la copia). Las dos pasan por el candado antes de tocar nada. Estas
 * pruebas las arrancan de verdad, en procesos hijos, con el entorno de Vercel, con la base de
 * producción y con una copia local: sólo la copia local pasa. Ninguna se conecta a nada.
 */
const CARPETA = fileURLToPath(new URL('.', import.meta.url));
const PRECARGA = join(CARPETA, 'precarga.ts');
const EN_LA_BASE = join(CARPETA, 'en-la-base.ts');
const COPIA = 'postgres://morphiqpos@localhost:5460/qa_dp18_prueba';
const PRODUCCION =
  'postgres://postgres.mqlcusxwqrefpfttjjks:x@aws-0-us-east-2.pooler.supabase.com:5432/postgres';

const temporal = mkdtempSync(join(tmpdir(), 'reloj-qa-'));
const ARCHIVO = join(temporal, 'reloj.json');
// Las 8:00 simuladas del 16 de noviembre, a velocidad normal.
const SIMULADA = Date.parse('2026-11-16T14:00:00.000Z');
writeFileSync(ARCHIVO, JSON.stringify({ baseReal: Date.now(), baseSim: SIMULADA, factor: 1 }));
afterAll(() => {
  rmSync(temporal, { recursive: true, force: true });
});

/** El entorno de la prueba sin nada de Vercel ni bases heredadas del proceso que corre vitest. */
function entornoLimpio(extra: Record<string, string>): NodeJS.ProcessEnv {
  const limpio: NodeJS.ProcessEnv = {};
  for (const llave of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE']) {
    const valor = process.env[llave];
    if (valor !== undefined) limpio[llave] = valor;
  }
  return { ...limpio, ...extra };
}

function conLaPrecarga(extra: Record<string, string>) {
  return spawnSync(
    process.execPath,
    // `--import` quiere una URL: en Windows una ruta `D:…` la toma por un esquema `d:`.
    ['--import', pathToFileURL(PRECARGA).href, '-e', 'process.stdout.write(String(Date.now()))'],
    { env: entornoLimpio(extra), encoding: 'utf8', timeout: 30_000 },
  );
}

// Cada prueba arranca uno o dos procesos de Node: el tope de 5 s de la unidad es corto en una laptop cargada.
describe('el reloj de QA en el servidor (precarga.ts)', { timeout: 30_000 }, () => {
  it('con una copia local arranca y el proceso ve la hora simulada', () => {
    const r = conLaPrecarga({
      MORPHIQPOS_RELOJ_QA: ARCHIVO,
      APP_URL: 'http://localhost:32800',
      DATABASE_URL: COPIA,
    });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    const visto = Number(r.stdout);
    expect(Math.abs(visto - SIMULADA)).toBeLessThan(60_000);
  });

  it('no arranca dentro de Vercel', () => {
    const r = conLaPrecarga({
      MORPHIQPOS_RELOJ_QA: ARCHIVO,
      APP_URL: 'http://localhost:32800',
      DATABASE_URL: COPIA,
      VERCEL: '1',
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/Candado del simulador: este proceso corre en Vercel/);
  });

  it('no arranca con la base de producción ni con la URL de producción', () => {
    const conBase = conLaPrecarga({
      MORPHIQPOS_RELOJ_QA: ARCHIVO,
      APP_URL: 'http://localhost:32800',
      DATABASE_URL: PRODUCCION,
    });
    expect(conBase.status).not.toBe(0);
    expect(conBase.stderr).toMatch(/proyecto real mqlcusxwqrefpfttjjks/);

    const conUrl = conLaPrecarga({
      MORPHIQPOS_RELOJ_QA: ARCHIVO,
      APP_URL: 'https://pos-don-poncho.vercel.app',
      DATABASE_URL: COPIA,
    });
    expect(conUrl.status).not.toBe(0);
    expect(conUrl.stderr).toMatch(/PRODUCCIÓN/);
  });

  it('sin base declarada tampoco arranca: no hay copia que demuestre que no es producción', () => {
    const r = conLaPrecarga({ MORPHIQPOS_RELOJ_QA: ARCHIVO, APP_URL: 'http://localhost:32800' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/Candado del simulador/);
  });
});

describe('el reloj de QA en la base (en-la-base.ts)', { timeout: 30_000 }, () => {
  const conLaBase = (cadena: string, extra: Record<string, string> = {}) =>
    spawnSync(process.execPath, [EN_LA_BASE, cadena], {
      env: entornoLimpio(extra),
      encoding: 'utf8',
      timeout: 30_000,
    });

  it('se niega con la base de producción antes de conectarse', () => {
    const r = conLaBase(PRODUCCION);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/proyecto real mqlcusxwqrefpfttjjks/);
  });

  it('se niega con una base local que no es copia de QA y dentro de Vercel', () => {
    const local = conLaBase('postgres://morphiqpos@localhost:55433/dp18_pruebas');
    expect(local.status).not.toBe(0);
    expect(local.stderr).toMatch(/no es una copia de QA/);

    const enVercel = conLaBase(COPIA, { VERCEL_ENV: 'production' });
    expect(enVercel.status).not.toBe(0);
    expect(enVercel.stderr).toMatch(/corre en Vercel/);
  });
});
