/** Los tipos de `menu.mjs`, para que el guion y sus pruebas no lean `any`. */

/** `[nombre, precio en centavos, de temporada]`. */
export type OpcionDelMenu = readonly [string, number] | readonly [string, number, boolean];

export interface GrupoDelMenu {
  readonly clave: string;
  readonly nombre: string;
  readonly obligatorio?: boolean;
  readonly opciones: readonly OpcionDelMenu[];
}

export interface ProductoDelMenu {
  readonly nombre: string;
  readonly detalle?: string;
  /** Centavos enteros. Por peso, es el precio de UNA unidad (el kilo). */
  readonly precio: number;
  readonly modificadores?: readonly string[];
  readonly porPeso?: { readonly unidad: string; readonly presets?: readonly number[] };
}

export interface CategoriaDelMenu {
  readonly nombre: string;
  readonly estacion: string;
  readonly copa?: boolean;
  readonly productos: readonly ProductoDelMenu[];
}

export interface MenuDelRestaurante {
  readonly version: number;
  readonly moneda: string;
  readonly estaciones: readonly string[];
  /** A qué área comanda cada estación: `cocina`, `barra` o `ambos`. */
  readonly areaPorEstacion?: Readonly<Record<string, string>>;
  readonly modificadores: readonly GrupoDelMenu[];
  readonly categorias: readonly CategoriaDelMenu[];
}

export const MAXIMO_DE_OPCIONES: number;

export function pesos(centavos: number): string;
export function validarMenu(menu: MenuDelRestaurante): string[];
export function entradaDelProducto(
  categoria: CategoriaDelMenu,
  producto: ProductoDelMenu,
  categoriaId: string,
): Record<string, unknown>;
export function areaDeLaCategoria(
  menu: MenuDelRestaurante,
  categoria: CategoriaDelMenu,
): 'cocina' | 'barra' | 'ambos';
export function atajosDelProducto(producto: ProductoDelMenu): number[] | null;
export function gruposDelProducto(
  menu: MenuDelRestaurante,
  producto: ProductoDelMenu,
): {
  nombre: string;
  obligatorio: boolean;
  tipo: 'unica';
  activo: boolean;
  opciones: { nombre: string; precioExtra: string; activa: boolean }[];
}[];
export function resumenDelMenu(menu: MenuDelRestaurante): {
  estaciones: number;
  categorias: number;
  productos: number;
  porPeso: number;
  conOpciones: number;
};
