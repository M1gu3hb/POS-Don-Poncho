/**
 * DP-16 · LO QUE CUESTAN LAS OPCIONES, en la pantalla (mesero, para llevar y portal).
 *
 * La pantalla sólo ENSEÑA el precio: el que cuenta lo calcula el servidor al escribir la línea
 * (`precio-de-las-opciones.ts` de `packages/app`). Aquí se usa para que el carrito diga lo mismo
 * que va a decir la cuenta: en una pieza la opción va por unidad; en lo que va por peso, una vez
 * por renglón.
 */

export interface OpcionConPrecio {
  readonly precioCentavos?: string | number | null;
}

export interface GrupoElegido {
  readonly opciones?: readonly OpcionConPrecio[] | null;
}

function centavosDe(valor: string | number | null | undefined): number {
  const n = typeof valor === 'number' ? valor : Number(valor ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** Cuánto suman (o restan) las opciones elegidas, en centavos. */
export function centavosDeLasOpciones(
  modificadores: readonly GrupoElegido[] | null | undefined,
): number {
  return (modificadores ?? []).reduce(
    (suma, g) => suma + (g.opciones ?? []).reduce((s, o) => s + centavosDe(o.precioCentavos), 0),
    0,
  );
}

const formato = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** «+$15.00», «−$5.00» o «» si la opción no cambia el precio. */
export function etiquetaDelPrecio(precioCentavos: string | number | null | undefined): string {
  const c = centavosDe(precioCentavos);
  if (c === 0) return '';
  return `${c > 0 ? '+' : '−'}${formato.format(Math.abs(c) / 100)}`;
}

/** El precio (en pesos) de UNA unidad con sus opciones, nunca menor que cero. */
export function precioConOpciones(
  precioBase: number,
  modificadores: readonly GrupoElegido[] | null | undefined,
): number {
  const conOpciones = Math.round(precioBase * 100) + centavosDeLasOpciones(modificadores);
  return Math.max(0, conOpciones) / 100;
}
