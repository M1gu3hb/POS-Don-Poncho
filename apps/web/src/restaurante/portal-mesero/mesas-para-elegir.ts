/**
 * LAS MESAS QUE SE PUEDEN ELEGIR SIN CÁMARA (DP-13.2): las activas que no están absorbidas por
 * otra (su pedido es el de la principal), por número. Puro.
 */

export interface MesaParaElegir {
  readonly id: string;
  readonly numero: number;
  readonly activo?: boolean | null;
  readonly unida_a_mesa_id?: string | null;
}

export function mesasParaElegir(mesas: readonly MesaParaElegir[]): readonly MesaParaElegir[] {
  return mesas
    .filter((m) => m.activo !== false && (m.unida_a_mesa_id ?? null) === null)
    .slice()
    .sort((a, b) => a.numero - b.numero);
}
