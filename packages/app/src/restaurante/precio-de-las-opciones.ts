import { ErrorDominio } from '@morphiqpos/contracts';
import { centavos, porCantidad, type Centavos } from '@morphiqpos/domain/dinero';
import type { PrecioLinea } from '@morphiqpos/domain/catalogo';

/**
 * DP-16 · LO QUE CUESTAN LAS OPCIONES, sumado al renglón por el SERVIDOR.
 *
 * Cada opción de un grupo puede subir o bajar el precio (`modificador_opciones.delta_precio_centavos`,
 * firmado: «sin crema» abarata). El precio nunca lo manda la pantalla: sale del catálogo dentro de la
 * transacción, como el del platillo.
 *
 * ── Por unidad o por renglón ───────────────────────────────────────────────
 * En una pieza (un taco, un refresco) la opción va por UNIDAD: dos tacos con queso extra pagan dos
 * veces el queso, y por eso sube el precio unitario. En lo que se vende por peso o por porción (la
 * barbacoa por kilo, el consomé por porción) va por RENGLÓN: medio kilo con tortillas de harina
 * paga las tortillas una vez, no «por kilo». El precio por kilo no cambia.
 *
 * Como el total de la orden se recalcula sobre `subtotal_centavos` de cada línea (`cotizar`),
 * descuentos, propina, dividir, quitar, cancelar, el margen y el corte usan este precio sin
 * cambiar nada más.
 *
 * DP-18 · M6 (revisa DP-D104): una opción que resta y deja el renglón en $0 o menos se RECHAZA
 * (`OPCION_DEJA_SIN_PRECIO`); antes lo dejaba en $0 sin decir nada y un error de captura regalaba el
 * platillo. El editor y el servidor ya lo impiden al guardar el grupo; esto cubre el platillo cuyo
 * precio bajó después.
 */

const POR_RENGLON: ReadonlySet<string> = new Set(['variable_medida', 'porcion_contenedor']);

export interface OpcionConPrecio {
  readonly deltaCentavos: bigint;
}

export function sumaDeLasOpciones(elegidas: readonly OpcionConPrecio[]): bigint {
  return elegidas.reduce((suma, o) => suma + o.deltaCentavos, 0n);
}

/** Lo que queda tras las opciones: si una que resta lo deja en $0 o menos, no se vende así. */
function conPiso(valor: bigint, delta: bigint, nombre: string | undefined): Centavos {
  if (delta < 0n && valor <= 0n) {
    throw new ErrorDominio(
      'OPCION_DEJA_SIN_PRECIO',
      `Con esas opciones${nombre === undefined ? ' el platillo' : ` «${nombre}»`} quedaría en $0 o menos: pide que revisen sus opciones.`,
    );
  }
  return centavos(valor < 0n ? 0n : valor);
}

export function precioConLasOpciones(
  tipoVenta: string,
  cantidad: string,
  precio: PrecioLinea,
  elegidas: readonly OpcionConPrecio[],
  nombre?: string,
): PrecioLinea {
  const delta = sumaDeLasOpciones(elegidas);
  if (delta === 0n) return precio;
  if (POR_RENGLON.has(tipoVenta)) {
    return { ...precio, subtotalCentavos: conPiso(precio.subtotalCentavos + delta, delta, nombre) };
  }
  const unitario = conPiso(precio.precioUnitarioCentavos + delta, delta, nombre);
  return {
    ...precio,
    precioUnitarioCentavos: unitario,
    subtotalCentavos: conPiso(porCantidad(unitario, cantidad), delta, nombre),
  };
}

/** La línea del pedido con el precio de sus opciones ya sumado, y las opciones colgadas. */
export function lineaConLasOpciones<
  L extends {
    readonly producto: { readonly tipoVenta: string; readonly nombre?: string };
    readonly valorada: { readonly cantidad: string; readonly precio: PrecioLinea };
  },
  O extends OpcionConPrecio,
>(linea: L, elegidas: readonly O[]): L & { readonly opciones: readonly O[] } {
  return {
    ...linea,
    valorada: {
      ...linea.valorada,
      precio: precioConLasOpciones(
        linea.producto.tipoVenta,
        linea.valorada.cantidad,
        linea.valorada.precio,
        elegidas,
        linea.producto.nombre,
      ),
    },
    opciones: elegidas,
  };
}

/** «$1,234.50», sin depender del idioma del servidor. */
function pesos(absoluto: bigint): string {
  const entero = (absoluto / 100n).toString();
  const conComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${conComas}.${(absoluto % 100n).toString().padStart(2, '0')}`;
}

/** «Flor de calabaza (+$15.00)», «Sin crema (−$5.00)» o el nombre solo si no cambia el precio. */
export function opcionConSuPrecio(nombre: string, deltaCentavos: bigint): string {
  if (deltaCentavos === 0n) return nombre;
  const signo = deltaCentavos > 0n ? '+' : '−';
  const absoluto = deltaCentavos > 0n ? deltaCentavos : -deltaCentavos;
  return `${nombre} (${signo}${pesos(absoluto)})`;
}
