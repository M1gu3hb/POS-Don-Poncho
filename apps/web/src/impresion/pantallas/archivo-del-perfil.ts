/**
 * EL ARCHIVO QUE SE LLEVA A OTRO POS (DP-20 · laboratorio). Puro.
 *
 * El nombre del archivo que se descarga y la revisión de lo que se sube antes de leerlo: un perfil
 * es un JSON de unos cuantos KB, no un archivo cualquiera.
 */

/** Lo más grande que puede ser un archivo de perfil. */
export const TAMANO_MAXIMO_DEL_ARCHIVO = 100_000;

/** «Mostrador 80 mm» → «perfil-mostrador-80-mm.json»: sin acentos, sin espacios, sin símbolos. */
export function nombreDelArchivo(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `perfil-${limpio === '' ? 'de-impresion' : limpio}.json`;
}

/** `null` si el archivo se puede leer; si no, por qué no. */
export function problemaDelArchivo(archivo: {
  readonly name: string;
  readonly size: number;
}): string | null {
  if (!archivo.name.toLowerCase().endsWith('.json')) {
    return 'Elige un archivo de perfil: termina en .json.';
  }
  if (archivo.size > TAMANO_MAXIMO_DEL_ARCHIVO) {
    return 'Ese archivo es demasiado grande para ser un perfil de impresión.';
  }
  return null;
}
