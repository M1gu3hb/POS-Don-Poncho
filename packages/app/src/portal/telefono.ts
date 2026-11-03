import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { ErrorDominio } from '@morphiqpos/contracts';

import { huellaDelDispositivo } from './carrito.ts';

/**
 * EL ID DEL TELÉFONO LO EMITE EL SERVIDOR (DP-13.3, punto 11).
 *
 * Hasta DP-13.2 el navegador del comensal se inventaba su id y lo mandaba en cada petición: cualquiera
 * podía escribir un id nuevo por cada «teléfono» que quisiera y la mesa se llenaba de personas
 * «conectadas» que no existían (y, con ellas, el «¿Ya pidieron todos?» y las personas con las que se
 * abre la mesa). Ahora el id nace aquí, firmado con la pimienta del servidor:
 *
 *     t1-<24 hex al azar>-<32 hex de la firma>
 *
 * Sólo el servidor puede firmar, así que un id que no verifica no es un teléfono: el sondeo le emite
 * uno nuevo (con su límite por mesa y por IP, `limite.ts`) y los comandos lo rechazan. Lo que se
 * guarda del teléfono sigue siendo su HUELLA (`huellaDelDispositivo`), nunca el id que viaja.
 *
 * La firma lleva su propio prefijo: no se confunde con la huella ni con la clave de ningún límite.
 */

const NONCE_HEX = 24;
const FIRMA_HEX = 32;
const FORMA = new RegExp(`^t1-([0-9a-f]{${String(NONCE_HEX)}})-([0-9a-f]{${String(FIRMA_HEX)}})$`);

function firmar(pimienta: string, nonce: string): string {
  return createHmac('sha256', pimienta)
    .update(`portal:telefono:emitido:${nonce}`, 'utf8')
    .digest('hex')
    .slice(0, FIRMA_HEX);
}

/** Un id nuevo, firmado. `nonce` sólo se pasa en las pruebas, para que sea reproducible. */
export function emitirTelefono(
  pimienta: string,
  nonce: string = randomBytes(NONCE_HEX / 2).toString('hex'),
): string {
  return `t1-${nonce}-${firmar(pimienta, nonce)}`;
}

/** ¿Lo firmó este servidor? Comparación en tiempo constante; cualquier otra cosa es `false`. */
export function telefonoFirmado(pimienta: string, dispositivo: unknown): dispositivo is string {
  if (typeof dispositivo !== 'string') return false;
  const partes = FORMA.exec(dispositivo);
  const nonce = partes?.[1];
  const firma = partes?.[2];
  if (nonce === undefined || firma === undefined) return false;
  return timingSafeEqual(Buffer.from(firma, 'utf8'), Buffer.from(firmar(pimienta, nonce), 'utf8'));
}

/** El mensaje que ve el comensal cuando su teléfono no se reconoce: la pantalla se vuelve a conectar. */
export function telefonoNoReconocido(): ErrorDominio {
  return new ErrorDominio(
    'QR_TELEFONO_NO_RECONOCIDO',
    'No pudimos reconocer tu teléfono. Se está volviendo a conectar: intenta de nuevo.',
  );
}

/**
 * La huella del teléfono, o `QR_TELEFONO_NO_RECONOCIDO` si el id no lo firmó el servidor. Todo lo que
 * guarda algo a nombre de un teléfono (agregar, quitar, enviar, llamar, el latido) pasa por aquí.
 */
export function huellaDelTelefono(pimienta: string, dispositivo: string): string {
  if (!telefonoFirmado(pimienta, dispositivo)) throw telefonoNoReconocido();
  return huellaDelDispositivo(pimienta, dispositivo);
}
