/**
 * LOS PIN DE PRUEBA DEL DÍA 0: los genera este guion (4 cifras, sin repetidos ni escaleras) y los
 * guarda en el MISMO `pines.json` de la copia (`D:\mpos-tmp\qa-dp18-<copia>\pines.json`), fuera del
 * repositorio. Nunca se imprimen. Un PIN ya guardado para esa persona se conserva (idempotente).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { crearAzar } from '../semilla.ts';

const ESCALERAS = '0123456789';

export function pinValido(pin: string): boolean {
  return /^\d{4}$/.test(pin) && !/^(\d)\1{3}$/.test(pin) && !ESCALERAS.includes(pin);
}

export function leerPines(archivo: string): Record<string, string> {
  return existsSync(archivo)
    ? (JSON.parse(readFileSync(archivo, 'utf8')) as Record<string, string>)
    : {};
}

/** Un PIN que nadie más usa en la copia, sacado de la semilla (no de `Math.random`). */
export function pinNuevo(usados: ReadonlySet<string>, semilla: string): string {
  const azar = crearAzar(`pin:${semilla}`);
  for (let intento = 0; intento < 500; intento += 1) {
    const pin = String(azar.entero(1000, 9999));
    if (pinValido(pin) && !usados.has(pin)) return pin;
  }
  throw new Error('No hubo un PIN libre de prueba.');
}

/** Garantiza un PIN para `persona`; devuelve si fue nuevo. Escribe con renombrado atómico. */
export function asegurarPin(archivo: string, persona: string): { pin: string; nuevo: boolean } {
  const pines = leerPines(archivo);
  const previo = pines[persona];
  if (previo !== undefined) return { pin: previo, nuevo: false };
  const pin = pinNuevo(new Set(Object.values(pines)), persona);
  mkdirSync(dirname(archivo), { recursive: true });
  const temporal = `${archivo}.tmp`;
  writeFileSync(temporal, `${JSON.stringify({ ...pines, [persona]: pin }, null, 2)}\n`);
  renameSync(temporal, archivo);
  return { pin, nuevo: true };
}
