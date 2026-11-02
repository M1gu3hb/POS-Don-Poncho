/**
 * LOS BOTONES SOBRE UNA PÁGINA DEL MENÚ QR, del lado de la pantalla (DP-9.7).
 *
 * El servidor ya mandó sólo lo que se vende (`botonesPublicos`): aquí se coloca cada botón en %
 * de la imagen y se resuelven sus platillos contra el catálogo del portal.
 */

export interface BotonDePagina {
  readonly id: string;
  readonly tipo: 'platillo' | 'grupo';
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
  readonly etiqueta: string | null;
  readonly productoIds: readonly string[];
  readonly mostrarPrecio: boolean;
}

/** Dónde va el botón: en % de la imagen, así que crece y se encoge con ella (y con el zoom). */
export function cajaDelBoton(boton: Pick<BotonDePagina, 'x' | 'y' | 'ancho' | 'alto'>): {
  readonly left: string;
  readonly top: string;
  readonly width: string;
  readonly height: string;
} {
  return {
    left: `${String(boton.x)}%`,
    top: `${String(boton.y)}%`,
    width: `${String(boton.ancho)}%`,
    height: `${String(boton.alto)}%`,
  };
}

/**
 * El alto de UN renglón de la carta, en % de la imagen: el del botón más bajo de la página (los
 * de dos líneas —nombre y detalle— miden más). El precio impreso va en la primera línea.
 */
export function alturaDeUnRenglon(botones: readonly Pick<BotonDePagina, 'alto'>[]): number {
  return botones.length === 0 ? 100 : Math.min(...botones.map((b) => b.alto));
}

/**
 * Qué parte del botón (en %, de arriba abajo) tapa su marca con el precio vigente (DP-12.6).
 *
 * Estaba centrada y de un alto fijo: en un botón de dos líneas se corría hacia el detalle y dejaba
 * ver, arriba, el precio impreso de la carta. Ahora va anclada arriba y mide un renglón —donde está
 * el precio impreso—, o todo el botón si es más bajo que eso.
 */
export function alturaDeLaMarca(boton: Pick<BotonDePagina, 'alto'>, renglon: number): number {
  return Math.min(100, (renglon / boton.alto) * 100);
}

/** Los platillos del botón, en su orden, de los que el portal tiene: nunca uno inventado. */
export function platillosDelBoton<P extends { readonly id: string }>(
  boton: Pick<BotonDePagina, 'productoIds'>,
  productos: readonly P[],
): readonly P[] {
  const porId = new Map(productos.map((p) => [p.id, p]));
  return boton.productoIds.flatMap((id) => {
    const producto = porId.get(id);
    return producto === undefined ? [] : [producto];
  });
}

/** El precio vigente que enseña el botón, en centavos; nulo si no se muestran precios. */
export function precioDelBoton(
  boton: Pick<BotonDePagina, 'mostrarPrecio'>,
  platillo: { readonly precio_venta_centavos?: string | null } | undefined,
  mostrarPrecios: boolean,
): number | null {
  if (!boton.mostrarPrecio || !mostrarPrecios || platillo === undefined) return null;
  const centavos = Number(platillo.precio_venta_centavos ?? 'x');
  return Number.isFinite(centavos) && centavos > 0 ? centavos : null;
}
