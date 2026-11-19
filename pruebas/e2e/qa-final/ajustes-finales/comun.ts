import { createHash } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
import { join } from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { configuracionDelNegocio } from '../../ayudantes/mesas-heredadas.ts';
import { escribir } from '../../ayudantes/modo-espera.ts';
import { expect } from '../arnes/prueba.ts';
import { toque } from '../arnes/toque.ts';

/**
 * LO QUE COMPARTEN LAS PRUEBAS DE «LOS AJUSTES QUE FALTABAN» (DP-22, DP-D190): las capturas, un PNG de
 * verdad para subirlo con el dedo, y las dos lecturas que no dependen de la pantalla.
 */

export const SLUG = 'prueba-restaurante';

/** El filtro de SQL que deja sólo lo de MI negocio de prueba: la base desechable trae dos. */
export const MI_NEGOCIO =
  "organizacion_id = (select id from organizaciones where slug = 'prueba-restaurante')";

export function rutaDeCaptura(tema: string, aparato: string, nombre: string): string {
  return join('qa', 'qa-final', 'capturas', 'ajustes-finales', tema, aparato, `${nombre}.png`);
}

export async function capturar(
  page: Page,
  tema: string,
  aparato: string,
  nombre: string,
): Promise<void> {
  await page.screenshot({ path: rutaDeCaptura(tema, aparato, nombre) });
}

function trozo(tipo: string, datos: Buffer): Buffer {
  const cabeza = Buffer.alloc(8);
  cabeza.writeUInt32BE(datos.length, 0);
  cabeza.write(tipo, 4, 'latin1');
  const cola = Buffer.alloc(4);
  cola.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tipo, 'latin1'), datos])), 0);
  return Buffer.concat([cabeza, datos, cola]);
}

/** Un PNG liso del color pedido: la imagen que la dueña «sube» (distinta de otra por su color). */
export function pngLiso(rojo: number, verde: number, azul: number, ancho = 96, alto = 64): Buffer {
  const fila = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array(ancho).fill([rojo, verde, azul]).flat()),
  ]);
  const crudo = Buffer.concat(Array.from({ length: alto }, () => fila));
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera),
    trozo('IDAT', deflateSync(crudo)),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

export const huella = (cuerpo: Buffer): string =>
  createHash('sha256').update(cuerpo).digest('hex').slice(0, 12);

/** Una tarjeta heredada de Configuración (la `Card` de siempre, sin región con nombre): la que lleva ese título. */
export function cardDe(page: Page, titulo: string | RegExp): Locator {
  return page
    .locator('div.rounded-xl')
    .filter({ has: page.getByText(titulo, { exact: typeof titulo === 'string' }) })
    .last();
}

/**
 * Toca «Subir imagen» con el dedo y entrega el archivo al selector que el sistema abre. El selector de
 * archivos del sistema operativo no se puede conducir con un dedo: si el toque no lo abrió (lo dice en la
 * salida), el archivo se entrega al campo de archivo de ese mismo botón, que es lo que haría el selector.
 */
export async function subirImagen(
  page: Page,
  subir: Locator,
  nombre: string,
  cuerpo: Buffer,
): Promise<void> {
  await subir.waitFor();
  await page.waitForTimeout(2000);
  const archivo = { name: nombre, mimeType: 'image/png', buffer: cuerpo };
  const selector = page.waitForEvent('filechooser', { timeout: 6_000 }).catch(() => null);
  await toque(page, subir);
  const abierto = await selector;
  if (abierto !== null) {
    await abierto.setFiles(archivo);
  } else {
    process.stdout.write(
      '[subir] el toque no abrió el selector de archivos: se entrega al campo\n',
    );
    await subir.locator('xpath=ancestor::label[1]//input[@type="file"]').setInputFiles(archivo);
  }
  await expect(page.getByText('Imagen cargada').first()).toBeVisible({ timeout: 45_000 });
}

/** El valor guardado de una clave de la configuración del negocio (lo que el servidor tiene). */
export async function guardado(page: Page, clave: string): Promise<unknown> {
  return (await configuracionDelNegocio(page))[clave];
}

/** Pone una clave de la configuración por la API (preparación, no lo probado). */
export async function prepararConfiguracion(
  page: Page,
  datos: Record<string, unknown>,
): Promise<void> {
  await escribir(page, '/api/datos/escribir', {
    entidad: 'ConfiguracionNegocio',
    operacion: 'update',
    datos,
  });
}

/** Un texto como patrón de SQL: la letra con acento pasa a «_» (psql recibe los argumentos en la página de códigos de Windows). */
export const comoSql = (texto: string): string => texto.replaceAll(/[áéíóúñÁÉÍÓÚÑü]/g, '_');
