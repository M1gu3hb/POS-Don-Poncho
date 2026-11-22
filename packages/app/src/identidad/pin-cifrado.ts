import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { validarEntorno } from '@morphiqpos/contracts';

/**
 * DP-25 · LA COPIA CIFRADA DEL PIN, para que el DUEÑO pueda verlo (Configuración → Personas).
 *
 * El PIN se guarda para entrar como hash Argon2id (`credenciales_pin.pin_hash`): de un hash no se
 * vuelve al PIN, y así debe seguir. Lo que se agrega es una COPIA cifrada con AES-256-GCM, con una
 * llave que vive sólo en el entorno del servidor (`PIN_CIFRADO_CLAVE`, 32 bytes en base64, en Vercel y
 * con su copia fuera del repositorio): ni en la base, ni en el repo, ni en un registro.
 *
 *   · Cada copia lleva su propio vector aleatorio de 12 bytes y su etiqueta de autenticidad: una copia
 *     alterada, o descifrada con otra llave, no da un PIN: da `null`.
 *   · La copia se ata a SU identidad como dato asociado (`pin:<identidadId>`): copiada a la fila de
 *     otra persona no se descifra, así que pasar la copia de uno a otro no revela nada.
 *   · Sin llave (o con una que no mide 32 bytes) la función se apaga: no se guarda copia y nadie la ve;
 *     poner y usar el PIN sigue igual.
 *
 * Forma guardada: `v1.<vector>.<etiqueta>.<cuerpo>`, cada parte en base64url.
 */

const VERSION = 'v1';
const ALGORITMO = 'aes-256-gcm';
const LARGO_DE_LA_LLAVE = 32;
const LARGO_DEL_VECTOR = 12;

export type LlaveDelPin = Buffer & { readonly __llaveDelPin: true };

/** La llave del entorno, o `null` si no está o no mide 32 bytes (la función queda apagada). */
export function llaveDelPin(valor: string | undefined): LlaveDelPin | null {
  if (valor === undefined) return null;
  const limpio = valor.trim();
  if (limpio === '' || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(limpio)) return null;
  const llave = Buffer.from(limpio, 'base64');
  return llave.length === LARGO_DE_LA_LLAVE ? (llave as LlaveDelPin) : null;
}

/** La llave del entorno del servidor; `null` = la función está apagada. */
export function llaveDelEntorno(): LlaveDelPin | null {
  return llaveDelPin(validarEntorno(process.env).PIN_CIFRADO_CLAVE);
}

/**
 * La copia que se guarda junto al hash al poner o cambiar un PIN. Sin llave, `null`: y eso BORRA la
 * copia vieja, que sería la de un PIN que ya no sirve (nadie debe ver un PIN que no es el de hoy).
 */
export function copiaDelPin(pin: string, identidadId: string): string | null {
  const llave = llaveDelEntorno();
  return llave === null ? null : cifrarPin(pin, llave, identidadId);
}

const datoAsociado = (identidadId: string): Buffer => Buffer.from(`pin:${identidadId}`, 'utf8');

export function cifrarPin(pin: string, llave: LlaveDelPin, identidadId: string): string {
  const vector = randomBytes(LARGO_DEL_VECTOR);
  const cifrador = createCipheriv(ALGORITMO, llave, vector);
  cifrador.setAAD(datoAsociado(identidadId));
  const cuerpo = Buffer.concat([cifrador.update(pin, 'utf8'), cifrador.final()]);
  return [
    VERSION,
    vector.toString('base64url'),
    cifrador.getAuthTag().toString('base64url'),
    cuerpo.toString('base64url'),
  ].join('.');
}

/**
 * El PIN de una copia, o `null` si no es de esta identidad, se alteró, o la llave es otra. El
 * `catch` no se traga un fallo: «no se pudo descifrar» ES la respuesta (GCM lanza al no cuadrar la
 * etiqueta), y quien llama la traduce en «No disponible: asígnalo de nuevo».
 */
export function descifrarPin(
  copia: string,
  llave: LlaveDelPin,
  identidadId: string,
): string | null {
  const partes = copia.split('.');
  if (partes.length !== 4 || partes[0] !== VERSION) return null;
  const [, vector = '', etiqueta = '', cuerpo = ''] = partes;
  try {
    const descifrador = createDecipheriv(ALGORITMO, llave, Buffer.from(vector, 'base64url'));
    descifrador.setAAD(datoAsociado(identidadId));
    descifrador.setAuthTag(Buffer.from(etiqueta, 'base64url'));
    return Buffer.concat([
      descifrador.update(Buffer.from(cuerpo, 'base64url')),
      descifrador.final(),
    ]).toString('utf8');
  } catch (fallo: unknown) {
    if (fallo instanceof Error) return null;
    throw fallo;
  }
}
