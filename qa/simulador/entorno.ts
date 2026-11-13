/**
 * EL ENTORNO DEL SIMULADOR: la app, la base, la salida, los PIN de prueba y el reloj.
 *
 * Todo sale de la línea de comandos (o de variables `SIM_*`) y pasa por el candado ANTES de que
 * nadie abra un navegador. Los PIN de prueba se leen de un archivo FUERA del repositorio
 * (`D:\mpos-tmp\qa-dp18-<copia>\pines.json`) y nunca se imprimen.
 */
import { existsSync, readFileSync } from 'node:fs';

import { exigirCopiaLocal } from './candado.ts';

export interface Entorno {
  readonly appUrl: string;
  readonly baseUrl: string;
  readonly salida: string;
  readonly archivoReloj: string;
  /** Dónde viven los PIN de prueba (se relee si el día 0 crea personas). */
  readonly archivoPines: string;
  readonly semilla: number;
  readonly dia: number;
  readonly factor: number;
  /** nombre de la persona → PIN de prueba (nunca se imprime). */
  readonly pines: Readonly<Record<string, string>>;
}

function valor(nombre: string, variable: string, porOmision?: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  const v = (i === -1 ? undefined : process.argv[i + 1]) ?? process.env[variable] ?? porOmision;
  if (v === undefined || v === '') throw new Error(`Falta --${nombre} (o ${variable}).`);
  return v;
}

export function leerEntorno(): Entorno {
  const appUrl = valor('app', 'SIM_APP_URL');
  const baseUrl = valor('base', 'SIM_BASE_URL');
  exigirCopiaLocal({ appUrl, databaseUrl: baseUrl, entorno: process.env });
  const archivoPines = valor('pines', 'SIM_PINES');
  if (!archivoPines.replaceAll('\\', '/').startsWith('D:/mpos-tmp/')) {
    throw new Error('Los PIN de prueba se leen sólo de D:/mpos-tmp/ (fuera del repositorio).');
  }
  if (!existsSync(archivoPines)) throw new Error(`No existe ${archivoPines}`);
  const pines = JSON.parse(readFileSync(archivoPines, 'utf8')) as Record<string, string>;
  return {
    appUrl: appUrl.replace(/\/+$/, ''),
    baseUrl,
    salida: valor('salida', 'SIM_SALIDA', 'D:/mpos-tmp/dp18/semana'),
    archivoPines,
    archivoReloj: valor('reloj', 'SIM_RELOJ', 'D:/mpos-tmp/dp18/reloj.json'),
    semilla: Number(valor('semilla', 'SIM_SEMILLA', '18')),
    dia: Number(valor('dia', 'SIM_DIA', '1')),
    factor: Number(valor('factor', 'SIM_FACTOR', '6')),
    pines,
  };
}

/** El PIN de prueba de una persona. Lanza si no existe (y no dice cuál es). */
export function pinDe(entorno: Entorno, persona: string): string {
  const pin = entorno.pines[persona];
  if (pin === undefined) throw new Error(`No hay PIN de prueba para «${persona}».`);
  return pin;
}

/** El PIN de prueba leído del archivo AHORA (el día 0 pudo crear a la persona después de arrancar). */
export function pinVigente(entorno: Entorno, persona: string): string {
  const pines = JSON.parse(readFileSync(entorno.archivoPines, 'utf8')) as Record<string, string>;
  const pin = pines[persona];
  if (pin === undefined) throw new Error(`No hay PIN de prueba para «${persona}».`);
  return pin;
}
