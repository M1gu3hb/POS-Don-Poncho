#!/usr/bin/env node
/**
 * `pnpm db:bootstrap` — la puerta al sistema cerrado (F1.1-C-04).
 *
 *   pnpm db:bootstrap --org prueba-restaurante --persona "Dueña de prueba" --pin 1234
 *   pnpm db:bootstrap --org <slug-de-un-negocio-nuevo> --persona "<nombre>" --pin <4-8 dígitos>
 *
 * **Se niega sobre los negocios ajenos** de la base compartida (`packages/contracts/src/
 * negocios`): ahí crearía un dueño o le rotaría el PIN al que hay. Sobre Don Poncho da el
 * PRIMER acceso y sólo ése: si ya tiene un dueño con PIN, se niega (lo cambia su dueño desde
 * la aplicación).
 *
 * Deja lista una cuenta de dueño con PIN. Eso es todo lo que hace falta: desde
 * T2 del port del restaurante ya no hay código de enrolamiento que teclear —la
 * caja se da de alta sola la primera vez que alguien entra con su PIN—.
 *
 * **El PIN se pasa por argumento y eso deja rastro en el historial del shell.**
 * Es aceptable porque este script se corre una vez, en la máquina del
 * desarrollador, y el PIN se cambia después desde la aplicación. Si te importa,
 * pásalo por `MORPHIQPOS_PIN` en vez de `--pin`.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
config({ path: [join(RAIZ, '.env.local'), join(RAIZ, '.env'), '.env.local', '.env'], quiet: true });

function bandera(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const organizacionSlug = bandera('org');
const nombrePersona = bandera('persona');
const pin = bandera('pin') ?? process.env['MORPHIQPOS_PIN'];
const nombreTerminal = bandera('terminal');
const pimienta = process.env['PIN_PEPPER'];

if (organizacionSlug === undefined || nombrePersona === undefined || pin === undefined) {
  console.error(
    'Uso: pnpm db:bootstrap --org <slug> --persona "<nombre>" --pin <4-8 dígitos> [--terminal "<nombre>"]',
  );
  process.exit(1);
}
const { negocioAjeno } = await import('../../contracts/src/negocios/index.ts');
const ajeno = negocioAjeno(organizacionSlug);
if (ajeno !== null) {
  console.error(
    `✗ «${organizacionSlug}» es ${ajeno.nombre}, un negocio AJENO. db:bootstrap no crea ` +
      'dueños ni rota PIN en él.',
  );
  process.exit(1);
}
if (pimienta === undefined || pimienta.length === 0) {
  console.error('Falta PIN_PEPPER en .env. Sin pimienta el hash del PIN no se calcula.');
  process.exit(1);
}

const { prepararPrimerAcceso } = await import('../src/arranque/primer-acceso.ts');
const { cerrarDb } = await import('@morphiqpos/data');

try {
  const r = await prepararPrimerAcceso({
    organizacionSlug,
    nombrePersona,
    pin,
    pimienta,
    nombreTerminal,
  });

  console.log('');
  console.log(`  Negocio ....... ${r.organizacion}`);
  console.log(`  Sucursal ...... ${r.sucursal}`);
  console.log(`  Terminal ...... ${r.terminal ?? 'ninguna todavía (se crea sola al entrar)'}`);
  console.log(`  Dueño ......... ${r.persona}`);
  console.log(`  PIN ........... ${r.pinRotado ? 'ROTADO' : 'creado'} (${pin.length} dígitos)`);
  console.log('');
  console.log('  Abre /login-pos, toca tu nombre y teclea el PIN.');
  console.log('');
} catch (error) {
  console.error('');
  console.error('✗ El arranque falló. La base quedó como estaba.');
  console.error('');
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  console.error('');
  process.exitCode = 1;
} finally {
  await cerrarDb();
}
