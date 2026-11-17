import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { ResultadoDeRevision } from './tipos.ts';

/**
 * LOS INFORMES DEL QA FINAL. Las capturas van a `qa/qa-final/capturas/<pantalla>/<aparato>/<estado>.png`
 * y el informe de la corrida, en JSON, a `qa/qa-final/informes/<corrida>-<proceso>.json` (las dos
 * carpetas están en `.gitignore`). Cada proceso de Playwright escribe el suyo: dos workers no se pisan.
 */

export const RAIZ_DEL_QA = resolve('qa', 'qa-final');
const acumulado: ResultadoDeRevision[] = [];

export const nombreSeguro = (texto: string): string =>
  texto
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .replaceAll(/[^A-Za-z0-9._-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 80) || 'sin-nombre';

export function rutaDeCaptura(pantalla: string, aparato: string, estado: string): string {
  return join(
    RAIZ_DEL_QA,
    'capturas',
    nombreSeguro(pantalla),
    nombreSeguro(aparato),
    `${nombreSeguro(estado)}.png`,
  );
}

export function relativaALaRaiz(ruta: string): string {
  return relative(process.cwd(), ruta).replaceAll('\\', '/');
}

export function registrarRevision(resultado: ResultadoDeRevision): void {
  acumulado.push(resultado);
  const corrida = process.env['MORPHIQPOS_QA_CORRIDA'] ?? 'sin-corrida';
  const carpeta = join(RAIZ_DEL_QA, 'informes');
  mkdirSync(carpeta, { recursive: true });
  const archivo = join(carpeta, `${nombreSeguro(corrida)}-${String(process.pid)}.json`);
  writeFileSync(
    archivo,
    JSON.stringify(
      {
        corrida,
        proceso: process.pid,
        revisiones: acumulado.length,
        conHallazgos: acumulado.filter((r) => r.hallazgos.length > 0).length,
        resultados: acumulado,
      },
      null,
      1,
    ),
  );
}
