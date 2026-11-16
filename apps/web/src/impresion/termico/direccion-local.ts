/**
 * LA IMPRESORA DE RED VIVE EN LA RED LOCAL (DP-D125 · DP-20.1).
 *
 * Desde la 1.0.1 las apps sólo abren una conexión de red hacia una dirección de la red del
 * negocio. Esta es la misma regla, para decirlo en el formulario del laboratorio antes de guardar
 * y no al imprimir: se acepta ÚNICAMENTE un literal IPv4 o IPv6 —jamás un nombre: no se consulta
 * ningún DNS— que sea privado (10/8, 172.16/12, 192.168/16), de enlace local (169.254/16,
 * fe80::/10), ULA (fc00::/7) o del propio aparato (127/8, ::1). Una IPv4 metida en una IPv6
 * (`::ffff:a.b.c.d`) se juzga por la IPv4.
 *
 * Lectura ESTRICTA a propósito, igual que en Android (`DireccionPrivada.kt`) y en Windows: cuatro
 * números decimales sin ceros a la izquierda —`010.0.0.1` es octal para algunas librerías—, sin
 * formas cortas (`127.1`), hexadecimales (`0x7f.1`) ni enteros (`2130706433`).
 */

export type VeredictoDeDireccion = 'permitida' | 'publica' | 'no-es-literal' | 'vacia';

const LARGO_MAXIMO = 64;
const ZONA = /^[A-Za-z0-9_.-]{1,32}$/;

/** Cuatro octetos decimales sin ceros a la izquierda, o `null`. */
function ipv4(texto: string): number[] | null {
  const partes = texto.split('.');
  if (partes.length !== 4) return null;
  const octetos: number[] = [];
  for (const parte of partes) {
    if (!/^[0-9]{1,3}$/.test(parte)) return null;
    if (parte.length > 1 && parte.startsWith('0')) return null;
    const valor = Number(parte);
    if (valor > 255) return null;
    octetos.push(valor);
  }
  return octetos;
}

function esPrivadaIpv4(o: readonly number[]): boolean {
  const [a = 0, b = 0] = o;
  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return a === 169 && b === 254;
}

function grupo(texto: string): number | null {
  return /^[0-9a-fA-F]{1,4}$/.test(texto) ? Number.parseInt(texto, 16) : null;
}

function lado(texto: string): number[] | null {
  if (texto === '') return [];
  const grupos = texto.split(':').map(grupo);
  return grupos.every((g): g is number => g !== null) ? grupos : null;
}

/** Los 8 grupos de un literal IPv6 (sin zona), o `null` si no está bien escrito. */
function gruposIpv6(direccion: string): number[] | null {
  if (!direccion.includes(':') || direccion.includes(':::')) return null;
  if (!/^[0-9a-fA-F:.]+$/.test(direccion)) return null;
  // Una cola con IPv4 (`::ffff:1.2.3.4`) vale por dos grupos.
  const corte = direccion.lastIndexOf(':');
  const cola = direccion.slice(corte + 1);
  const v4 = cola.includes('.') ? ipv4(cola) : null;
  if (cola.includes('.') && v4 === null) return null;
  const texto = v4 === null ? direccion : `${direccion.slice(0, corte + 1)}0:0`;

  const doble = texto.indexOf('::');
  let grupos: number[];
  if (doble === -1) {
    const todos = lado(texto);
    if (todos?.length !== 8) return null;
    grupos = todos;
  } else {
    if (doble !== texto.lastIndexOf('::')) return null;
    const izquierda = lado(texto.slice(0, doble));
    const derecha = lado(texto.slice(doble + 2));
    if (izquierda === null || derecha === null || izquierda.length + derecha.length > 7)
      return null;
    const ceros = new Array<number>(8 - izquierda.length - derecha.length).fill(0);
    grupos = [...izquierda, ...ceros, ...derecha];
  }
  if (v4 !== null) {
    const [a = 0, b = 0, c = 0, d = 0] = v4;
    grupos[6] = a * 256 + b;
    grupos[7] = c * 256 + d;
  }
  return grupos;
}

function evaluarIpv6(texto: string): VeredictoDeDireccion {
  const porcentaje = texto.indexOf('%');
  const direccion = porcentaje === -1 ? texto : texto.slice(0, porcentaje);
  const zona = porcentaje === -1 ? null : texto.slice(porcentaje + 1);
  if (zona !== null && !ZONA.test(zona)) return 'no-es-literal';
  const g = gruposIpv6(direccion);
  if (g === null) return 'no-es-literal';
  const en = (i: number): number => g[i] ?? 0;
  const enlaceLocal = (en(0) & 0xffc0) === 0xfe80;
  // Una zona sólo tiene sentido en fe80::/10; en cualquier otra dirección es una trampa.
  if (zona !== null && !enlaceLocal) return 'no-es-literal';
  const ceros = (hasta: number): boolean => g.slice(0, hasta).every((x) => x === 0);
  const privada =
    (ceros(7) && en(7) === 1) ||
    (en(0) & 0xfe00) === 0xfc00 ||
    enlaceLocal ||
    (ceros(5) &&
      en(5) === 0xffff &&
      esPrivadaIpv4([en(6) >> 8, en(6) & 255, en(7) >> 8, en(7) & 255]));
  return privada ? 'permitida' : 'publica';
}

/** Qué se decide de la dirección de una impresora de red, tal como la escribió alguien. */
export function evaluarDireccion(texto: string): VeredictoDeDireccion {
  let limpio = texto.trim();
  if (limpio === '') return 'vacia';
  if (limpio.length > LARGO_MAXIMO) return 'no-es-literal';
  if (limpio.startsWith('[') && limpio.endsWith(']')) limpio = limpio.slice(1, -1);
  const v4 = ipv4(limpio);
  if (v4 !== null) return esPrivadaIpv4(v4) ? 'permitida' : 'publica';
  return evaluarIpv6(limpio);
}

/** El porqué, para el formulario. `null` cuando la dirección sirve. */
export function problemaDeLaDireccion(texto: string): string | null {
  const veredicto = evaluarDireccion(texto);
  if (veredicto === 'permitida') return null;
  if (veredicto === 'vacia') return 'Escribe la dirección IP de la impresora.';
  if (veredicto === 'publica')
    return 'Sólo se imprime en red hacia direcciones de tu red local (como 192.168.x.x o 10.x.x.x).';
  return 'Escribe la dirección IP completa de la impresora (por ejemplo 192.168.1.50), no su nombre.';
}
