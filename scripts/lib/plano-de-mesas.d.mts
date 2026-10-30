/** Tipos de `plano-de-mesas.mjs` (DP-11.0), para que su prueba se lea con tipos. */
export interface MesaEnElPlano {
  readonly id: string;
  readonly numero: number;
  readonly posicion_x: number | null;
  readonly posicion_y: number | null;
}

export interface PlanoDeLaSala {
  readonly columnas: number;
  readonly x: number;
  readonly y: number;
  readonly pasoX: number;
  readonly pasoY: number;
}

export function planoDeLasMesas(
  mesas: readonly MesaEnElPlano[],
  plano: PlanoDeLaSala,
): { id: string; numero: number; x: number; y: number }[];
