import { esFondoDeTarjeta, FONDO_DE_OMISION, type FondoDeTarjeta } from '@morphiqpos/contracts';

/**
 * DP-16 · EL MENÚ DIGITAL DEL COMENSAL, sin pantalla.
 *
 * El menú se lee por secciones —una por categoría, en el orden que el negocio les dio—, con una
 * tarjeta por platillo: con foto, la foto entera con su nombre y precio encima; sin foto, el fondo
 * que el dueño eligió en Productos (o el de omisión). Aquí sólo se decide QUÉ se enseña; el precio
 * que cuenta lo pone el servidor.
 */

export interface ProductoDelMenu {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion?: string | null;
  readonly imagen_url?: string | null;
  readonly categoria_id?: string | null;
  readonly precio_venta?: number | null;
  readonly tipo_venta?: string | null;
  readonly unidad_variable?: string | null;
  readonly precio_por_unidad_variable?: number | null;
  readonly nombre_porcion?: string | null;
  readonly precio_por_porcion?: number | null;
  readonly agotado?: boolean;
  readonly fondo_tarjeta?: string | null;
}

export interface CategoriaDelMenu {
  readonly id: string;
  readonly nombre?: string | null;
}

export interface SeccionDelMenu<P extends ProductoDelMenu> {
  readonly id: string;
  readonly nombre: string;
  readonly productos: readonly P[];
}

export const SECCION_SIN_CATEGORIA = 'sin-categoria';

/**
 * Una sección por categoría, en el orden de las categorías; las vacías no salen. Lo que no tiene
 * categoría (o la tiene apagada) va al final en «Más», para que nada se pierda.
 */
export function seccionesDelMenu<P extends ProductoDelMenu>(
  productos: readonly P[],
  categorias: readonly CategoriaDelMenu[],
): readonly SeccionDelMenu<P>[] {
  const conocidas = new Set(categorias.map((c) => c.id));
  const secciones = categorias
    .map((c) => ({
      id: c.id,
      nombre: (c.nombre ?? '').trim() || 'Sin nombre',
      productos: productos.filter((p) => p.categoria_id === c.id),
    }))
    .filter((s) => s.productos.length > 0);
  const sueltos = productos.filter(
    (p) =>
      p.categoria_id === null || p.categoria_id === undefined || !conocidas.has(p.categoria_id),
  );
  return sueltos.length === 0
    ? secciones
    : [...secciones, { id: SECCION_SIN_CATEGORIA, nombre: 'Más', productos: sueltos }];
}

/** El fondo de la tarjeta sin foto: el elegido si es de la lista cerrada; si no, el de omisión. */
export function fondoDeLaTarjeta(producto: ProductoDelMenu): FondoDeTarjeta {
  return esFondoDeTarjeta(producto.fondo_tarjeta) ? producto.fondo_tarjeta : FONDO_DE_OMISION;
}

const PESOS = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** El texto, o el de reserva si viene vacío. */
const oEl = (texto: string | null | undefined, reserva: string): string =>
  texto !== null && texto !== undefined && texto.trim() !== '' ? texto : reserva;

/**
 * El precio que se enseña en la tarjeta, o `null` si no hay que enseñar ninguno (el negocio los
 * esconde o el platillo no tiene). Lo que va por peso dice «$795.00 / kg».
 */
export function precioDeLaTarjeta(
  producto: ProductoDelMenu,
  mostrarPrecios: boolean,
): string | null {
  if (!mostrarPrecios) return null;
  if (producto.tipo_venta === 'variable_medida') {
    const precio = Number(producto.precio_por_unidad_variable);
    return precio > 0 ? `${PESOS.format(precio)} / ${oEl(producto.unidad_variable, 'kg')}` : null;
  }
  if (producto.tipo_venta === 'porcion_contenedor') {
    const precio = Number(producto.precio_por_porcion);
    return precio > 0
      ? `${PESOS.format(precio)} / ${oEl(producto.nombre_porcion, 'porción')}`
      : null;
  }
  const precio = Number(producto.precio_venta);
  return precio > 0 ? PESOS.format(precio) : null;
}

/**
 * La sección que se está leyendo: la última cuyo encabezado ya pasó bajo la barra de
 * categorías (`margen`). Antes de la primera, la primera.
 */
export function seccionALaVista(
  posiciones: readonly { readonly id: string; readonly arriba: number }[],
  margen: number,
): string | null {
  let actual: string | null = posiciones[0]?.id ?? null;
  for (const p of posiciones) {
    if (p.arriba - margen <= 1) actual = p.id;
  }
  return actual;
}
