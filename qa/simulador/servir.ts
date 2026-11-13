/**
 * EL SERVIDOR DEL SIMULADOR: `next start` (el mismo build que producción) contra una COPIA, con el
 * reloj de QA precargado y el almacén local. Pasa por el candado antes de arrancar nada.
 *
 *   node qa/simulador/servir.ts --raiz <checkout ya compilado> --base <url local qa_…> \
 *     --puerto 32800 --reloj D:/mpos-tmp/dp18/reloj.json --log D:/mpos-tmp/dp18/servidor.log
 *
 * Los secretos son los de usar y tirar de la base desechable (`scripts/base-desechable.mjs
 * entorno`): la pimienta con la que `pines-de-copia` siembra los PIN de prueba es ésa.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { exigirCopiaLocal } from './candado.ts';

function arg(nombre: string, porOmision?: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  const v = (i === -1 ? undefined : process.argv[i + 1]) ?? porOmision;
  if (v === undefined) throw new Error(`Falta --${nombre}`);
  return v;
}

const raiz = arg('raiz');
const base = arg('base');
const puerto = arg('puerto', '32800');
const reloj = arg('reloj', 'D:/mpos-tmp/dp18/reloj.json');
const log = arg('log', 'D:/mpos-tmp/dp18/servidor.log');
const almacen = arg('almacen', 'http://127.0.0.1:54500/storage/v1');
const appUrl = `http://localhost:${puerto}`;

exigirCopiaLocal({ appUrl, databaseUrl: base, entorno: process.env });
if (!existsSync(join(raiz, 'apps/web/.next/BUILD_ID')))
  throw new Error(`${raiz} no está compilado (falta .next/BUILD_ID).`);
if (!existsSync(reloj)) throw new Error(`Falta el archivo del reloj ${reloj} (fijar.ts primero).`);

const desechable = spawnSync(
  process.execPath,
  ['--conditions=react-server', 'scripts/base-desechable.mjs', 'entorno'],
  {
    cwd: raiz,
    encoding: 'utf8',
  },
);
const secretos = new Map<string, string>();
for (const linea of desechable.stdout.split('\n')) {
  const m = /^(SESSION_SECRET|PIN_PEPPER)=(.*)$/.exec(linea.trim());
  if (m?.[1] !== undefined && m[2] !== undefined) secretos.set(m[1], m[2]);
}
const sessionSecret = secretos.get('SESSION_SECRET');
const pinPepper = secretos.get('PIN_PEPPER');
if (sessionSecret === undefined || pinPepper === undefined) {
  throw new Error('No se pudieron leer los secretos de usar y tirar de la base desechable.');
}

const precarga = pathToFileURL(fileURLToPath(new URL('./reloj/precarga.ts', import.meta.url))).href;
const entorno: NodeJS.ProcessEnv = {
  ...process.env,
  MORPHIQPOS_SUPABASE_PROJECT_REF: '',
  DATABASE_URL: base,
  ORGANIZACION: 'don-poncho',
  APP_URL: appUrl,
  STORAGE_ENDPOINT: almacen,
  STORAGE_BUCKET: 'pos-don-poncho',
  STORAGE_ACCESS_KEY: 'almacen-local',
  STORAGE_SECRET_KEY: 'almacen-local',
  SESSION_SECRET: sessionSecret,
  PIN_PEPPER: pinPepper,
  TZ: 'America/Mexico_City',
  NODE_ENV: 'production',
  // En Vercel cada función abre su propio pool de 10; aquí UN proceso atiende a ~45 aparatos: con 10
  // conexiones haría una cola que en producción no existe.
  MORPHIQPOS_DB_POOL_MAX: process.env['MORPHIQPOS_DB_POOL_MAX'] ?? '30',
  NEXT_TELEMETRY_DISABLED: '1',
  MORPHIQPOS_RELOJ_QA: reloj,
  NODE_OPTIONS: `${process.env['NODE_OPTIONS'] ?? ''} --import ${precarga}`.trim(),
};
const salida = createWriteStream(log, { flags: 'a' });
const next = spawn('pnpm', ['exec', 'next', 'start', '-p', puerto], {
  cwd: join(raiz, 'apps/web'),
  env: entorno,
  shell: true,
});
next.stdout.pipe(salida);
next.stderr.pipe(salida);
next.on('exit', (codigo) => {
  console.log(`next start terminó (${String(codigo)})`);
  process.exit(codigo ?? 1);
});
console.log(`Servidor del simulador en ${appUrl} (log: ${log})`);
