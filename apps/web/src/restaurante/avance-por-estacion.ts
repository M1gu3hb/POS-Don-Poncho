import { sePrepara } from './platillos-de-cocina.ts';

/**
 * DP-24 · 4.2 y 4.4 · EL AVANCE DE UNA MESA, ESTACIÓN POR ESTACIÓN.
 *
 * Un solo cálculo para dos pantallas: los contadores de la tarjeta de cada estación dentro de la
 * mesa del mesero («Listos 1 de 4», «Entregados 1 de 4») y la «nubecita» del mapa («Cantina ✓»,
 * «Cocina 2 de 4»). Cuenta PLATILLOS (renglones de comanda), no unidades, y sólo los vivos: uno
 * anulado en la mesa no es un platillo que esperar.
 *
 * `salidos` es lo que ya salió de la estación —listo o ya entregado—: es lo que dice la nubecita.
 * `listos` es lo que espera en la ventana ahora mismo: es lo que «Marcar como entregado» entrega.
 */

export interface ItemParaElAvance {
  readonly estado?: string | null;
}

export interface ComandaParaElAvance {
  readonly id: string;
  readonly estado: string;
  readonly estacion_preparacion_id?: string | null;
  readonly estacion_preparacion_nombre?: string | null;
  readonly estacion_preparacion_color?: string | null;
  readonly items?: readonly ItemParaElAvance[] | null;
}

export interface AvanceDeEstacion {
  readonly clave: string;
  readonly nombre: string;
  readonly color: string | null;
  /** Las comandas de esta estación en la cuenta (una por ronda): «Entregar» las manda todas. */
  readonly comandaIds: readonly string[];
  readonly total: number;
  /** Listos para recoger ahora. */
  readonly listos: number;
  readonly entregados: number;
  /** Lo que ya salió de la estación: listos + entregados. */
  readonly salidos: number;
}

const NOMBRE_SIN_ESTACION = 'Cocina';

interface Acumulado {
  nombre: string;
  color: string | null;
  comandaIds: string[];
  total: number;
  listos: number;
  entregados: number;
}

export function resumenPorEstacion(
  comandas: readonly ComandaParaElAvance[],
): readonly AvanceDeEstacion[] {
  const porEstacion = new Map<string, Acumulado>();
  for (const comanda of comandas) {
    if (comanda.estado === 'cancelado') continue;
    const nombre = (comanda.estacion_preparacion_nombre ?? '').trim() || NOMBRE_SIN_ESTACION;
    const clave = comanda.estacion_preparacion_id ?? nombre;
    const acumulado = porEstacion.get(clave) ?? {
      nombre,
      color: comanda.estacion_preparacion_color ?? null,
      comandaIds: [],
      total: 0,
      listos: 0,
      entregados: 0,
    };
    if (!acumulado.comandaIds.includes(comanda.id)) acumulado.comandaIds.push(comanda.id);
    for (const item of comanda.items ?? []) {
      if (!sePrepara(item)) continue;
      acumulado.total += 1;
      const estado = item.estado ?? comanda.estado;
      if (estado === 'listo') acumulado.listos += 1;
      if (estado === 'entregado') acumulado.entregados += 1;
    }
    porEstacion.set(clave, acumulado);
  }
  return [...porEstacion.entries()]
    .filter(([, a]) => a.total > 0)
    .map(([clave, a]) => ({ clave, ...a, salidos: a.listos + a.entregados }));
}

/** «Listos 1 de 4». */
export function contadorDeListos(avance: AvanceDeEstacion): string {
  return `Listos ${String(avance.listos + avance.entregados)} de ${String(avance.total)}`;
}

/** «Entregados 1 de 4». */
export function contadorDeEntregados(avance: AvanceDeEstacion): string {
  return `Entregados ${String(avance.entregados)} de ${String(avance.total)}`;
}

/** ¿Hay algo en la ventana para que «Marcar como entregado» lo recoja? */
export function hayQueEntregar(avance: AvanceDeEstacion): boolean {
  return avance.listos > 0;
}

/**
 * La nubecita del mapa para una estación: «Cantina ✓» si todo salió, «Cocina 2 de 4» si falta, o
 * `null` cuando no hay nada que decir (nada ha salido todavía, o ya se entregó todo).
 */
export function etiquetaDeLaNube(avance: AvanceDeEstacion): string | null {
  if (avance.salidos === 0 || avance.entregados === avance.total) return null;
  return avance.salidos === avance.total
    ? `${avance.nombre} ✓`
    : `${avance.nombre} ${String(avance.salidos)} de ${String(avance.total)}`;
}

/** ¿La nubecita es de una estación que ya terminó («Cocina ✓»)? Ésa va verde y más grande. */
export function nubeCompleta(etiqueta: string): boolean {
  return etiqueta.endsWith(' ✓');
}

/** Las nubecitas de una mesa, en el orden de sus estaciones. */
export function nubesDeLaMesa(comandas: readonly ComandaParaElAvance[]): readonly string[] {
  return resumenPorEstacion(comandas)
    .map(etiquetaDeLaNube)
    .filter((e): e is string => e !== null);
}

/** Las nubecitas de cada cuenta viva: `{ [venta_id]: ['Cocina 2 de 4', 'Cantina ✓'] }`. */
export function nubesPorCuenta(
  comandas: readonly (ComandaParaElAvance & { readonly venta_id?: string | null })[],
): Readonly<Record<string, readonly string[]>> {
  const porCuenta = new Map<string, (typeof comandas)[number][]>();
  for (const comanda of comandas) {
    if (comanda.venta_id === undefined || comanda.venta_id === null) continue;
    porCuenta.set(comanda.venta_id, [...(porCuenta.get(comanda.venta_id) ?? []), comanda]);
  }
  const salida: Record<string, readonly string[]> = {};
  for (const [cuenta, deLaCuenta] of porCuenta) {
    const nubes = nubesDeLaMesa(deLaCuenta);
    if (nubes.length > 0) salida[cuenta] = nubes;
  }
  return salida;
}
