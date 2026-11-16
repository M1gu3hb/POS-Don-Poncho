/**
 * MODO COMPATIBLE (DP-20.1) · las funciones de JavaScript más nuevas que el motor viejo.
 *
 * El piso del modo compatible es Chromium 99. Lo que llegó después no existe en esos aparatos, y
 * llamarlo no «se ve mal»: lanza y tumba la pantalla. Esta lista dice qué se busca en el JavaScript
 * que deja `next build` y con qué relleno (`apps/web/src/compatibilidad/rellenos.ts`) queda
 * cubierto. Una función de la lista que aparezca en el build sin su relleno detiene la CI.
 *
 * Se buscan con su objeto delante (`URL.canParse(`) cuando el nombre solo daría falsos positivos, y
 * sólo las que se pueden reconocer en código minificado. `Array.prototype.with` no se busca (el
 * nombre `.with(` lo usa medio mundo), pero su relleno va con los otros tres de la misma familia.
 */
export const API_NUEVAS = [
  { nombre: 'Array.prototype.toSorted', desde: 110, patron: /\.toSorted\(/, relleno: 'toSorted' },
  {
    nombre: 'Array.prototype.toReversed',
    desde: 110,
    patron: /\.toReversed\(/,
    relleno: 'toReversed',
  },
  {
    nombre: 'Array.prototype.toSpliced',
    desde: 110,
    patron: /\.toSpliced\(/,
    relleno: 'toSpliced',
  },
  { nombre: 'URL.canParse', desde: 120, patron: /\bURL\.canParse\(/, relleno: 'canParse' },
  { nombre: 'Object.groupBy', desde: 117, patron: /\bObject\.groupBy\(/, relleno: 'groupBy' },
  { nombre: 'Map.groupBy', desde: 117, patron: /\bMap\.groupBy\(/, relleno: 'groupBy' },
  {
    nombre: 'Promise.withResolvers',
    desde: 119,
    patron: /\bPromise\.withResolvers\(/,
    relleno: 'withResolvers',
  },
  { nombre: 'Promise.try', desde: 128, patron: /\bPromise\.try\(/, relleno: 'try' },
  {
    nombre: 'AbortSignal.timeout',
    desde: 103,
    patron: /\bAbortSignal\.timeout\(/,
    relleno: 'timeout',
  },
  { nombre: 'AbortSignal.any', desde: 116, patron: /\bAbortSignal\.any\(/, relleno: 'any' },
  { nombre: 'Array.fromAsync', desde: 121, patron: /\bArray\.fromAsync\(/, relleno: 'fromAsync' },
  {
    nombre: 'String.prototype.isWellFormed',
    desde: 111,
    patron: /\.isWellFormed\(/,
    relleno: 'isWellFormed',
  },
  {
    nombre: 'String.prototype.toWellFormed',
    desde: 111,
    patron: /\.toWellFormed\(/,
    relleno: 'toWellFormed',
  },
  {
    nombre: 'Set.prototype.isSubsetOf',
    desde: 122,
    patron: /\.isSubsetOf\(/,
    relleno: 'isSubsetOf',
  },
  {
    nombre: 'Set.prototype.isSupersetOf',
    desde: 122,
    patron: /\.isSupersetOf\(/,
    relleno: 'isSupersetOf',
  },
  {
    nombre: 'Set.prototype.symmetricDifference',
    desde: 122,
    patron: /\.symmetricDifference\(/,
    relleno: 'symmetricDifference',
  },
  {
    nombre: 'Intl.DurationFormat',
    desde: 129,
    patron: /\bIntl\.DurationFormat\b/,
    relleno: 'DurationFormat',
  },
  { nombre: 'RegExp.escape', desde: 136, patron: /\bRegExp\.escape\(/, relleno: 'escape' },
  { nombre: 'Response.json', desde: 105, patron: /\bResponse\.json\(/, relleno: 'json' },
];

/**
 * Las funciones de la lista que usa `codigo` y no tienen relleno.
 * @param {string} codigo      JavaScript del build
 * @param {readonly string[]} rellenos  los nombres que instala el guion de rellenos
 * @returns {{ usadas: string[], sinRelleno: { nombre: string, desde: number }[] }}
 */
export function apiSinRelleno(codigo, rellenos) {
  const usadas = [];
  const sinRelleno = [];
  for (const api of API_NUEVAS) {
    if (!api.patron.test(codigo)) continue;
    usadas.push(api.nombre);
    if (!rellenos.includes(api.relleno)) sinRelleno.push({ nombre: api.nombre, desde: api.desde });
  }
  return { usadas, sinRelleno };
}

/** Los nombres que declara `RELLENOS_INSTALADOS` en el archivo de rellenos (leído como texto). */
export function rellenosDeclarados(fuente) {
  const lista = /RELLENOS_INSTALADOS\s*=\s*\[([^\]]*)\]/.exec(fuente)?.[1] ?? '';
  return [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}
