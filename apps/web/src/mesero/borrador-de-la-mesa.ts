import { centavosDe } from '../cliente/dinero-del-puente';

import { primeroConTexto, textoDe } from './texto';

/**
 * EL BORRADOR DE LA MESA · lo que el mesero arma antes de «Enviar a Cocina».
 *
 * ── Por qué es un módulo y no estado de `Mesero` ───────────────────────────
 * El carrito, la búsqueda y el filtro vivían en el componente de nivel superior. Cada toque a un
 * platillo, cada tecla del buscador y cada sondeo de las mesas (5 s) y de las solicitudes (6 s)
 * volvían a dibujar el mapa entero y los 107 botones del catálogo. Aquí está la lógica, sin
 * pantalla: son las MISMAS reglas que tenía `Mesero.jsx` (agrupar el platillo repetido, no agrupar
 * el de opciones ni el de kilo, la nota con las opciones elegidas…), pero se pueden ver fallar.
 * `use-borrador-de-la-mesa.ts` las guarda fuera de React para que sólo se redibuje quien las lee.
 *
 * Ninguna función muta lo que recibe: devuelven una lista nueva y, de la línea que no cambió,
 * el MISMO objeto (por eso un renglón memoizado no se vuelve a pintar cuando cambia otro).
 */

/** Lo que el catálogo del POS trae de cada platillo y este borrador lee. */
export interface ProductoDelMenu {
  readonly id: string;
  readonly nombre?: string | null;
  readonly categoria_id?: string | null;
  /** En PESOS, como lo sirve el puente. */
  readonly precio_venta?: number | null;
  readonly tipo_venta?: string | null;
  readonly area_preparacion?: string | null;
  readonly modificadores?: unknown;
  readonly [campo: string]: unknown;
}

/** El renglón del borrador: el platillo y lo que el mesero le fue poniendo. */
export type LineaDelBorrador = ProductoDelMenu & {
  readonly cantidad: number;
  /** La nota FINAL que viaja a cocina: opciones elegidas, exclusiones y nota libre. */
  readonly notas: string;
  /** Sólo lo que el mesero escribió a mano. */
  readonly _notaUsuario: string;
  readonly _exclusiones: readonly string[];
  readonly _modificadores: readonly unknown[];
  /** Un platillo de kilo o de porción: la cantidad real va aquí, no en `cantidad`. */
  readonly _variable?: unknown;
};

export type Carrito = readonly LineaDelBorrador[];

/** Lo que el diálogo de cantidad deja: la cantidad real, la unidad y el total ya calculado. */
export interface SnapshotVariable {
  readonly precio_total_linea?: unknown;
  readonly [campo: string]: unknown;
}

/** Un platillo que se agrega con sus opciones ya elegidas. */
export interface OpcionesElegidas {
  readonly modificadores?: unknown;
  readonly notas?: string | null | undefined;
}

function lineaNueva(producto: ProductoDelMenu): LineaDelBorrador {
  return {
    ...producto,
    cantidad: 1,
    notas: '',
    _notaUsuario: '',
    _exclusiones: [],
    _modificadores: [],
  };
}

/** El toque directo: si el platillo ya está sube su cantidad, y si no, abre su línea. */
export function conProducto(carrito: Carrito, producto: ProductoDelMenu): Carrito {
  const existe = carrito.some((linea) => linea.id === producto.id);
  if (existe) {
    return carrito.map((linea) =>
      linea.id === producto.id ? { ...linea, cantidad: linea.cantidad + 1 } : linea,
    );
  }
  return [...carrito, lineaNueva(producto)];
}

/**
 * Un platillo de kilo o de porción: SIEMPRE una línea nueva, porque cada cantidad puede ser otra.
 * Su cantidad lógica es 1 y su precio es el total que el diálogo ya calculó (con la cantidad real
 * adentro), así que `precio_venta × cantidad` sigue siendo lo que cuesta esa línea.
 */
export function conLineaVariable(
  carrito: Carrito,
  producto: ProductoDelMenu,
  snapshot: SnapshotVariable,
): Carrito {
  const precio = Number(snapshot.precio_total_linea);
  return [
    ...carrito,
    {
      ...lineaNueva(producto),
      precio_venta: Number.isFinite(precio) ? precio : 0,
      _variable: snapshot,
    },
  ];
}

interface GrupoElegido {
  readonly grupo_nombre?: string;
  readonly opciones?: readonly { readonly nombre?: string }[];
}

