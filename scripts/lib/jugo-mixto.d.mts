/** Los tipos de `jugo-mixto.mjs`, para que el guion y sus pruebas no lean `any`. */

export const PRODUCTO: string;
export const GRUPO: string;
export const OPCION: string;

export function pesosConSigno(centavos: bigint | number | string): string;

export interface EstadoDelJugo {
  readonly productos: readonly {
    readonly id: string;
    readonly nombre: string;
    readonly activo: boolean;
  }[];
  readonly grupos: readonly {
    readonly id: string;
    readonly nombre: string;
    readonly tipo: string;
    readonly obligatorio: boolean;
    readonly activo: boolean;
    readonly minimo_elecciones: number | null;
    readonly maximo_elecciones: number | null;
  }[];
  readonly asignaciones: readonly {
    readonly producto_id: string;
    readonly modificador_id: string;
  }[];
  readonly opciones: readonly {
    readonly id: string;
    readonly modificador_id: string;
    readonly nombre: string;
    readonly orden: number;
    readonly activa: boolean;
    readonly delta_precio_centavos: bigint | number | string;
  }[];
}

export interface OpcionDelGrupo {
  readonly id?: string;
  readonly nombre: string;
  readonly precio: string;
  readonly activa: boolean;
}

export interface EntradaDelGrupo {
  readonly grupoId: string;
  readonly nombre: string;
  readonly tipo: string;
  readonly obligatorio: boolean;
  readonly minimo: number | null;
  readonly maximo: number | null;
  readonly activo: boolean;
  readonly opciones: readonly OpcionDelGrupo[];
}

export interface PlanDelJugo {
  readonly accion: 'agregar' | 'nada' | 'problema';
  readonly mensaje: string;
  readonly entrada?: EntradaDelGrupo;
}

export function planDelJugoMixto(estado: EstadoDelJugo): PlanDelJugo;
