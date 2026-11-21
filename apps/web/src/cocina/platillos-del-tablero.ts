import { sePrepara } from '../restaurante/platillos-de-cocina.ts';

import { inicioDeLaEspera } from './grupos';
import type { ComandaDeCocina, EstadoDeColumna, ItemDeCocina } from './tipos';

/**
 * DP-24 · 4.1 · LA COCINA POR PLATILLO: de qué columna es cada platillo y cómo se arman los
 * bloques por mesa.
 *
 * Las columnas ya no son de la comanda sino del PLATILLO: una misma mesa puede tener un platillo
 * en «Nuevos», otro en «En preparación» y otro en «Listos» a la vez, cada uno bajo su bloque
 * «Mesa 1». La comanda sólo agrupa (estación y hora); su estado se deriva de sus platillos en el
 * servidor y aquí no se consulta para decidir la columna.
 */

export interface PlatilloEnColumna {
  readonly item: ItemDeCocina;
  readonly comanda: ComandaDeCocina;
}

export interface BloqueDeMesa {
  /** La cuenta (`venta_id`), o la mesa, o la comanda cuando no hay otra cosa: no se mezclan. */
  readonly clave: string;
  readonly estado: EstadoDeColumna;
  /** Las comandas que aportan platillos a este bloque (una por estación y ronda). */
  readonly comandas: readonly ComandaDeCocina[];
  readonly platillos: readonly PlatilloEnColumna[];
}

/**
 * La columna de un platillo, o `null` si ya no está en la cocina (entregado o anulado).
 * Un item sin estado (las filas a mano de las pruebas) toma el de su comanda.
 */
export function columnaDelPlatillo(
  item: ItemDeCocina,
  comanda: ComandaDeCocina,
): EstadoDeColumna | null {
  if (!sePrepara(item)) return null;
  const estado = item.estado ?? comanda.estado;
  if (estado === 'pendiente' || estado === 'nuevo') return 'nuevo';
  if (estado === 'en_preparacion') return 'en_preparacion';
  if (estado === 'listo') return 'listo';
  return null;
}

/** Desde cuándo espera el platillo: lo listo cuenta desde que salió; lo demás, desde que se marchó. */
export function esperaDelPlatillo(
  platillo: PlatilloEnColumna,
  estado: EstadoDeColumna,
): string | null {
  if (estado === 'listo') {
    return (
      platillo.item.fecha_listo ??
      platillo.comanda.fecha_listo ??
      inicioDeLaEspera(platillo.comanda)
    );
  }
  return inicioDeLaEspera(platillo.comanda);
}

function milisegundos(fecha: string | null): number {
  const t = fecha === null ? Number.NaN : Date.parse(fecha);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

/** La espera más larga del bloque (la del platillo más viejo), o `null` si ninguno trae fecha. */
export function esperaDelBloque(bloque: BloqueDeMesa): string | null {
  let mejor: string | null = null;
  for (const p of bloque.platillos) {
    const f = esperaDelPlatillo(p, bloque.estado);
    if (f !== null && milisegundos(f) < milisegundos(mejor)) mejor = f;
  }
  return mejor;
}

function claveDeLaCuenta(comanda: ComandaDeCocina): string {
  return comanda.venta_id ?? comanda.mesa_id ?? comanda.id;
}

export type BloquesPorColumna = Readonly<Record<EstadoDeColumna, readonly BloqueDeMesa[]>>;

const COLUMNAS: readonly EstadoDeColumna[] = ['nuevo', 'en_preparacion', 'listo'];

/** Los bloques de cada columna, el más viejo arriba; los que no traen fecha, al final y en su orden. */
export function bloquesPorColumna(comandas: readonly ComandaDeCocina[]): BloquesPorColumna {
  const porColumna = new Map<EstadoDeColumna, Map<string, PlatilloEnColumna[]>>(
    COLUMNAS.map((c) => [c, new Map()]),
  );
  for (const comanda of comandas) {
    for (const item of comanda.items ?? []) {
      const columna = columnaDelPlatillo(item, comanda);
      if (columna === null) continue;
      const bloques = porColumna.get(columna);
      if (bloques === undefined) continue;
      const clave = claveDeLaCuenta(comanda);
      bloques.set(clave, [...(bloques.get(clave) ?? []), { item, comanda }]);
    }
  }
  const resultado = {} as Record<EstadoDeColumna, readonly BloqueDeMesa[]>;
  for (const estado of COLUMNAS) {
    const armados = [...(porColumna.get(estado) ?? [])].map(([clave, platillos]): BloqueDeMesa => {
      const comandasDelBloque = [
        ...new Map(platillos.map((p) => [p.comanda.id, p.comanda])).values(),
      ];
      return { clave, estado, comandas: comandasDelBloque, platillos };
    });
    resultado[estado] = armados
      .map((bloque, posicion) => ({
        bloque,
        posicion,
        marca: milisegundos(esperaDelBloque(bloque)),
      }))
      .sort((a, b) => (a.marca === b.marca ? a.posicion - b.posicion : a.marca - b.marca))
      .map((x) => x.bloque);
  }
  return resultado;
}

/** Cuántos platillos hay en una columna (lo que dice el conteo del encabezado). */
export function contarPlatillos(bloques: readonly BloqueDeMesa[]): number {
  return bloques.reduce((suma, b) => suma + b.platillos.length, 0);
}

/**
 * Los toques en camino, pintados sobre lo leído: el platillo tocado se ve ya en su nueva columna
 * sin esperar al servidor. `toques` va por id de platillo (`{ estado }`).
 */
export function conLosToquesDePlatillos(
  comandas: readonly ComandaDeCocina[],
  toques: ReadonlyMap<string, { readonly parche: { readonly estado?: string } }>,
): readonly ComandaDeCocina[] {
  if (toques.size === 0) return comandas;
  return comandas.map((comanda) => {
    const items = comanda.items ?? [];
    if (!items.some((i) => i.id !== undefined && toques.has(i.id))) return comanda;
    return {
      ...comanda,
      items: items.map((item) => {
        const toque = item.id === undefined ? undefined : toques.get(item.id);
        return toque === undefined ? item : { ...item, ...toque.parche };
      }),
    };
  });
}