/** «Término: Medio, Bien cocido · Salsa: Verde»: las opciones elegidas en texto plano. */
export function textoDeModificadores(modificadores: unknown): string {
  const grupos: readonly unknown[] = Array.isArray(modificadores) ? modificadores : [];
  return grupos
    .filter(
      (m): m is GrupoElegido =>
        typeof m === 'object' &&
        m !== null &&
        Array.isArray((m as GrupoElegido).opciones) &&
        ((m as GrupoElegido).opciones?.length ?? 0) > 0,
    )
    .map(
      (m) =>
        `${m.grupo_nombre ?? ''}: ${(m.opciones ?? [])
          .map((o) => o.nombre)
          .filter(Boolean)
          .join(', ')}`,
    )
    .join(' · ');
}

/**
 * Un platillo con opciones: línea NUEVA (cada combinación de opciones puede ser distinta), con
 * la nota que lee cocina —las opciones y, detrás, lo que el mesero escribió—.
 */
export function conLineaPersonalizada(
  carrito: Carrito,
  producto: ProductoDelMenu,
  { modificadores, notas }: OpcionesElegidas,
): Carrito {
  const libre = (notas ?? '').trim();
  return [
    ...carrito,
    {
      ...lineaNueva(producto),
      notas: [textoDeModificadores(modificadores), libre].filter(Boolean).join(' · '),
      _notaUsuario: libre,
      _modificadores: Array.isArray(modificadores) ? (modificadores as readonly unknown[]) : [],
    },
  ];
}

/** La nota final de una línea. Si queda vacía, lo que el mesero había escrito se conserva. */
export function conNotasDeLinea(carrito: Carrito, id: string, notas: string | null): Carrito {
  return carrito.map((linea) =>
    linea.id === id
      ? {
          ...linea,
          notas: textoDe(notas, ''),
          _notaUsuario: primeroConTexto(notas, linea._notaUsuario),
        }
      : linea,
  );
}

export function conExclusionesDeLinea(
  carrito: Carrito,
  id: string,
  exclusiones: readonly string[],
): Carrito {
  return carrito.map((linea) =>
    linea.id === id
      ? { ...linea, _exclusiones: Array.isArray(exclusiones) ? exclusiones : [] }
      : linea,
  );
}

/** Suma o resta a la cantidad del platillo; al llegar a cero la línea sale. */
export function conCantidadCambiada(carrito: Carrito, id: string, delta: number): Carrito {
  if (!carrito.some((linea) => linea.id === id)) return carrito;
  return carrito
    .map((linea) => (linea.id === id ? { ...linea, cantidad: linea.cantidad + delta } : linea))
    .filter((linea) => linea.cantidad > 0);
}

/** Lo que suma el borrador, en CENTAVOS enteros: nunca se multiplican pesos en coma flotante. */
export function totalDelCarritoEnCentavos(carrito: Carrito): number {
  return carrito.reduce(
    (suma, linea) =>
      suma +
      (centavosDe('ProductoTerminado', 'precio_venta', linea.precio_venta) ?? 0) * linea.cantidad,
    0,
  );
}

export function unidadesDelCarrito(carrito: Carrito): number {
  return carrito.reduce((suma, linea) => suma + (linea.cantidad || 0), 0);
}

/**
 * El catálogo que se ve: por categoría y por lo que se teclea en el buscador. Si no hay nada que
 * filtrar devuelve la MISMA lista, para que quien la memoiza no la tome por otra.
 */
export function filtrarPlatillos<P extends ProductoDelMenu>(
  productos: readonly P[],
  categoria: string,
  busqueda: string,
): readonly P[] {
  let lista = productos;
  if (categoria !== 'todas') lista = lista.filter((p) => p.categoria_id === categoria);
  if (busqueda) {
    const q = busqueda.toLowerCase();
    lista = lista.filter((p) => (p.nombre ?? '').toLowerCase().includes(q));
  }
  return lista;
}

interface GrupoDelMenu {
  readonly nombre?: unknown;
  readonly activo?: boolean;
  readonly opciones?: unknown;
}
interface OpcionDelMenu {
  readonly nombre?: unknown;
  readonly activo?: boolean;
}

const tieneNombre = (nombre: unknown): boolean =>
  typeof nombre === 'string' && nombre.trim() !== '';

/** ¿El platillo pide elegir opciones? Un grupo activo con nombre y alguna opción activa con nombre. */
export function productoTieneModificadores(producto: ProductoDelMenu): boolean {
  const grupos: readonly unknown[] = Array.isArray(producto.modificadores)
    ? producto.modificadores
    : [];
  return grupos.some((g) => {
    const grupo = g as GrupoDelMenu | null;
    if (grupo === null || typeof grupo !== 'object') return false;
    if (grupo.activo === false || !tieneNombre(grupo.nombre)) return false;
    const opciones: readonly unknown[] = Array.isArray(grupo.opciones) ? grupo.opciones : [];
    return opciones.some((o) => {
      const opcion = o as OpcionDelMenu | null;
      return opcion !== null && opcion.activo !== false && tieneNombre(opcion.nombre);
    });
  });
}
