/**
 * DP-15 · LO DEL DÍA, NO LO DE UNA CAJA.
 *
 * «Ventas hoy» del Tablero contaba sólo la caja abierta que el aparato encontraba primero
 * (`useCajaAbierta` sin terminal da `abiertas[0]`): con dos cajas, el dueño veía la mitad, y con
 * las cajas cerradas, $0 aunque el día hubiera vendido. Ahora es el día del restaurante: toda venta
 * pagada que se cerró desde las 00:00 (hora del aparato, que en el local es la de CDMX) y todo
 * gasto registrado desde entonces, de cualquier caja.
 */

interface ConFechaDeCierre {
  readonly fecha_cierre?: string | null;
}

interface ConFechaDeAlta {
  readonly created_date?: string | null;
}

const desde = (fecha: string | null | undefined): number =>
  fecha ? new Date(fecha).getTime() : Number.NaN;

export function delDia<V extends ConFechaDeCierre, G extends ConFechaDeAlta>(
  ventas: readonly (V | null | undefined)[],
  gastos: readonly (G | null | undefined)[],
  inicioDelDia: number,
): { readonly ventas: V[]; readonly gastos: G[] } {
  return {
    ventas: ventas.filter((v): v is V => v != null && desde(v.fecha_cierre) >= inicioDelDia),
    gastos: gastos.filter((g): g is G => g != null && desde(g.created_date) >= inicioDelDia),
  };
}
