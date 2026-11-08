/**
 * DP-15 · EL PEDIDO A MEDIAS DEL MESERO SOBREVIVE A UNA RECARGA (M6 de la auditoría).
 *
 * El mesero va tocando platillos y, si el teléfono recarga la pestaña (se le acabó la memoria, la
 * red parpadeó, alguien jaló la página), perdía lo que llevaba. Ahora el carrito de cada mesa se
 * guarda en ESTE aparato mientras se arma, y se recupera al volver a abrir la mesa.
 *
 * Tres frenos para no revivir lo que no es: el borrador es de la persona que lo armó (la clave
 * lleva su id), es de la MISMA cuenta (si la mesa ya es de otra familia, no se recupera) y caduca a
 * las 3 horas, como el carrito del portal. Al enviar a cocina se borra.
 *
 * Puro y sin `window`: el almacén se pasa (en la pantalla es `localStorage`). Nada aquí lanza: un
 * almacén lleno, bloqueado o en modo privado sólo significa que no hay borrador.
 */

export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

export interface LineaDelBorrador {
  readonly id: string;
  readonly cantidad: number;
  readonly [campo: string]: unknown;
}

export interface Borrador {
  readonly ordenId: string;
  readonly carrito: readonly LineaDelBorrador[];
  readonly nota: string;
}

export const VIGENCIA_DEL_BORRADOR_MS = 3 * 60 * 60 * 1000;

export function claveDelBorrador(usuarioId: string, mesaId: string): string {
  return `morphiqpos.borrador-del-pedido.v1.${usuarioId}.${mesaId}`;
}

function esLinea(valor: unknown): valor is LineaDelBorrador {
  if (typeof valor !== 'object' || valor === null) return false;
  const linea = valor as Record<string, unknown>;
  return (
    typeof linea['id'] === 'string' &&
    typeof linea['cantidad'] === 'number' &&
    Number.isFinite(linea['cantidad']) &&
    linea['cantidad'] > 0
  );
}

/** Guarda lo que lleva; sin nada que guardar, borra. */
export function guardarBorrador(
  almacen: Almacen,
  clave: string,
  borrador: Borrador,
  ahora: number,
): void {
  try {
    if (borrador.carrito.length === 0 && borrador.nota.trim() === '') {
      almacen.removeItem(clave);
      return;
    }
    almacen.setItem(clave, JSON.stringify({ ...borrador, guardado: ahora }));
  } catch {
    // Almacén lleno o bloqueado: el pedido sigue en pantalla, sólo no sobrevive a una recarga.
  }
}

/** El borrador de ESTA cuenta, vigente y bien formado; si no, nada (y lo vencido se borra). */
export function leerBorrador(
  almacen: Almacen,
  clave: string,
  ordenId: string,
  ahora: number,
): Borrador | null {
  let crudo: string | null;
  try {
    crudo = almacen.getItem(clave);
  } catch {
    return null;
  }
  if (crudo === null) return null;
  let dato: unknown;
  try {
    dato = JSON.parse(crudo);
  } catch {
    borrarBorrador(almacen, clave);
    return null;
  }
  if (typeof dato !== 'object' || dato === null) return null;
  const b = dato as Record<string, unknown>;
  const guardado = typeof b['guardado'] === 'number' ? b['guardado'] : 0;
  const vencido = ahora - guardado > VIGENCIA_DEL_BORRADOR_MS;
  if (vencido || b['ordenId'] !== ordenId) {
    if (vencido) borrarBorrador(almacen, clave);
    return null;
  }
  const carrito = Array.isArray(b['carrito']) ? b['carrito'].filter(esLinea) : [];
  const nota = typeof b['nota'] === 'string' ? b['nota'] : '';
  if (carrito.length === 0 && nota.trim() === '') return null;
  return { ordenId, carrito, nota };
}

export function borrarBorrador(almacen: Almacen, clave: string): void {
  try {
    almacen.removeItem(clave);
  } catch {
    // Igual que al guardar: sin almacén no hay nada que borrar.
  }
}

/** `localStorage` si existe y se deja usar; si no, un almacén vacío que no guarda nada. */
export function almacenDelAparato(): Almacen {
  const nulo: Almacen = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  try {
    return typeof window === 'undefined' ? nulo : window.localStorage;
  } catch {
    return nulo;
  }
}
