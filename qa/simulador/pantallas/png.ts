/**
 * UN PNG DE UN SOLO COLOR para subir «fotos» de prueba (sin depender de archivos del repositorio).
 * Se arma a mano: firma, IHDR, IDAT (zlib) e IEND, con el CRC de `node:zlib`.
 */
import { crc32, deflateSync } from 'node:zlib';

function trozo(tipo: string, datos: Buffer): Buffer {
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const suma = Buffer.alloc(4);
  suma.writeUInt32BE(crc32(cuerpo) >>> 0);
  return Buffer.concat([largo, cuerpo, suma]);
}

export function pngSolido(
  ancho: number,
  alto: number,
  [r, g, b]: readonly [number, number, number],
): Buffer {
  const encabezado = Buffer.alloc(13);
  encabezado.writeUInt32BE(ancho, 0);
  encabezado.writeUInt32BE(alto, 4);
  encabezado[8] = 8; // 8 bits por canal
  encabezado[9] = 2; // RGB
  const fila = Buffer.alloc(1 + ancho * 3);
  for (let x = 0; x < ancho; x += 1) fila.set([r, g, b], 1 + x * 3);
  const pixeles = Buffer.concat(Array.from({ length: alto }, () => fila));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', encabezado),
    trozo('IDAT', deflateSync(pixeles)),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}
