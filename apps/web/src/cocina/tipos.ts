/**
 * DP-16 · 2.2 · LO QUE LA PANTALLA GRANDE DE COCINA SABE DE UNA COMANDA.
 *
 * La forma que sirve el puente (`PedidoPreparacion` con sus `items`), sólo con los campos que el
 * tablero lee. Ningún precio: el servidor no los manda a la cocina.
 */

/** Un grupo de opciones elegido para un platillo: «Relleno» → «Queso». */
export interface OpcionDeCocina {
  readonly grupo: string;
  readonly opciones: readonly string[];
}

export interface ItemDeCocina {
  readonly id?: string;
  readonly producto_id?: string | null;
  readonly producto_nombre?: string | null;
  readonly cantidad?: number | string | null;
  readonly notas?: string | null;
  readonly estado?: string | null;
  readonly tipo_venta?: string | null;
  readonly unidad_variable?: string | null;
  readonly cantidad_variable?: number | string | null;
  readonly cantidad_porciones?: number | string | null;
  readonly nombre_porcion?: string | null;
  /** La instantánea de las opciones elegidas, ya reducida por el puente a grupo y nombres. */
  readonly opciones?: unknown;
}

export interface ComandaDeCocina {
  readonly id: string;
  readonly estado: string;
  readonly venta_id?: string | null;
  readonly mesa_id?: string | null;
  readonly mesa_numero?: number | null;
  readonly canal?: string | null;
  readonly numero_pedido?: number | null;
  readonly nombre_pedido?: string | null;
  readonly fecha_creacion?: string | null;
  readonly fecha_marchada?: string | null;
  readonly fecha_listo?: string | null;
  readonly estacion_preparacion_nombre?: string | null;
  readonly estacion_preparacion_color?: string | null;
  readonly notas?: string | null;
  readonly notas_alergias?: string | null;
  readonly celebracion_especial?: boolean | null;
  readonly tipo_celebracion?: string | null;
  readonly cuenta_cobrada?: boolean;
  readonly items?: readonly ItemDeCocina[] | null;
}

/** Los tres estados que se ven en el tablero, en el orden de las columnas. */
export type EstadoDeColumna = 'nuevo' | 'en_preparacion' | 'listo';
