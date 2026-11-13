/**
 * DÓNDE VIVE LO DE CADA DÍA: `<salida>/dia-N/` con el libro (`libro.jsonl`), lo que bajó el dueño
 * (`dueno/`) y el resultado del árbitro (`arbitro.json`). El día 0 es `dia-0`.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AsientoFechado } from '../libro.ts';

export function carpetaDelDia(salida: string, dia: number): string {
  const carpeta = join(salida, `dia-${String(dia)}`);
  mkdirSync(join(carpeta, 'dueno'), { recursive: true });
  return carpeta;
}

export function rutaDelLibro(salida: string, dia: number): string {
  return join(carpetaDelDia(salida, dia), 'libro.jsonl');
}

/** Lee el libro de varios días (el día 0 y los que van hasta N) en orden. */
export function leerLibros(salida: string, dias: readonly number[]): readonly AsientoFechado[] {
  return dias.flatMap((dia) => {
    const ruta = join(salida, `dia-${String(dia)}`, 'libro.jsonl');
    if (!existsSync(ruta)) return [];
    return readFileSync(ruta, 'utf8')
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => JSON.parse(l) as AsientoFechado);
  });
}
