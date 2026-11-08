/**
 * DP-15 · «NUEVA MESA» PROPONE EL SIGUIENTE NÚMERO LIBRE (informativo QA2-B2 de `docs/qa/HALLAZGOS.md`).
 *
 * Proponía el mayor número de TODAS las mesas más uno, también de las quitadas: con la 5 dada de
 * baja, la nueva salía 26 y el hueco se quedaba. La base sólo exige que no se repita entre las
 * mesas activas (`mesas_numero_unico … WHERE activa`), así que el número libre es el menor que
 * ninguna mesa activa usa.
 */

interface MesaConNumero {
  readonly numero?: number | null;
  readonly activo?: boolean | null;
}

export function siguienteNumeroLibre(mesas: readonly (MesaConNumero | null | undefined)[]): number {
  const usados = new Set(
    mesas
      .filter((m): m is MesaConNumero => m != null && m.activo !== false)
      .map((m) => Number(m.numero))
      .filter((n) => Number.isInteger(n) && n > 0),
  );
  let numero = 1;
  while (usados.has(numero)) numero += 1;
  return numero;
}
