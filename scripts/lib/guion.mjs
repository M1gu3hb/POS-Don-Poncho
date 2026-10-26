/**
 * Lo que comparten los guiones que escriben un negocio por comandos (`cargar-menu.mjs`,
 * `preparar-negocio.mjs`): el `.env`, los argumentos y la huella de la clave de idempotencia.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

/** El `.env` de la raíz, sin pisar lo que ya trae el entorno. */
export function cargarEntorno() {
  for (const linea of (existsSync('.env') ? readFileSync('.env', 'utf8') : '').split('\n')) {
    const encontrado = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(linea.trim());
    if (encontrado !== null && process.env[encontrado[1]] === undefined) {
      process.env[encontrado[1]] = encontrado[2].replace(/^["']|["']$/g, '');
    }
  }
  process.env['MORPHIQPOS_DB_POOL_MAX'] ??= '3';
}

/** `--nombre valor` de la línea de comandos, o `porOmision`. */
export function argumento(nombre, porOmision = null) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? porOmision : (process.argv[i + 1] ?? porOmision);
}

/**
 * La huella de lo que se manda: con los mismos datos, la misma clave (el comando devuelve lo de la
 * primera vez); con datos nuevos, otra, en vez de un `IDEMPOTENCIA_CONFLICTO` por reusar la vieja.
 * El PIN NO entra: la clave se guarda en la base, y de cuatro dígitos se adivina a la fuerza.
 */
export function huella(entrada) {
  const sinPin = JSON.stringify(entrada, (campo, valor) => (campo === 'pin' ? undefined : valor));
  return createHash('sha256').update(sinPin).digest('hex').slice(0, 16);
}
