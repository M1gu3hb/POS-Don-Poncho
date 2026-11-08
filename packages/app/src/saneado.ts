import { createHash } from 'node:crypto';

/**
 * Saneado y huella de lo que se escribe en la auditoría.
 *
 * R31 no admite matices: «Cero secretos en el cliente, en documentos o en
 * repositorios. Ningún PIN, contraseña, token, cookie, correo de usuario o dato
 * de cliente.» La auditoría es una tabla que alguien va a consultar, exportar y
 * pegar en un ticket de soporte, así que cuenta.
 *
 * El saneado es por NOMBRE DE CLAVE y a cualquier profundidad. No intenta
 * reconocer un secreto por su forma: reconocer «esto parece un token» falla en
 * los dos sentidos y falla en silencio.
 */

/**
 * DP-12.2 · `dispositivo` va EXACTA: es el id crudo que inventa el navegador del comensal y con el
 * que sus comandos del carrito se reconocen (en la base sólo vive su huella). Como subcadena se
 * comería claves de la caja que no son secretas (`dispositivoId` de la terminal).
 */
const CLAVES_SENSIBLES =
  /(pin|hash|password|contrase|token|secret|authorization|cookie|pepper|^dispositivo$)/i;

/**
 * DP-14 ronda 2 · `autorizacion` es la autorización FIRMADA del supervisor (dos minutos de vida,
 * atada a una cuenta y a un monto): una credencial, no un dato. Pero en la auditoría de los
 * comandos que la gastan esa MISMA clave guarda su NONCE de un solo uso (un id corto y opaco): es
 * el registro de que se gastó, y `gastarLaAutorizacion` lo busca ahí; redactarlo reabriría el
 * segundo uso. La firmada se reconoce por su forma `cuerpo.firma` (lleva un punto y pasa de 64
 * caracteres); un nonce no tiene punto y es corto. Un valor que no es texto se redacta.
 */
const CLAVE_DE_AUTORIZACION = /^autorizacion$/i;
const LARGO_DE_UN_NONCE = 64;

function esUnNonce(contenido: unknown): boolean {
  return (
    typeof contenido === 'string' &&
    !contenido.includes('.') &&
    contenido.length <= LARGO_DE_UN_NONCE
  );
}

function esSensible(clave: string, contenido: unknown): boolean {
  if (CLAVES_SENSIBLES.test(clave)) return true;
  return CLAVE_DE_AUTORIZACION.test(clave) && !esUnNonce(contenido);
}

const REDACTADO = '[redactado]';

/** Tamaño máximo del payload serializado. Más allá, se guarda sólo su huella. */
const MAXIMO_BYTES = 32 * 1024;

/** Profundidad máxima. Un objeto autorreferente no debe colgar el proceso. */
const PROFUNDIDAD_MAXIMA = 12;

export type Saneable = unknown;

/**
 * Devuelve una copia con los valores sensibles sustituidos.
 *
 * Los `bigint` se convierten a cadena decimal: JSON no los sabe serializar y
 * todo el dinero del sistema es `bigint` de centavos (R15). Sin esto, escribir
 * un importe en la auditoría lanzaría, y la reacción sería dejar de auditar
 * importes.
 */
export function sanear(valor: Saneable, profundidad = 0): unknown {
  if (profundidad > PROFUNDIDAD_MAXIMA) return '[demasiado profundo]';
  if (valor === null || valor === undefined) return null;

  if (typeof valor === 'bigint') return valor.toString();
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return valor;
  }
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return valor.map((elemento) => sanear(elemento, profundidad + 1));

  if (typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, contenido] of Object.entries(valor as Record<string, unknown>)) {
      salida[clave] = esSensible(clave, contenido) ? REDACTADO : sanear(contenido, profundidad + 1);
    }
    return salida;
  }

  // Funciones, símbolos y demás no tienen representación útil en un registro.
  return '[no serializable]';
}

/** Sanea y, si se pasa de tamaño, deja sólo la constancia de que se pasó. */
export function payloadDeAuditoria(
  valor: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const saneado = sanear(valor) as Record<string, unknown>;
  const texto = JSON.stringify(saneado);
  if (Buffer.byteLength(texto, 'utf8') <= MAXIMO_BYTES) return saneado;
  return { truncado: true, bytes: Buffer.byteLength(texto, 'utf8'), huella: huella(saneado) };
}

/**
 * Huella estable de la entrada ya validada.
 *
 * Canónica —las claves se ordenan— porque `{a:1,b:2}` y `{b:2,a:1}` son la misma
 * petición y tienen que dar la misma huella. Si no, reenviar exactamente lo
 * mismo desde otro cliente parecería una clave reusada con otra entrada.
 */
export function huella(valor: unknown): string {
  return createHash('sha256').update(canonico(valor)).digest('hex');
}

function canonico(valor: unknown): string {
  if (valor === null || valor === undefined) return 'null';
  if (typeof valor === 'bigint') return `"${valor.toString()}"`;
  if (typeof valor !== 'object') return JSON.stringify(valor);
  if (valor instanceof Date) return JSON.stringify(valor.toISOString());
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;

  const entradas = Object.entries(valor as Record<string, unknown>)
    .filter(([, contenido]) => contenido !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([clave, contenido]) => `${JSON.stringify(clave)}:${canonico(contenido)}`);
  return `{${entradas.join(',')}}`;
}
