import { zonaDeLaMesa } from '~/cliente/mesas-del-mapa';

/**
 * LAS MESAS QUE SE PUEDEN ELEGIR SIN CÁMARA (DP-13.2): las activas que no están absorbidas por
 * otra (su pedido es el de la principal), por número. Puro.
 *
 * DP-14.6 · Cada una dice su ZONA y su ESTADO: con veinticinco mesas, «Mesa 7» sola no dice cuál
 * es ni si vale la pena tocarla (la que ya está libre no tiene pedido del portal que confirmar).
 */

export interface MesaParaElegir {
  readonly id: string;
  readonly numero: number;
  readonly activo?: boolean | null;
  readonly unida_a_mesa_id?: string | null;
  readonly zona?: string | null;
  readonly estado?: string | null;
}

/** Las mismas palabras del mapa de mesas. */
const ETIQUETA_DEL_ESTADO: Readonly<Record<string, string>> = {
  libre: 'Libre',
  esperando_orden: 'Esperando orden',
  pedido_enviado: 'Pedido enviado',
  en_preparacion: 'En preparación',
  en_espera_entrega: 'Esperando entrega',
  ocupada: 'Ocupada',
  cuenta_solicitada: 'Cuenta solicitada',
  limpieza: 'Limpieza',
};

export function etiquetaDelEstado(estado: string | null | undefined): string {
  return ETIQUETA_DEL_ESTADO[estado ?? 'libre'] ?? 'Libre';
}

/** «Terraza · Libre»: lo que se escribe bajo el número de la mesa. */
export function zonaYEstado(mesa: Pick<MesaParaElegir, 'zona' | 'estado'>): string {
  return `${zonaDeLaMesa({ zona: mesa.zona })} · ${etiquetaDelEstado(mesa.estado)}`;
}

export function mesasParaElegir(mesas: readonly MesaParaElegir[]): readonly MesaParaElegir[] {
  return mesas
    .filter((m) => m.activo !== false && (m.unida_a_mesa_id ?? null) === null)
    .slice()
    .sort((a, b) => a.numero - b.numero);
}
