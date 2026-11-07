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

/** DP-14.1-4 · Tiempo límite de la lectura de opciones: pasado esto se da por fallida y se ofrece reintentar. */
export const TIEMPO_LIMITE_DE_LAS_OPCIONES_MS = 8_000;

/** Dónde se guarda la última lectura buena, para que una tableta sin red siga sabiendo qué pide opciones. */
const LLAVE_GUARDADA = 'morphiqpos:opciones_de_los_platillos:v1';

/** La última lectura buena de este navegador, o `undefined` (nunca leída, o el almacenamiento no sirve). */
export function leerOpcionesGuardadas(): OpcionesPorPlatillo | undefined {
  try {
    const crudo = globalThis.localStorage.getItem(LLAVE_GUARDADA);
    if (crudo == null) return undefined;
    const valor: unknown = JSON.parse(crudo);
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
      ? (valor as OpcionesPorPlatillo)
      : undefined;
  } catch {
    // Almacenamiento bloqueado o JSON dañado: es sólo una comodidad, se actúa como si no hubiera.
    return undefined;
  }
}

/** Guarda la lectura buena; si el almacenamiento no sirve, no pasa nada. */
export function guardarOpciones(opciones: OpcionesPorPlatillo): void {
  try {
    globalThis.localStorage.setItem(LLAVE_GUARDADA, JSON.stringify(opciones));
  } catch {
    // Sin almacenamiento (modo privado, lleno): la lectura sigue en memoria.
  }
}

/**
 * DP-14.1-4 · ¿Este platillo pide opciones, sin esperar la lectura?
 *   · `'no'`: se agrega al instante. Lo dice primero la pista `tiene_opciones` del producto, que
 *     el puente trae en la MISMA lectura de la carta (es la de ahora); sin ella, la lectura de
 *     opciones (viva o guardada) cuando el platillo no tiene grupos.
 *   · `'si'` / `'no_se'`: hay que leerlas (con tiempo límite) antes de agregar.
 * La pista va primero: un mapa guardado puede ser de antes de que el platillo ganara su grupo.
 */
export function pideOpciones(
  producto: { readonly id: string; readonly tiene_opciones?: boolean | null },
  opciones: OpcionesPorPlatillo | undefined,
): 'si' | 'no' | 'no_se' {
  if (producto.tiene_opciones === true) return 'si';
  if (producto.tiene_opciones === false) return 'no';
  if (opciones !== undefined) return (opciones[producto.id]?.length ?? 0) > 0 ? 'si' : 'no';
  return 'no_se';
}
