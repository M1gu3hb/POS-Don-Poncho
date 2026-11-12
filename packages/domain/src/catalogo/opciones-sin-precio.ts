/**
 * DP-18 · M6 · UNA OPCIÓN QUE RESTA NO PUEDE DEJAR EL PLATILLO EN $0 O MENOS.
 *
 * Las opciones tienen precio con signo (DP-D104): «Sin carne −$15.00». Si lo que restan las opciones
 * que el comensal PUEDE elegir juntas llega al precio del platillo, el renglón quedaría en $0 o en
 * negativo. Antes el servidor lo dejaba en $0 («gratis») sin decir nada: un error de captura del
 * dueño regalaba el platillo. Ahora se rechaza en el editor de opciones, al guardar el grupo o
 * asignarlo (servidor) y, si el precio del platillo bajó después, al vender.
 *
 * Lo peor que puede pasar en un renglón, grupo por grupo:
 *   · «elige una» obligatoria: la opción más barata (puede restar o sumar);
 *   · «elige una» opcional: la más barata si resta; si no, nada;
 *   · «varias»: las que más restan, hasta el máximo, y si el mínimo obliga a elegir más, las
 *     siguientes más baratas aunque sumen.
 * Sólo las opciones activas. Si ninguna resta, no hay nada que revisar.
 */
export interface OpcionParaRevisar {
  readonly nombre: string;
  readonly deltaCentavos: bigint;
  readonly activa: boolean;
}

export interface GrupoParaRevisar {
  readonly nombre: string;
  readonly tipo: 'unica' | 'multiple';
  readonly obligatorio: boolean;
  readonly minimo: number | null;
  readonly maximo: number | null;
  readonly opciones: readonly OpcionParaRevisar[];
}

/** Lo más que puede bajar (o lo menos que puede subir) un grupo el precio de un renglón. */
export function loPeorDelGrupo(grupo: GrupoParaRevisar): bigint {
  const deltas = grupo.opciones
    .filter((o) => o.activa)
    .map((o) => o.deltaCentavos)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const primera = deltas[0];
  if (primera === undefined) return 0n;
  if (grupo.tipo === 'unica') return grupo.obligatorio || primera < 0n ? primera : 0n;
  const maximo = Math.min(grupo.maximo ?? deltas.length, deltas.length);
  const minimo = grupo.minimo ?? (grupo.obligatorio ? 1 : 0);
  let suma = 0n;
  for (let i = 0; i < maximo; i += 1) {
    const d = deltas[i] ?? 0n;
    if (i < minimo || d < 0n) suma += d;
  }
  return suma;
}

/**
 * El motivo para rechazar, o `null` si el platillo nunca baja de $0.01 con sus opciones.
 * `precioMinimoCentavos` es lo menos que cuesta el renglón sin opciones: la pieza, la porción o el
 * peso más chico que se vende de lo que va por peso.
 */
export function opcionesQueDejanSinPrecio(
  platillo: { readonly nombre: string; readonly precioMinimoCentavos: bigint },
  grupos: readonly GrupoParaRevisar[],
): string | null {
  const restan = grupos.some((g) => g.opciones.some((o) => o.activa && o.deltaCentavos < 0n));
  if (!restan) return null;
  const peor = grupos.reduce((s, g) => s + loPeorDelGrupo(g), platillo.precioMinimoCentavos);
  if (peor > 0n) return null;
  const pesos = (c: bigint) => `$${(Number(c) / 100).toFixed(2)}`;
  return (
    `Con sus opciones, «${platillo.nombre}» podría quedar en ${peor === 0n ? '$0.00' : `−${pesos(-peor)}`}` +
    `: una opción que resta no puede valer lo mismo o más que el platillo (${pesos(platillo.precioMinimoCentavos)}).`
  );
}
