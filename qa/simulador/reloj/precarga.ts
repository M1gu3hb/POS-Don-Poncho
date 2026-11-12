/**
 * EL RELOJ DE QA EN EL SERVIDOR DEL SIMULADOR (`node --import …/precarga.ts`).
 *
 * Se carga SÓLO en el `next start` que levanta `qa/simulador/servir.ts` contra una copia: ningún
 * archivo de la app lo importa y Vercel nunca lo ve. Antes de tocar nada pasa por el candado (la
 * base local `qa_…`, la app en esta máquina, fuera de Vercel); si no pasa, el servidor no arranca.
 *
 * Cambia `Date` del proceso: `new Date()` y `Date.now()` dan la hora simulada; con argumentos,
 * igual que siempre. Los parámetros salen del archivo `MORPHIQPOS_RELOJ_QA` y se releen cada
 * medio segundo, así que el reloj se mueve sin reiniciar el servidor.
 */
import { readFileSync, statSync } from 'node:fs';

import { exigirCopiaLocal } from '../candado.ts';
import { horaSimulada, parametrosValidos, type ParametrosDelReloj } from './formula.ts';

const ARCHIVO = process.env['MORPHIQPOS_RELOJ_QA'] ?? '';
if (ARCHIVO === '') {
  throw new Error('Reloj de QA: falta MORPHIQPOS_RELOJ_QA (el archivo con los parámetros).');
}
exigirCopiaLocal({
  appUrl: process.env['APP_URL'] ?? 'http://localhost',
  databaseUrl: process.env['DATABASE_URL'] ?? '',
  entorno: process.env,
});

const Real = Date;
let parametros: ParametrosDelReloj = { baseReal: Real.now(), baseSim: Real.now(), factor: 1 };
let leidoEn = -1;

function releer(): void {
  try {
    const marca = statSync(ARCHIVO).mtimeMs;
    if (marca === leidoEn) return;
    const nuevos = parametrosValidos(JSON.parse(readFileSync(ARCHIVO, 'utf8')));
    if (nuevos !== null) {
      parametros = nuevos;
      leidoEn = marca;
    }
  } catch (error: unknown) {
    // Un archivo a medio escribir se vuelve a leer en el siguiente turno; se dice una vez.
    if (leidoEn === -1)
      throw new Error(`Reloj de QA: no se pudo leer ${ARCHIVO}: ${String(error)}`, {
        cause: error,
      });
  }
}
releer();
setInterval(releer, 500).unref();

const ahora = (): number => horaSimulada(parametros, Real.now());

function DateQA(this: unknown, ...a: unknown[]): unknown {
  // `Date()` llamado sin `new` da el texto de la hora (TypeScript tipa `new.target` como siempre presente).
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (new.target === undefined) return new Real(ahora()).toString();
  return Reflect.construct(Real, a.length === 0 ? [ahora()] : a, new.target);
}
Object.setPrototypeOf(DateQA, Real);
// Los estáticos (`parse`, `UTC`…) también como propios: Next copia y envuelve `Date` y, con sólo la
// cadena de prototipos, `Date.parse` le llegaba como «no es una función» (500 en /api/datos/consultar).
for (const llave of Reflect.ownKeys(Real)) {
  if (llave === 'length' || llave === 'name' || llave === 'prototype') continue;
  const descriptor = Object.getOwnPropertyDescriptor(Real, llave);
  if (descriptor !== undefined) Object.defineProperty(DateQA, llave, descriptor);
}
DateQA.prototype = Real.prototype;
(DateQA as unknown as { now: () => number }).now = ahora;
globalThis.Date = DateQA as unknown as DateConstructor;
