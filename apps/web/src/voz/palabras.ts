/**
 * DP-21 · Bloque 8 · LAS PALABRAS DE LA VOZ DE COCINA: cantidades, pesos y plurales.
 *
 * La voz del navegador lee «3 Consomé de carnero» como lo escribe: un dígito pegado a un nombre en
 * singular, y «0.5» como «cero punto cinco». Aquí vive lo que la cocina dice de verdad. Todo es
 * una regla corta y probada; lo que no se puede decir con seguridad se queda como estaba (cifras,
 * o «dos de …» en vez de un plural inventado).
 */

const HASTA_VEINTE: readonly string[] = [
  'cero',
  'un',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
];

/** Un número con hasta tres decimales y sin ceros de sobra: 1.25, 21, 0.125. */
export function numeroSinCeros(valor: number): string {
  return String(Math.round(valor * 1000) / 1000);
}

/** Del 1 al 20 en palabras («tres»); de ahí en adelante, o con decimales, en cifras. */
export function cantidadEnPalabras(valor: number): string {
  if (Number.isInteger(valor) && valor >= 1 && valor <= 20) return HASTA_VEINTE[valor] ?? '';
  return numeroSinCeros(valor);
}

const TOLERANCIA = 1e-6;

function es(valor: number, esperado: number): boolean {
  return Math.abs(valor - esperado) < TOLERANCIA;
}

/** El peso dicho como en la cocina: «medio kilo», «un cuarto de kilo», «kilo y medio». */
export function pesoEnPalabras(valor: number, unidad: string): string {
  const u = unidad.trim().toLowerCase();
  if (u === '' || u === 'kg') {
    if (es(valor, 0.25)) return 'un cuarto de kilo';
    if (es(valor, 0.5)) return 'medio kilo';
    if (es(valor, 0.75)) return 'tres cuartos de kilo';
    if (es(valor, 1)) return 'un kilo';
    if (es(valor, 1.5)) return 'kilo y medio';
    return `${cantidadEnPalabras(valor)} kilos`;
  }
  if (u === 'g') return `${numeroSinCeros(valor)} ${es(valor, 1) ? 'gramo' : 'gramos'}`;
  return `${numeroSinCeros(valor)} ${unidad.trim()}`;
}

const FRACCIONES_DE_KILO: Readonly<Record<string, string>> = {
  '¼': 'un cuarto de kilo',
  '½': 'medio kilo',
  '¾': 'tres cuartos de kilo',
};

/** «½ kg» y «250 g» dentro de un texto (el nombre «Barbacoa de horno ½ kg») dichos en palabras. */
export function medidasEnPalabras(texto: string): string {
  return texto
    .replace(/([¼½¾])\s*kg\b/gi, (_, fraccion: string) => FRACCIONES_DE_KILO[fraccion] ?? fraccion)
    .replace(/(\d+(?:[.,]\d+)?)\s*kg\b/gi, (_, n: string) =>
      pesoEnPalabras(Number(n.replace(',', '.')), 'kg'),
    )
    .replace(/(\d+(?:[.,]\d+)?)\s*g\b/gi, (_, n: string) =>
      pesoEnPalabras(Number(n.replace(',', '.')), 'g'),
    );
}

const ENLACES = new Set(['de', 'del', 'con', 'al', 'a']);

/** El plural de UNA palabra, o `null` si no es seguro (acentos que se mueven, «y», «z», cifras…). */
function pluralDeLaPalabra(palabra: string): string | null {
  if (!/^\p{L}+$/u.test(palabra)) return null;
  const minuscula = palabra.toLowerCase();
  if (/[aeiouáéó]$/.test(minuscula)) return `${palabra}s`;
  if (minuscula.endsWith('s')) return palabra;
  if (/[lrd]$/.test(minuscula)) return `${palabra}es`;
  if (minuscula.endsWith('n') && !/[áéíóú]/.test(minuscula)) return `${palabra}es`;
  return null;
}

/**
 * El nombre del platillo en plural, o `null` si no se puede con seguridad. Sólo se toca la CABEZA:
 * la primera palabra, y sólo si el nombre es una palabra sola o «X de/del/con/al/a Y» («tacos de
 * barbacoa», «aguas de jamaica»). «Pulque natural» pediría también el adjetivo: ahí no se inventa.
 */
export function nombreEnPlural(nombre: string): string | null {
  const palabras = nombre.trim().split(/\s+/);
  const [cabeza, enlace] = palabras;
  if (cabeza === undefined || cabeza === '') return null;
  if (palabras.length > 1 && !ENLACES.has((enlace ?? '').toLowerCase())) return null;
  const plural = pluralDeLaPalabra(cabeza);
  return plural === null ? null : [plural, ...palabras.slice(1)].join(' ');
}
