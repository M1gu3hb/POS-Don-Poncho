/**
 * DP-22 · «LO MÁS VENDIDO» EN EL NAVEGADOR. Puro.
 *
 * Lo que llega de `registros.lo_mas_vendido` (el servidor ya sumó el periodo entero, en centavos
 * enteros, sin tope de filas) se vuelve lo que la tarjeta pinta. Aquí no se suma dinero: sólo se dice
 * en palabras (pesos, piezas o kilos) y se arma la petición con los mismos días que el resumen.
 */

export interface PlatilloVendido {
  readonly nombre: string;
  readonly categoria: string | null;
  readonly lineas: number;
  readonly unidad: string;
  readonly cantidad: string;
  readonly importeCentavos: string;
  readonly devueltoCantidad: string;
  readonly devueltoCentavos: string;
  readonly cantidadNeta: string;
  readonly netoCentavos: string;
}

export interface MeseroVendedor {
  readonly nombre: string | null;
  readonly cuentas: number;
  readonly ventaCentavos: string;
  readonly propinaCentavos: string;
}

export interface LoMasVendidoDelServidor {
  readonly desde: string;
  readonly hasta: string;
  readonly platillos: readonly PlatilloVendido[];
  readonly vendidoCentavos: string;
  readonly devueltoCentavos: string;
  readonly netoCentavos: string;
  readonly cuentas: {
    readonly cantidad: number;
    readonly ventasCentavos: string;
    readonly ajusteCentavos: string;
  };
  readonly meseros: readonly MeseroVendedor[];
}

const CENTAVOS_POR_PESO = 100;
const PESOS = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Centavos enteros (texto del servidor) a «$1,234.50». */
export function pesosDe(centavos: string): string {
  return PESOS.format(Number(centavos) / CENTAVOS_POR_PESO);
}

/** «16 pzas», «1 pza», «1.25 kg»: lo que se vende por peso se dice en kilos. */
export function cantidadConUnidad(cantidad: string, unidad: string): string {
  const etiqueta = unidad === 'pza' ? (cantidad === '1' ? 'pza' : 'pzas') : unidad;
  return `${cantidad} ${etiqueta}`;
}

/** «Ana, 5 cuentas» / «1 cuenta». */
export function cuentasDichas(cuentas: number): string {
  return `${String(cuentas)} ${cuentas === 1 ? 'cuenta' : 'cuentas'}`;
}

/** Cuántos platillos se enseñan antes de «Ver todos»; el servidor manda todos, sin tope. */
export const PLATILLOS_VISIBLES = 10;

export function losVisibles<T>(filas: readonly T[], verTodos: boolean): readonly T[] {
  return verTodos ? filas : filas.slice(0, PLATILLOS_VISIBLES);
}

/** ¿Se devolvió algo en el periodo? (Si no, la columna de devueltos sobra.) */
export function hayDevoluciones(datos: LoMasVendidoDelServidor): boolean {
  return datos.platillos.some((p) => p.devueltoCentavos !== '0');
}
