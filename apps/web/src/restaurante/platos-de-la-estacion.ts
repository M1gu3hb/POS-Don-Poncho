/**
 * DP-15 · F1 · Lo que la pantalla de una estación pinta de cada comanda.
 *
 * Dos reglas puras, para que no dependan de la tarjeta que las dibuje:
 *
 *   · un platillo QUITADO por el mesero (`cancelado`) no se pinta nunca: la comanda sigue viva por
 *     los demás platillos, pero el quitado ya no se prepara;
 *   · una comanda a la que no le queda ningún platillo vivo (todos quitados) no es trabajo.
 *
 * Y una marca: una cuenta COBRADA con comida todavía por preparar. No se cierra sola (podría ser
 * comida que sí se va a servir); se enseña «cuenta cobrada» para que la cocina decida.
 */

interface ConPlatillos {
  readonly items?: readonly { readonly estado?: string | null }[] | null;
  readonly venta_id?: string | null;
}

export function sinPlatillosQuitados<T extends ConPlatillos>(comandas: readonly T[]): T[] {
  const salida: T[] = [];
  for (const comanda of comandas) {
    const items = comanda.items;
    if (items === undefined || items === null || items.length === 0) {
      salida.push(comanda);
      continue;
    }
    const vivos = items.filter((i) => i.estado !== 'cancelado');
    if (vivos.length === 0) continue;
    salida.push(vivos.length === items.length ? comanda : { ...comanda, items: vivos });
  }
  return salida;
}

/** Las comandas con la marca `cuenta_cobrada` cuando su cuenta ya está pagada. */
export function conLaCuentaCobrada<T extends ConPlatillos>(
  comandas: readonly T[],
  ventas: Readonly<Record<string, { readonly estado?: string | null } | undefined>>,
): (T & { cuenta_cobrada?: true })[] {
  return comandas.map((c) =>
    c.venta_id != null && ventas[c.venta_id]?.estado === 'pagada'
      ? { ...c, cuenta_cobrada: true as const }
      : c,
  );
}
