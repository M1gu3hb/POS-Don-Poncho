#!/usr/bin/env node
/**
 * LA DEMO LOCAL DE DON PONCHO (DP-9): una base DESECHABLE con su catálogo, en esta máquina, para
 * probar desde los teléfonos y la tablet de la misma red wifi. Ver `docs/DEMO-LOCAL.md`.
 *
 *   node --conditions=react-server scripts/demo-local.mjs preparar --base <url> [--ip <ip>] [--puerto 3300]
 *   node --conditions=react-server scripts/demo-local.mjs servir   --base <url> [--ip <ip>] [--puerto 3300]
 *
 * `preparar` crea la base si no existe, le aplica las migraciones de ESTA rama (así se prueba
 * lo de `fase-b`), da de alta a Don Poncho con su ID, su dueño de demo, su menú, su portal QR,
 * sus mesas, su equipo y los botones del menú —todo por los comandos de la aplicación, como en
 * producción—. Es idempotente: correrlo otra vez no duplica nada.
 *
 * `servir` compila y levanta el servidor en `0.0.0.0:<puerto>` con `APP_URL=http://<ip>:<puerto>`:
 * los QR de las mesas y las imágenes del menú apuntan a esa dirección.
 *
 * ── Lo que NO hace, a propósito ───────────────────────────────────────────────
 * · Se niega con una base que no sea de esta máquina (`localhost` o `127.0.0.1`): nunca la
 *   compartida. Tampoco lee la `DATABASE_URL` del `.env`.
 * · Sus secretos (firma de sesión, pimienta de los PIN) y los PIN de DEMO se inventan la primera
 *   vez y se guardan FUERA del repositorio, en la carpeta temporal del usuario: no sirven en
 *   producción, y los de producción no sirven aquí.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';

const accion = process.argv[2];
const argumento = (nombre, porOmision) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? porOmision : (process.argv[i + 1] ?? porOmision);
};

const base = argumento('base', '');
const puerto = argumento('puerto', '3300');
const ipDeLaRed = () =>
  Object.values(networkInterfaces())
    .flat()
    .find((i) => i?.family === 'IPv4' && !i.internal)?.address ?? '127.0.0.1';
const ip = argumento('ip', ipDeLaRed());

if (!['preparar', 'servir'].includes(accion ?? '') || base === '') {
  console.error(
    'Uso: demo-local.mjs preparar|servir --base <postgres://…@127.0.0.1:…/base> [--ip <ip>] [--puerto 3300]',
  );
  process.exit(2);
}
const destino = new URL(base);
if (!['localhost', '127.0.0.1'].includes(destino.hostname)) {
  console.error(`✗ La demo sólo usa una base de ESTA máquina; «${destino.hostname}» no lo es.`);
  process.exit(1);
}

const DUENO = 'Miguel · Morphiq';
const CARPETA = join(tmpdir(), 'pos-don-poncho-demo');
const ARCHIVO_DE_SECRETOS = join(CARPETA, 'demo.json');
const ARCHIVO_DE_PINES = join(CARPETA, 'pines-de-demo.json');

const pinAlAzar = (usados) => {
  for (;;) {
    const pin = String(randomInt(1000, 10000));
    if (!usados.has(pin)) {
      usados.add(pin);
      return pin;
    }
  }
};

/**
 * Los secretos y los PIN de la demo: se inventan una vez y se reusan (el dueño ya existe). Si el
 * equipo creció desde entonces (DP-10.1: «Bebidas»), sólo se inventan los que faltan.
 */
function secretosDeLaDemo() {
  mkdirSync(CARPETA, { recursive: true });
  const datos = JSON.parse(readFileSync('docs/cliente/negocio-don-poncho.json', 'utf8'));
  if (existsSync(ARCHIVO_DE_SECRETOS)) {
    const guardados = JSON.parse(readFileSync(ARCHIVO_DE_SECRETOS, 'utf8'));
    const faltan = datos.equipo.filter((persona) => guardados.pines[persona.nombre] === undefined);
    if (faltan.length === 0) return guardados;
    const usados = new Set([guardados.pinDelDueno, ...Object.values(guardados.pines)]);
    const completos = {
      ...guardados,
      pines: {
        ...guardados.pines,
        ...Object.fromEntries(faltan.map((persona) => [persona.nombre, pinAlAzar(usados)])),
      },
    };
    writeFileSync(
      ARCHIVO_DE_SECRETOS,
      `${JSON.stringify(completos, null, 2)}
`,
    );
    return completos;
  }
  const usados = new Set();
  const secretos = {
    SESSION_SECRET: randomBytes(32).toString('hex'),
    PIN_PEPPER: randomBytes(32).toString('hex'),
    pinDelDueno: pinAlAzar(usados),
    pines: Object.fromEntries(datos.equipo.map((persona) => [persona.nombre, pinAlAzar(usados)])),
  };
  writeFileSync(ARCHIVO_DE_SECRETOS, `${JSON.stringify(secretos, null, 2)}\n`);
  return secretos;
}

const secretos = secretosDeLaDemo();

