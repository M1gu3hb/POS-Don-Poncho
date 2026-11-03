/**
 * QA1-4 (DP-13.5) · LAS OPCIONES DE CADA PLATILLO, PEGADAS AL PRODUCTO DEL PUENTE.
 *
 * `SeleccionModificadoresDialog` (mesero) y `ModificadoresDialog` (editor de Productos) leen
 * `producto.modificadores`, que el puente nunca trae: son tres tablas. La lectura
 * `restaurante.opciones_de_los_platillos` los da por producto, y aquí se pegan a cada uno, con la
 * forma que esos diálogos ya saben pintar.
 */

export interface OpcionDelPlatillo {
  readonly id: string;
  readonly nombre: string;
  readonly activo: boolean;
}

export interface GrupoDelPlatillo {
  readonly id: string;
  readonly nombre: string;
  readonly obligatorio: boolean;
  readonly tipo: 'unica' | 'multiple';
  readonly activo: boolean;
  readonly opciones: readonly OpcionDelPlatillo[];
}

export type OpcionesPorPlatillo = Readonly<Record<string, readonly GrupoDelPlatillo[]>>;

export const RUTA_DE_LAS_OPCIONES = '/api/restaurante/opciones-de-los-platillos';
export const CLAVE_DE_LAS_OPCIONES = ['opciones_de_los_platillos'] as const;

/** Cada producto con sus grupos de opciones; el que no tiene, con la lista vacía. */
export function conSusOpciones<T extends { readonly id: string }>(
  productos: readonly T[],
  opciones: OpcionesPorPlatillo,
): (T & { readonly modificadores: readonly GrupoDelPlatillo[] })[] {
  return productos.map((producto) => ({
    ...producto,
    modificadores: opciones[producto.id] ?? [],
  }));
}
