import { notaSinLasOpciones, renglonesDeLasOpciones } from '../venta/opciones-del-renglon.ts';

/**
 * DP-25 · Parte 3 · 3.1 y 3.2 · EL ESTADO DE CADA PLATILLO y SUS OPCIONES, dentro de la mesa.
 *
 * El mesero ve, en la lista de lo enviado, en qué va cada platillo: Nuevo, En preparación, Listo
 * o Entregado. El estado sale del item de la comanda (la cocina lo mueve por platillo) y se
 * empareja con la línea de la cuenta por `detalle_venta_id`. Si una línea tiene varios items,
 * manda el MENOS avanzado: el platillo no está completo hasta que lo está el último.
 *
 * Cada estado lleva su glifo y su palabra: el color nunca va solo.
 */

export type EstadoDelPlatillo = 'nuevo' | 'en_preparacion' | 'listo' | 'entregado';

export interface EstadoDelPlatilloEnPalabras {
  readonly estado: EstadoDelPlatillo;
  readonly etiqueta: string;
  readonly glifo: string;
  readonly explicacion: string;
}

const PLATILLO_NUEVO: EstadoDelPlatilloEnPalabras = {
  estado: 'nuevo',
  etiqueta: 'Nuevo',
  glifo: '○',
  explicacion: 'Ya se mandó; la estación todavía no lo empieza.',
};

export const ESTADOS_DEL_PLATILLO: readonly EstadoDelPlatilloEnPalabras[] = [
  PLATILLO_NUEVO,
  {
    estado: 'en_preparacion',
    etiqueta: 'En preparación',
    glifo: '◔',
    explicacion: 'La estación lo está preparando.',
  },
  {
    estado: 'listo',
    etiqueta: 'Listo',
    glifo: '✓',
    explicacion: 'Ya salió: hay que recogerlo en la ventana.',
  },
  {
    estado: 'entregado',
    etiqueta: 'Entregado',
    glifo: '✓✓',
    explicacion: 'Ya está en la mesa.',
  },
];

const RANGO: Readonly<Record<EstadoDelPlatillo, number>> = {
  nuevo: 0,
  en_preparacion: 1,
  listo: 2,
  entregado: 3,
};

export interface ItemParaElEstado {
  readonly detalle_venta_id?: string | null;
  readonly estado?: string | null;
}

export interface ComandaParaElEstado {
  readonly estado: string;
  readonly items?: readonly ItemParaElEstado[] | null;
}

/** El estado del platillo que corresponde a un estado de item (o de línea); `null` si se anuló. */
export function estadoDelPlatillo(estado: string | null | undefined): EstadoDelPlatillo | null {
  switch (estado) {
    case 'en_preparacion':
    case 'listo':
    case 'entregado':
      return estado;
    case 'cancelado':
      return null;
    default:
      return 'nuevo';
  }
}

/** El estado de cada línea de la cuenta, por el id de la línea, según las comandas leídas. */
export function estadosPorLinea(
  comandas: readonly ComandaParaElEstado[],
): ReadonlyMap<string, EstadoDelPlatillo> {
  const mapa = new Map<string, EstadoDelPlatillo>();
  for (const comanda of comandas) {
    if (comanda.estado === 'cancelado') continue;
    for (const item of comanda.items ?? []) {
      const linea = item.detalle_venta_id;
      if (linea === undefined || linea === null) continue;
      const estado = estadoDelPlatillo(item.estado ?? comanda.estado);
      if (estado === null) continue;
      const previo = mapa.get(linea);
      if (previo === undefined || RANGO[estado] < RANGO[previo]) mapa.set(linea, estado);
    }
  }
  return mapa;
}

export interface LineaParaElEstado {
  readonly id?: string | null;
  readonly estado_preparacion?: string | null;
}

/**
 * El estado de una línea: el de su item de comanda; sin él, el que trae la propia línea; y sin
 * ninguno, «nuevo» (lo recién mandado todavía no tiene su comanda leída).
 */
export function estadoDeLaLinea(
  linea: LineaParaElEstado,
  porLinea: ReadonlyMap<string, EstadoDelPlatillo>,
): EstadoDelPlatillo {
  const delItem = linea.id === undefined || linea.id === null ? undefined : porLinea.get(linea.id);
  if (delItem !== undefined) return delItem;
  return estadoDelPlatillo(linea.estado_preparacion) ?? 'nuevo';
}

export function datosDelEstado(estado: EstadoDelPlatillo): EstadoDelPlatilloEnPalabras {
  return ESTADOS_DEL_PLATILLO.find((e) => e.estado === estado) ?? PLATILLO_NUEVO;
}

export interface LineaConOpciones {
  readonly opciones_snapshot?: unknown;
  readonly opciones_texto?: unknown;
  readonly notas_producto?: unknown;
}

const SEPARADOR = ' · ';

/**
 * Lo que el mesero lee bajo el platillo, igual que en cocina, Caja y ticket: las opciones (con su
 * grupo) y, aparte, la nota escrita a mano. Sin instantánea cae al texto plano de las opciones.
 */
export function renglonesDelPlatillo(linea: LineaConOpciones): {
  readonly opciones: readonly string[];
  readonly nota: string;
} {
  const opciones =
    linea.opciones_snapshot !== undefined && linea.opciones_snapshot !== null
      ? renglonesDeLasOpciones(linea.opciones_snapshot)
      : (typeof linea.opciones_texto === 'string' ? linea.opciones_texto : '')
          .split(SEPARADOR)
          .map((t) => t.trim())
          .filter(Boolean);
  return { opciones, nota: notaSinLasOpciones(linea.notas_producto, linea.opciones_snapshot) };
}
