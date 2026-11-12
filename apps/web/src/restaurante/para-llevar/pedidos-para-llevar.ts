/**
 * DP-16 · Los pedidos para llevar del día, como los ve la Caja (`restaurante.para_llevar_del_dia`).
 *
 * Lo que decide qué se avisa vive aquí, sin pantalla, para probarlo solo: un pedido que la cocina
 * acaba de terminar suena UNA vez, y uno que ya estaba listo cuando se abrió la Caja no suena (se ve
 * en la lista, pero no se anuncia como nuevo).
 */

export type EstadoParaLlevar = 'en_cocina' | 'listo' | 'entregado';

export interface PedidoParaLlevar {
  readonly ordenId: string;
  readonly numero: number;
  readonly nombre: string | null;
  readonly folio: string;
  readonly totalCentavos: string;
  readonly cobradoEn: string | null;
  readonly estado: EstadoParaLlevar;
  readonly pendientes: number;
  readonly listas: number;
  readonly listoEn: string | null;
  /** DP-18 · Se cobró otro día y sigue sin entregarse (un servidor viejo no lo manda). */
  readonly deOtroDia?: boolean;
}

export const RUTA_PARA_LLEVAR_DEL_DIA = '/api/restaurante/para-llevar-del-dia';
export const RUTA_ENTREGAR = '/api/restaurante/entregar-para-llevar';

/** «Pedido para llevar 3 · Don Beto»; si se cobró otro día y no se ha entregado, «… · de ayer». */
export function tituloDelPedido(
  pedido: Pick<PedidoParaLlevar, 'numero' | 'nombre'> & { readonly deOtroDia?: boolean },
): string {
  const nombre = (pedido.nombre ?? '').trim();
  const deAyer = pedido.deOtroDia === true ? ' · de ayer' : '';
  return `Pedido para llevar ${String(pedido.numero)}${nombre === '' ? '' : ` · ${nombre}`}${deAyer}`;
}

/**
 * Los que pasaron a «listo» desde la lectura anterior. La primera lectura (`anteriores === null`)
 * no anuncia nada: lo que ya estaba listo no es noticia.
 */
export function recienListos(
  anteriores: ReadonlyMap<string, EstadoParaLlevar> | null,
  actuales: readonly PedidoParaLlevar[],
): readonly PedidoParaLlevar[] {
  if (anteriores === null) return [];
  return actuales.filter((p) => p.estado === 'listo' && anteriores.get(p.ordenId) !== 'listo');
}

export function estadosDe(
  pedidos: readonly PedidoParaLlevar[],
): ReadonlyMap<string, EstadoParaLlevar> {
  return new Map(pedidos.map((p) => [p.ordenId, p.estado]));
}

/** Primero lo listo (lo más viejo arriba: lleva más esperando), luego lo que está en cocina. */
export function ordenDeLaLista(pedidos: readonly PedidoParaLlevar[]): readonly PedidoParaLlevar[] {
  const peso = (e: EstadoParaLlevar) => (e === 'listo' ? 0 : e === 'en_cocina' ? 1 : 2);
  return [...pedidos].sort((a, b) => peso(a.estado) - peso(b.estado) || a.numero - b.numero);
}
