/**
 * DP-15 · EL PEDIDO A MEDIAS DEL MESERO SOBREVIVE A UNA RECARGA (M6 de la auditoría).
 *
 * El mesero va tocando platillos y, si el teléfono recarga la pestaña (se le acabó la memoria, la
 * red parpadeó, alguien jaló la página), perdía lo que llevaba. Ahora el carrito de cada mesa se
 * guarda en ESTE aparato mientras se arma, y se recupera al volver a abrir la mesa.
 *
 * Tres frenos para no revivir lo que no es: el borrador es de la persona que lo armó (la clave
 * lleva su id), es de la MISMA cuenta (si la mesa ya es de otra familia, no se recupera) y caduca a
 * las 3 horas, como el carrito del portal. Al enviar a cocina se borra. Lo vencido y lo de una cuenta
 * que ya se cobró o se cerró se borra al leerse (o en el barrido de `limpiarBorradoresDeCuentasCerradas`).
 *
 * Puro y sin `window`: el almacén se pasa (en la pantalla es `localStorage`). Nada aquí lanza: un
 * almacén lleno, bloqueado o en modo privado sólo significa que no hay borrador.
 */

export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

/** Un almacén que también se puede recorrer (`localStorage` lo es): para barrer lo que quedó. */
export interface AlmacenRecorrible extends Almacen {
  readonly length: number;
  key(indice: number): string | null;
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

const PREFIJO_DEL_BORRADOR = 'morphiqpos.borrador-del-pedido.v1.';

/**
 * Cuánto se respeta un borrador recién guardado al barrer. La lista de mesas con la que se barre
 * puede haberse pedido ANTES de que el mesero abriera esa cuenta: sin esta gracia, el barrido
 * borraría el pedido que apenas empezó a armar.
 */
export const GRACIA_DEL_BARRIDO_MS = 2 * 60 * 1000;

export function claveDelBorrador(usuarioId: string, mesaId: string): string {
  return `${PREFIJO_DEL_BORRADOR}${usuarioId}.${mesaId}`;
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
  if (typeof dato !== 'object' || dato === null) {
    borrarBorrador(almacen, clave);
    return null;
  }
  const b = dato as Record<string, unknown>;
  const guardado = typeof b['guardado'] === 'number' ? b['guardado'] : 0;
  const vencido = ahora - guardado > VIGENCIA_DEL_BORRADOR_MS;
  // Vencido, o de OTRA cuenta de esta mesa: esa cuenta ya se cobró o se cerró (la mesa tiene una
  // nueva), así que lo guardado no es de nadie. No se ofrece y no se deja estorbando.
  if (vencido || b['ordenId'] !== ordenId) {
    borrarBorrador(almacen, clave);
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

/**
 * DP-15.1 · Barre los borradores de cuentas que ya se cobraron o cerraron.
 *
 * Una cuenta cobrada deja su borrador en el aparato si el mesero no volvió a abrir esa mesa (el
 * cobro pasa en caja, en otro aparato). `ordenesVivas` son las cuentas que hoy están sobre alguna
 * mesa; lo que apunta a otra cosa, lo vencido y lo mal formado se borran. Sólo mira las claves de
 * este módulo, y respeta lo recién guardado (`GRACIA_DEL_BARRIDO_MS`). Nada aquí lanza.
 */
export function limpiarBorradoresDeCuentasCerradas(
  almacen: AlmacenRecorrible,
  ordenesVivas: ReadonlySet<string>,
  ahora: number,
): void {
  try {
    const claves: string[] = [];
    for (let i = 0; i < almacen.length; i += 1) {
      const clave = almacen.key(i);
      if (clave?.startsWith(PREFIJO_DEL_BORRADOR) === true) claves.push(clave);
    }
    for (const clave of claves) {
      if (sobraElBorrador(almacen, clave, ordenesVivas, ahora)) borrarBorrador(almacen, clave);
    }
  } catch {
    // Un almacén que falla al recorrerse sólo deja los borradores donde estaban.
  }
}

function sobraElBorrador(
  almacen: Almacen,
  clave: string,
  ordenesVivas: ReadonlySet<string>,
  ahora: number,
): boolean {
  let dato: unknown;
  try {
    dato = JSON.parse(almacen.getItem(clave) ?? 'null');
  } catch {
    return true;
  }
  if (typeof dato !== 'object' || dato === null) return true;
  const b = dato as Record<string, unknown>;
  const guardado = typeof b['guardado'] === 'number' ? b['guardado'] : 0;
  if (ahora - guardado > VIGENCIA_DEL_BORRADOR_MS) return true;
  if (ahora - guardado < GRACIA_DEL_BARRIDO_MS) return false;
  return typeof b['ordenId'] !== 'string' || !ordenesVivas.has(b['ordenId']);
}

/** `localStorage` si existe y se deja usar; si no, un almacén vacío que no guarda nada. */
export function almacenDelBorrador(): AlmacenRecorrible {
  const nulo: AlmacenRecorrible = {
    length: 0,
    key: () => null,
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
