import type { ComandaDeCocina, EstadoDeColumna } from './tipos';

/**
 * DP-16 · 2.2 · LAS COMANDAS DE UNA CUENTA EN UNA SOLA TARJETA, Y EL ORDEN DE LA COLUMNA.
 *
 * Una cuenta que pide a dos estaciones (Cocina y Bebidas) genera dos comandas; la tarjeta compacta
 * las junta para que se lea la mesa de un vistazo. La clave es la cuenta (`venta_id`): el pedido
 * para llevar no tiene mesa y dos pedidos no se mezclan. Dentro de cada columna, lo más viejo
 * arriba: lo que más lleva esperando es lo primero que se ve.
 */

export interface CuentaEnCocina {
  readonly clave: string;
  readonly comandas: readonly ComandaDeCocina[];
}

/** Desde cuándo espera la comanda: desde que se marchó a cocina; si no consta, desde que se creó. */
export function inicioDeLaEspera(comanda: ComandaDeCocina): string | null {
  return comanda.fecha_marchada ?? comanda.fecha_creacion ?? null;
}

export function agruparPorCuenta(comandas: readonly ComandaDeCocina[]): readonly CuentaEnCocina[] {
  const grupos = new Map<string, ComandaDeCocina[]>();
  for (const comanda of comandas) {
    const clave = comanda.venta_id ?? comanda.mesa_id ?? comanda.id;
    grupos.set(clave, [...(grupos.get(clave) ?? []), comanda]);
  }
  return [...grupos].map(([clave, deLaCuenta]) => ({ clave, comandas: deLaCuenta }));
}

function marcaDeOrden(cuenta: CuentaEnCocina, estado: EstadoDeColumna): number {
  let menor = Number.POSITIVE_INFINITY;
  for (const comanda of cuenta.comandas) {
    const fecha =
      estado === 'listo'
        ? (comanda.fecha_listo ?? inicioDeLaEspera(comanda))
        : inicioDeLaEspera(comanda);
    const t = fecha === null ? Number.NaN : Date.parse(fecha);
    if (Number.isFinite(t) && t < menor) menor = t;
  }
  return menor;
}

/** Las más viejas primero; las que no traen fecha, al final y en su orden. */
export function ordenarMasViejasArriba(
  cuentas: readonly CuentaEnCocina[],
  estado: EstadoDeColumna,
): readonly CuentaEnCocina[] {
  return cuentas
    .map((cuenta, posicion) => ({ cuenta, posicion, marca: marcaDeOrden(cuenta, estado) }))
    .sort((a, b) => (a.marca === b.marca ? a.posicion - b.posicion : a.marca - b.marca))
    .map((x) => x.cuenta);
}
