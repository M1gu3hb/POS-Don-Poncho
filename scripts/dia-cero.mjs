#!/usr/bin/env node
/**
 * EL DÍA CERO: la víspera de abrir Don Poncho (DP-22 · Parte 11).
 *
 *   pnpm dia-cero                              # ensayo: dice cómo está y lo que haría; no escribe
 *   pnpm dia-cero -- --en-serio                # lo hace (si no hay cuentas que borrar)
 *   pnpm dia-cero -- --en-serio --ventas <n>   # lo hace borrando las <n> cuentas de la prueba
 *
 * Después de la prueba física de Miguel en los POS, deja el negocio listo para el primer día de
 * verdad. Es idempotente: se puede correr las veces que haga falta y una segunda corrida no cambia
 * nada. En este orden:
 *   1. comprueba que el negocio no opere ya de verdad (H1) y que no haya cajas abiertas;
 *   2. si quedaron cuentas de la prueba, las borra por los comandos de la aplicación
 *      (`scripts/dejar-en-ceros.mjs`): sólo con `--ventas <n>` igual al número que dijo el ensayo
 *      —quien lo corre confirma así que sabe cuántas son— y sólo si ninguna es anterior a `--desde`
 *      (por omisión 2026-11-16, el día en que producción quedó en ceros);
 *   3. vuelve a dejar la configuración de arranque y el primer folio en 1001 y 101
 *      (`scripts/configurar-produccion.mjs --primer-folio`) y los aparatos como «Aparato N»;
 *   4. activa el bloqueo del arranque con la hora del servidor (`scripts/operacion-real.mjs`):
 *      desde ese momento lo cobrado ya no se borra;
 *   5. verifica, leyendo: 0 cuentas, 0 cajas, 0 comandas, 0 carritos, las mesas libres, el
 *      siguiente folio «DP-01001», la configuración y el bloqueo.
 * Si algo no cuadra (una caja abierta, cuentas anteriores a `--desde`, otro número de cuentas, o el
 * negocio ya opera), NO borra nada: lo dice y termina con error.
 *
 * La conexión: `DATABASE_URL` si ya viene en el entorno (un ensayo sobre una copia); si no, la de
 * SESIÓN de producción (`POSTGRES_URL_SESION` de `..\_PRIVADO\fase-b.env`, o del archivo que diga
 * `MORPHIQPOS_ENV_DE_PRODUCCION`). Nunca por el pooler de transacción (DP-D92) y sin imprimirla.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argumento } from './lib/guion.mjs';
import { exigirConexionDirecta } from './lib/lectura-segura.mjs';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const slug = argumento('org', 'don-poncho');
const persona = argumento('persona', 'Miguel · Morphiq');
const desde = argumento('desde', '2026-11-16');
const ventas = argumento('ventas');
const enSerio = process.argv.includes('--en-serio');

/** La conexión de sesión de producción, sin imprimirla. */
function conexion() {
  if (process.env['DATABASE_URL'] !== undefined && process.env['DATABASE_URL'] !== '') {
    return process.env['DATABASE_URL'];
  }
  const archivo =
    process.env['MORPHIQPOS_ENV_DE_PRODUCCION'] ?? join(RAIZ, '..', '_PRIVADO', 'fase-b.env');
  if (!existsSync(archivo)) {
    console.error(
      '✗ No hay DATABASE_URL ni archivo de entorno de producción: no sé a qué base ir.',
    );
    process.exit(2);
  }
  const linea = readFileSync(archivo, 'utf8')
    .split(/\r?\n/u)
    .find((renglon) => renglon.startsWith('POSTGRES_URL_SESION='));
  if (linea === undefined) {
    console.error('✗ El archivo de entorno no trae POSTGRES_URL_SESION (la conexión de sesión).');
    process.exit(2);
  }
  return linea
    .slice('POSTGRES_URL_SESION='.length)
    .trim()
    .replace(/^["']|["']$/gu, '');
}

const cadena = conexion();
const destino = exigirConexionDirecta(cadena);
process.env['DATABASE_URL'] = cadena;
// Nunca el proyecto vinculado del CLI: los guiones van a ESTA base y a ninguna otra.
delete process.env['MORPHIQPOS_SUPABASE_PROJECT_REF'];
process.env['MORPHIQPOS_DB_POOL_MAX'] ??= '3';
console.log(
  `Base: ${destino.hostname}:${destino.port || '5432'} · negocio «${slug}» · ${enSerio ? 'EN SERIO' : 'ensayo'}`,
);

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb, cerrarDb } = await import('../packages/data/src/cliente.ts');
const { faltasParaAbrir, leerEstadoDeArranque, siguienteFolioVisible } =
  await import('./lib/estado-de-arranque.mjs');

const permitido = [...NEGOCIOS_REALES, ...NEGOCIOS_DE_PRUEBA].find((n) => n.slug === slug);
if (negocioAjeno(slug) !== null || permitido === undefined) {
  console.error(`✗ «${slug}» no es Don Poncho ni un restaurante de prueba: no se toca.`);
  process.exit(1);
}

/** Corre un guion del repo con el mismo entorno; si falla, el día cero se detiene ahí. */
function correr(guion, ...argumentos) {
  const resultado = spawnSync(
    process.execPath,
    [
      '--conditions=react-server',
      join(RAIZ, 'scripts', guion),
      '--org',
      slug,
      '--persona',
      persona,
      ...argumentos,
    ],
    { cwd: RAIZ, env: process.env, stdio: 'inherit' },
  );
  if (resultado.status !== 0) {
    console.error(
      `✗ ${guion} terminó con error: el día cero se detiene aquí. Lo anterior ya quedó hecho; al corregir, se vuelve a correr.`,
    );
    process.exit(1);
  }
}

const decir = (estado) => {
  console.log(
    `  cuentas: ${String(estado.cuentas.cuentas)} (cobradas ${String(estado.cuentas.cobradas)}) · ` +
      `cajas abiertas: ${String(estado.cajasAbiertas.length)} · cajas con corte: ${String(estado.cajas)} · ` +
      `comandas: ${String(estado.comandas)} · carritos: ${String(estado.carritos)} · ` +
      `mesas libres: ${String(estado.mesas.libres)} de ${String(estado.mesas.total)}`,
  );
  console.log(
    `  siguiente folio: ${siguienteFolioVisible(estado)} · ` +
      `bloqueo del arranque: ${estado.operacionDesde ?? 'sin activar'}`,
  );
};

const db = obtenerDb();
let antes;
try {
  antes = await leerEstadoDeArranque(db, permitido.id);
} finally {
  await cerrarDb();
}
console.log('Cómo está:');
decir(antes);

// 1 · Lo que detiene todo, sin borrar nada.
if (antes.operacionDesde !== null && antes.cuentas.posteriores > 0) {
  console.error(
    `✗ El negocio YA OPERA: hay ${String(antes.cuentas.posteriores)} cuenta(s) posteriores al arranque (${antes.operacionDesde}). No se borra nada.`,
  );
  process.exit(1);
}
if (antes.cajasAbiertas.length > 0) {
  const donde = antes.cajasAbiertas.map((caja) => caja.aparato).join(', ');
  console.error(
    `✗ Hay caja(s) abierta(s) en: ${donde}. Ciérralas en el POS y vuelve a correr. No se borra nada.`,
  );
  process.exit(1);
}
const hayQueBorrar =
  antes.cuentas.cuentas > 0 || antes.cajas > 0 || antes.comandas > 0 || antes.carritos > 0;
if (hayQueBorrar && enSerio && ventas !== String(antes.cuentas.cobradas)) {
  console.error(
    `✗ Hay ${String(antes.cuentas.cobradas)} cuenta(s) cobradas de la prueba. Para borrarlas, repite con: --en-serio --ventas ${String(antes.cuentas.cobradas)}. No se borra nada.`,
  );
  process.exit(1);
}

if (!enSerio) {
  console.log('◦ Ensayo. En serio haría:');
  console.log(
    hayQueBorrar
      ? `  1. borrar la prueba (${String(antes.cuentas.cuentas)} cuentas, ${String(antes.cajas)} cajas) con: --en-serio --ventas ${String(antes.cuentas.cobradas)}`
      : '  1. nada que borrar',
  );
  console.log('  2. dejar la configuración de arranque y el primer folio en 1001 y 101');
  console.log(
    `  3. ${antes.operacionDesde === null ? 'activar el bloqueo del arranque' : 'dejar el bloqueo como está'}`,
  );
  const faltas = faltasParaAbrir(antes, { conBloqueo: true });
  console.log(
    faltas.length === 0 ? '✓ Ya está listo para abrir.' : `  Hoy falta: ${faltas.join('; ')}.`,
  );
  process.exit(0);
}

// 2 a 4 · Por los guiones de siempre (cada uno, por los comandos de la aplicación).
if (hayQueBorrar)
  correr('dejar-en-ceros.mjs', '--desde', desde, '--ventas', String(antes.cuentas.cobradas));
correr('configurar-produccion.mjs', '--primer-folio');
correr('renombrar-aparatos.mjs');
correr('operacion-real.mjs');

// 5 · La verificación, leyendo.
const db2 = obtenerDb();
let despues;
try {
  despues = await leerEstadoDeArranque(db2, permitido.id);
} finally {
  await cerrarDb();
}
console.log('Cómo quedó:');
decir(despues);
const faltas = faltasParaAbrir(despues, { conBloqueo: true });
if (faltas.length > 0) {
  console.error(`✗ No quedó listo: ${faltas.join('; ')}.`);
  process.exit(1);
}
console.log(
  `✓ Día cero hecho: «${slug}» en ceros, el siguiente folio es ${siguienteFolioVisible(despues)} y lo cobrado desde ahora ya no se borra.`,
);
