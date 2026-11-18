/**
 * QUIÉN ATIENDE QUÉ MESA, como lo dejó la dueña en «Repartir mesas», sin pantalla. Con el reparto
 * puesto, el panel de la mesa sólo ofrece «Cambiar de mesa» al mesero de esa mesa
 * (`puede-mover-la-cuenta.ts`): un bot que intentara mover la cuenta de una mesa ajena no
 * encontraría el botón y la app tendría razón (D22-001 a D22-005 del día 2212).
 */
export interface ParteDelReparto {
  readonly mesero: string;
  readonly mesas: readonly number[];
}

/** Anota un reparto: reemplaza el dueño de las mesas que nombra y deja las demás como estaban. */
export function anotarReparto(
  reparto: Map<number, string>,
  partes: readonly ParteDelReparto[],
): void {
  for (const { mesero, mesas } of partes) for (const mesa of mesas) reparto.set(mesa, mesero);
}

/** ¿La mesa es de este mesero? Sin ningún reparto anotado todas lo son. */
export function esDeQuien(
  reparto: ReadonlyMap<number, string>,
  mesa: number,
  quien: string,
): boolean {
  return reparto.size === 0 || reparto.get(mesa) === quien;
}

/** Las mesas de quien las sienta primero; si ninguna es suya, las mismas libres en su orden. */
export function preferirLasMias<T extends { numero: number }>(
  libres: readonly T[],
  reparto: ReadonlyMap<number, string>,
  quien: string,
): readonly T[] {
  const mias = libres.filter((m) => esDeQuien(reparto, m.numero, quien));
  return mias.length > 0 ? mias : libres;
}
