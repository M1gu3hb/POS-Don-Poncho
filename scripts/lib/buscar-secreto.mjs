/**
 * BUSCAR UN SECRETO EN LO PUBLICADO (DP-20 · refuerzo §5). Puro, salvo por leer archivos.
 *
 * El repositorio es público y el código del navegador lo puede leer cualquiera. La contraseña del
 * proveedor no debe estar en ningún archivo: ni tal cual, ni en base64, ni en hexadecimal, ni
 * escapada para una URL. Aquí se arman esas formas y se buscan, byte por byte, en una carpeta.
 * Nunca se imprime el secreto ni sus formas: sólo dónde apareció.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Las formas en que un texto puede haberse colado en un archivo. Sin repetidas. */
export function formasDelSecreto(secreto) {
  const bytes = Buffer.from(secreto, 'utf8');
  const formas = new Map([
    ['tal cual', bytes],
    ['base64', Buffer.from(bytes.toString('base64'), 'latin1')],
    ['base64 para URL', Buffer.from(bytes.toString('base64url'), 'latin1')],
    ['hexadecimal', Buffer.from(bytes.toString('hex'), 'latin1')],
    ['escapada para URL', Buffer.from(encodeURIComponent(secreto), 'latin1')],
    ['UTF-16', Buffer.from(secreto, 'utf16le')],
  ]);
  const vistas = new Set();
  const unicas = [];
  for (const [nombre, forma] of formas) {
    const llave = forma.toString('hex');
    if (vistas.has(llave)) continue;
    vistas.add(llave);
    unicas.push({ nombre, forma });
  }
  return unicas;
}

/** Un secreto demasiado corto o demasiado común daría falsos positivos (y sería mala contraseña). */
export const LARGO_MINIMO = 8;

function* archivosDe(carpeta, ignorar) {
  for (const nombre of readdirSync(carpeta)) {
    if (ignorar.includes(nombre)) continue;
    const ruta = join(carpeta, nombre);
    const dato = statSync(ruta);
    if (dato.isDirectory()) yield* archivosDe(ruta, ignorar);
    else if (dato.isFile()) yield ruta;
  }
}

/**
 * Busca el secreto en todos los archivos de `carpeta`. Devuelve los hallazgos (archivo y forma) y
 * cuántos archivos se miraron: cero archivos mirados no es «limpio», es no haber mirado.
 */
export function buscarSecreto(carpeta, secreto, opciones = {}) {
  if (typeof secreto !== 'string' || secreto.length < LARGO_MINIMO) {
    throw new Error(`El secreto debe tener al menos ${String(LARGO_MINIMO)} caracteres.`);
  }
  const ignorar = opciones.ignorar ?? ['node_modules', '.git', 'cache'];
  const formas = formasDelSecreto(secreto);
  const hallazgos = [];
  let mirados = 0;
  for (const ruta of archivosDe(carpeta, ignorar)) {
    mirados += 1;
    const contenido = readFileSync(ruta);
    for (const { nombre, forma } of formas) {
      if (contenido.includes(forma)) hallazgos.push({ archivo: ruta, forma: nombre });
    }
  }
  return { mirados, hallazgos };
}
