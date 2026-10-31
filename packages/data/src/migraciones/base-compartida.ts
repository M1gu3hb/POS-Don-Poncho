import { PROYECTO_DE_LA_FASE_A, referenciaDeLaCadena } from '../verificacion/consulta-directa.ts';

/**
 * DON PONCHO NO MIGRA LA BASE COMPARTIDA (PAR-1 del maestro, fase 4).
 *
 * Mientras Don Poncho viva en la base de la Fase A —la de MorphiqPOS, con otros negocios—, sus
 * migraciones las aplica el MAESTRO con su `db:migrate` (la 186 y la 187, idénticas en los dos
 * repositorios). Si este repositorio la migrara, aplicaría también la 188, que el maestro no
 * tiene: su ledger quedaría con una migración «que no está en el repositorio» y el `db:migrate`
 * y el `verify:acople` del maestro se negarían a seguir. La 188 es sólo de la base propia de
 * Don Poncho (la Fase B), y en la compartida no haría nada de todos modos.
 *
 * Por eso: `db:migrate` se niega contra la compartida, y `verify:acople` acepta ahí sin aplicar
 * SÓLO las migraciones de la base propia. Puro.
 */
export const SOLO_DE_LA_BASE_PROPIA: ReadonlySet<number> = new Set([188]);

/** ¿El destino (proyecto vinculado o cadena de conexión) es la base compartida? */
export function esLaBaseCompartida(destino: {
  readonly projectRef?: string | undefined;
  readonly url?: string | undefined;
}): boolean {
  if (destino.projectRef?.trim() === PROYECTO_DE_LA_FASE_A) return true;
  if (destino.url === undefined || destino.url === '') return false;
  return (
    referenciaDeLaCadena(destino.url) === PROYECTO_DE_LA_FASE_A ||
    destino.url.includes(PROYECTO_DE_LA_FASE_A)
  );
}

/** Las versiones sin aplicar que sí cuentan como faltantes en el proyecto verificado. */
export function faltantesQueCuentan(
  proyecto: string,
  faltan: readonly number[],
): readonly number[] {
  if (proyecto !== PROYECTO_DE_LA_FASE_A) return faltan;
  return faltan.filter((version) => !SOLO_DE_LA_BASE_PROPIA.has(version));
}
