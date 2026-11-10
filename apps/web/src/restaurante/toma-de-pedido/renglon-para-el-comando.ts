import {
  opcionesParaElComando,
  type EleccionParaElServidor,
  type ModificadorElegido,
} from '~/venta/opciones-en-pos';

/**
 * DP-16 · EL RENGLÓN DEL CARRITO, COMO LO RECIBE EL SERVIDOR.
 *
 * Lo comparten el pedido del mesero (`restaurante.enviar_pedido`) y el pedido para llevar de la
 * caja (`restaurante.armar_para_llevar`): los dos mandan producto, cantidad en texto decimal,
 * unidad si es por peso, la nota y las opciones ESTRUCTURADAS. Ningún precio viaja: el catálogo
 * lo pone dentro de la transacción.
 */

const VARIABLE_MEDIDA = 'variable_medida';
const PORCION_CONTENEDOR = 'porcion_contenedor';

export interface RenglonDelCarrito {
  readonly id: string;
  readonly nombre?: string;
  readonly cantidad: number;
  readonly notas?: string;
  readonly _modificadores?: readonly ModificadorElegido[];
  readonly _variable?: {
    readonly tipo_venta?: string;
    readonly cantidad_variable?: number | string;
    readonly cantidad_porciones?: number | string;
    readonly unidad_variable?: string;
  } | null;
}

export interface RenglonParaElComando {
  readonly productoId: string;
  readonly cantidad: string;
  readonly notas: string;
  readonly unidad?: string;
  readonly opciones?: readonly EleccionParaElServidor[];
}

/**
 * `orden_lineas.cantidad` es `numeric(14,4)`: viaja como texto porque un float en JSON ya no es el
 * número que se capturó. `null` si no es positiva: la línea no debe salir.
 */
export function cantidadParaComando(valor: unknown): string | null {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return numero.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * Para un producto por peso o por porción la cantidad REAL es la del snapshot (350 g), no el 1
 * lógico con el que el carrito lo agrupa: mandar 1 cobraría un kilo en vez de 350 g.
 */
export function renglonParaElComando(item: RenglonDelCarrito): RenglonParaElComando | null {
  const variable = item._variable ?? null;
  const cruda =
    variable?.tipo_venta === VARIABLE_MEDIDA
      ? variable.cantidad_variable
      : variable?.tipo_venta === PORCION_CONTENEDOR
        ? variable.cantidad_porciones
        : item.cantidad;
  const cantidad = cantidadParaComando(cruda);
  if (cantidad === null) return null;
  const opciones = opcionesParaElComando({ modificadores: item._modificadores });
  return {
    productoId: item.id,
    cantidad,
    // `notas` ya trae las opciones en texto plano, que es lo que la cocina lee.
    notas: item.notas ?? '',
    ...(variable?.tipo_venta === VARIABLE_MEDIDA && variable.unidad_variable
      ? { unidad: variable.unidad_variable }
      : {}),
    ...(opciones.length > 0 ? { opciones } : {}),
  };
}