/** El entorno de la demo: nada de él abre algo vivo. */
const ENTORNO = {
  DATABASE_URL: base,
  ORGANIZACION: 'don-poncho',
  APP_URL: `http://${ip}:${puerto}`,
  // También desde esta misma PC: sin esto, entrar por `localhost` se rechazaría como escritura de
  // otro origen.
  APP_URL_ALTERNAS: `http://localhost:${puerto}`,
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_BUCKET: 'pos-don-poncho',
  STORAGE_ACCESS_KEY: 'demo-local-sin-almacen',
  STORAGE_SECRET_KEY: 'demo-local-sin-almacen',
  SESSION_SECRET: secretos.SESSION_SECRET,
  PIN_PEPPER: secretos.PIN_PEPPER,
  MORPHIQPOS_SUPABASE_PROJECT_REF: '',
  NODE_ENV: 'production',
  TZ: 'America/Mexico_City',
};

function correr(comando, args, extra = {}) {
  const r = spawnSync(comando, args, {
    stdio: 'inherit',
    env: { ...process.env, ...ENTORNO, ...extra },
    shell: process.platform === 'win32' && comando === 'pnpm',
  });
  if (r.status !== 0) {
    console.error(`✗ ${comando} ${args.join(' ')} terminó con ${String(r.status)}.`);
    process.exit(r.status ?? 1);
  }
}
const nodo = (script, args) =>
  correr(process.execPath, ['--conditions=react-server', script, ...args]);

async function prepararLaBase() {
  const requerir = createRequire(join(process.cwd(), 'packages', 'data', 'package.json'));
  const { Client } = requerir('pg');
  const nombre = destino.pathname.replace(/^\//, '');
  const alServidor = new URL(base);
  alServidor.pathname = '/postgres';
  const c = new Client({ connectionString: alServidor.toString() });
  await c.connect();
  try {
    const hay = await c.query('select 1 from pg_database where datname = $1', [nombre]);
    if (hay.rowCount === 0) await c.query(`create database "${nombre.replaceAll('"', '')}"`);
  } finally {
    await c.end();
  }
  const enLaBase = new Client({ connectionString: base });
  await enLaBase.connect();
  try {
    const rol = await enLaBase.query("select 1 from pg_roles where rolname = 'morphiqpos_app'");
    if (rol.rowCount === 0) await enLaBase.query('create role morphiqpos_app with login bypassrls');
  } finally {
    await enLaBase.end();
  }
  for (const [clave, valor] of Object.entries(ENTORNO)) process.env[clave] = valor;
  const ejecutor = await import('../packages/data/src/migraciones/ejecutor.ts');
  const cliente = await import('../packages/data/src/cliente.ts');
  try {
    const r = await ejecutor.migrar({ ensayo: false });
    console.log(
      `✓ migraciones: ${String(r.aplicadas.length)} aplicadas, ${String(r.yaEstaban)} ya estaban`,
    );
  } finally {
    await cliente.cerrarDb();
  }
}

if (accion === 'preparar') {
  await prepararLaBase();
  nodo('packages/app/bin/alta-negocio.mjs', [
    '--slug',
    'don-poncho',
    '--nombre',
    'La Tradicional Barbacoa de Don Poncho',
    '--giro',
    'restaurante',
    '--paquete',
    'restaurante',
    '--sucursal',
    'San Lorenzo Atemoaya',
  ]);
  const bootstrap = spawnSync(
    process.execPath,
    [
      '--conditions=react-server',
      'packages/app/bin/bootstrap.mjs',
      '--org',
      'don-poncho',
      '--persona',
      DUENO,
    ],
    { stdio: 'inherit', env: { ...process.env, ...ENTORNO, MORPHIQPOS_PIN: secretos.pinDelDueno } },
  );
  if (bootstrap.status !== 0) console.log('  (el dueño de demo ya existía: se conserva su PIN)');
  nodo('scripts/cargar-menu.mjs', ['--org', 'don-poncho', '--persona', DUENO]);
  writeFileSync(ARCHIVO_DE_PINES, `${JSON.stringify(secretos.pines, null, 2)}\n`);
  nodo('scripts/preparar-negocio.mjs', [
    '--org',
    'don-poncho',
    '--persona',
    DUENO,
    '--pines',
    ARCHIVO_DE_PINES,
  ]);
  console.log('\n✓ Demo lista. PIN de DEMO (no son los de producción):');
  console.log(`  ${DUENO}: ${secretos.pinDelDueno}`);
  for (const [nombre, pin] of Object.entries(secretos.pines)) console.log(`  ${nombre}: ${pin}`);
  console.log(`  (guardados en ${ARCHIVO_DE_SECRETOS})`);
  console.log(
    `\n  Ahora: node --conditions=react-server scripts/demo-local.mjs servir --base <la misma> --ip ${ip}`,
  );
}

if (accion === 'servir') {
  correr('pnpm', ['turbo', 'run', 'build', '--filter=@morphiqpos/web']);
  console.log(
    `\n✓ Desde los teléfonos (misma wifi): http://${ip}:${puerto}/n/don-poncho/login-pos`,
  );
  correr('pnpm', [
    '--filter',
    '@morphiqpos/web',
    'exec',
    'next',
    'start',
    '-H',
    '0.0.0.0',
    '-p',
    puerto,
  ]);
}
