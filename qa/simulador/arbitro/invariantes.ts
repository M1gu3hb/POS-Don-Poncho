/**
 * LAS INVARIANTES DE LA BASE, EN SÓLO LECTURA: cuentas, pagos, folios, cajas, mesas, comandas,
 * inventario y auditoría que no deben violarse nunca. Una fila es una violación. Lo que ya estaba
 * mal ANTES de la semana (la historia de la copia) se guarda como línea base y no se reporta.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { leerSql, type Comparador } from './base.ts';
import { INVARIANTES } from './invariantes-sql.ts';

export type ConteoDeInvariantes = Readonly<Record<string, number>>;

export async function contarInvariantes(
  baseUrl: string,
): Promise<{ conteos: ConteoDeInvariantes; primera: Readonly<Record<string, string>> }> {
  const conteos: Record<string, number> = {};
  const primera: Record<string, string> = {};
  for (const inv of INVARIANTES) {
    try {
      const filas = await leerSql<Record<string, unknown>>(baseUrl, inv.sql);
      conteos[inv.id] = filas.length;
      if (filas[0] !== undefined) primera[inv.id] = JSON.stringify(filas[0]).slice(0, 300);
    } catch (error: unknown) {
      conteos[inv.id] = -1;
      primera[inv.id] = `la consulta falló: ${String(error).slice(0, 160)}`;
    }
  }
  return { conteos, primera };
}

/** Guarda la línea base (al terminar el día 0). */
export async function guardarLineaBase(
  baseUrl: string,
  salida: string,
): Promise<ConteoDeInvariantes> {
  const { conteos } = await contarInvariantes(baseUrl);
  writeFileSync(join(salida, 'invariantes-base.json'), JSON.stringify(conteos, null, 2));
  return conteos;
}

export async function arbitrarInvariantes(
  baseUrl: string,
  salida: string,
  c: Comparador,
): Promise<void> {
  const archivo = join(salida, 'invariantes-base.json');
  const base: ConteoDeInvariantes = existsSync(archivo)
    ? (JSON.parse(readFileSync(archivo, 'utf8')) as ConteoDeInvariantes)
    : {};
  const { conteos, primera } = await contarInvariantes(baseUrl);
  for (const inv of INVARIANTES) {
    const ahora = conteos[inv.id] ?? 0;
    if (ahora < 0) {
      c.violacion(
        'invariantes',
        `${inv.id} · ${inv.nombre}`,
        primera[inv.id] ?? 'no se pudo consultar',
        'prueba',
        'bajo',
      );
      continue;
    }
    const antes = base[inv.id] ?? 0;
    if (ahora > antes) {
      const clase = inv.id.startsWith('I') ? 'inventario' : 'dinero';
      c.violacion(
        'invariantes',
        `${inv.id} · ${inv.nombre}`,
        `${String(ahora)} filas (antes de la semana: ${String(antes)}); ejemplo ${primera[inv.id] ?? ''}`,
        clase,
        'alto',
      );
    } else {
      c.comparar(
        'invariantes',
        `${inv.id} · ${inv.nombre}`,
        'sin violaciones nuevas',
        'sin violaciones nuevas',
        'dinero',
        'alto',
      );
    }
  }
}
