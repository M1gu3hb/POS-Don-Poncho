import { centavosDe } from '../cliente/dinero-del-puente.ts';

/**
 * LAS CIFRAS DEL DÍA DEL TABLERO · el cálculo, sacado del JSX (DP-11.4).
 *
 * Vivía dentro de `heredado/pages/Dashboard.jsx` como un `useMemo` de 60 líneas, sumando PESOS
 * en coma flotante: el tablero era la única pantalla de dinero sin una sola prueba. Aquí es una
 * función pura, en CENTAVOS (la regla del dinero del proyecto: nada de sumar coma flotante), y
 * con su prueba. El puente sirve los importes de `Venta` y `GastoOperativo` en pesos; cada uno
 * pasa por `centavosDe`, el único camino de pesos a centavos.
 *
 * Lo que cuenta como «del día» es lo MISMO que antes, sin cambiar un criterio:
 *   · sin caja abierta, todo en cero;
 *   · una venta es de esta caja si está atada a su corte (`corte_caja_id`) o, sin corte, si se
 *     cerró desde la apertura;
 *   · un gasto es de esta caja si se creó desde la apertura.
 */

/** Lo que el tablero lee de una venta pagada. Los importes llegan en PESOS, como los sirve el puente. */
export interface VentaDelTablero {
  readonly total?: unknown;
  readonly costo_total_snapshot?: unknown;
  readonly monto_efectivo?: unknown;
  readonly monto_tarjeta?: unknown;
  readonly monto_transferencia?: unknown;
  readonly corte_caja_id?: string | null;
  readonly fecha_cierre?: string | null;
}

/** Lo que el tablero lee de un gasto operativo. */
export interface GastoDelTablero {
  readonly monto?: unknown;
  readonly created_date?: string | null;
}

/** La caja abierta: su id y, para saber desde cuándo cuenta el día, hasta dos fechas posibles. */
export interface CajaParaLasCifras {
  readonly id?: string;
  readonly fecha_apertura?: string | null;
  readonly created_date?: string | null;
}

export interface CifrasDelDia {
  readonly ventasCentavos: number;
  readonly costoCentavos: number;
  readonly utilidadBrutaCentavos: number;
  /** La utilidad bruta sobre las ventas, en por ciento (42.5 es «42.5 %»). */
  readonly margen: number;
  readonly efectivoCentavos: number;
  readonly tarjetaCentavos: number;
  readonly transferenciaCentavos: number;
  readonly gastosCentavos: number;
  readonly ticketPromedioCentavos: number;
  readonly tickets: number;
  readonly utilidadNetaCentavos: number;
}

/** Las cifras de un día sin caja abierta. */
export const CIFRAS_EN_CERO: CifrasDelDia = {
  ventasCentavos: 0,
  costoCentavos: 0,
  utilidadBrutaCentavos: 0,
  margen: 0,
  efectivoCentavos: 0,
  tarjetaCentavos: 0,
  transferenciaCentavos: 0,
  gastosCentavos: 0,
  ticketPromedioCentavos: 0,
  tickets: 0,
  utilidadNetaCentavos: 0,
};

type Lista<T> = readonly (T | null | undefined)[] | null | undefined;

function esLista<T>(valor: Lista<T>): valor is readonly (T | null | undefined)[] {
  return Array.isArray(valor);
}

/** Lo que no es una lista (la lectura aún no llegó, o llegó rota) cuenta como lista vacía. */
function filasDe<T>(lista: Lista<T>): readonly (T | null | undefined)[] {
  return esLista(lista) ? lista : [];
}

/**
 * El instante de la apertura, en milisegundos; 0 si la caja no trae ninguna fecha.
 *
 * Es la primera fecha que NO esté vacía: `fecha_apertura` y, si falta, `created_date`. Una
 * cadena vacía no cuenta (por eso no se usa `??`). El tablero de antes probaba además
 * `fecha_inicio`, pero el puente descarta ese campo de `CorteCaja` —`pnpm verify:lecturas`—:
 * nunca llegaba, y quitarlo no cambia ninguna cifra.
 */
function aperturaEnMilisegundos(caja: CajaParaLasCifras): number {
  const fechas = [caja.fecha_apertura, caja.created_date];
  const iso = fechas.find((fecha) => typeof fecha === 'string' && fecha !== '');
  return iso ? new Date(iso).getTime() : 0;
}

function esDeLaCaja(
  venta: VentaDelTablero | null | undefined,
  caja: CajaParaLasCifras,
  apertura: number,
): venta is VentaDelTablero {
  if (!venta) return false;
  if (venta.corte_caja_id && venta.corte_caja_id === caja.id) return true;
  if (!venta.corte_caja_id && venta.fecha_cierre) {
    const instante = new Date(venta.fecha_cierre).getTime();
    return Number.isFinite(instante) && instante >= apertura;
  }
  return false;
}

function esGastoDeLaCaja(
  gasto: GastoDelTablero | null | undefined,
  apertura: number,
): gasto is GastoDelTablero {
  if (!gasto) return false;
  const creado = gasto.created_date ? new Date(gasto.created_date).getTime() : 0;
  return creado >= apertura;
}

export function cifrasDelDia({
  ventas,
  gastos,
  cajaAbierta,
}: {
  readonly ventas: Lista<VentaDelTablero>;
  readonly gastos: Lista<GastoDelTablero>;
  readonly cajaAbierta: CajaParaLasCifras | null | undefined;
}): CifrasDelDia {
  if (!cajaAbierta) return CIFRAS_EN_CERO;

  const apertura = aperturaEnMilisegundos(cajaAbierta);
  const ventasCaja = filasDe(ventas).filter((v): v is VentaDelTablero =>
    esDeLaCaja(v, cajaAbierta, apertura),
  );
  const gastosCaja = filasDe(gastos).filter((g): g is GastoDelTablero =>
    esGastoDeLaCaja(g, apertura),
  );

  const sumar = (importes: readonly number[]): number =>
    importes.reduce((suma, centavos) => suma + centavos, 0);

  const ventasCentavos = sumar(ventasCaja.map((v) => centavosDe('Venta', 'total', v.total) ?? 0));
  const costoCentavos = sumar(
    ventasCaja.map((v) => centavosDe('Venta', 'costo_total_snapshot', v.costo_total_snapshot) ?? 0),
  );
  const efectivoCentavos = sumar(
    ventasCaja.map((v) => centavosDe('Venta', 'monto_efectivo', v.monto_efectivo) ?? 0),
  );
  const tarjetaCentavos = sumar(
    ventasCaja.map((v) => centavosDe('Venta', 'monto_tarjeta', v.monto_tarjeta) ?? 0),
  );
  const transferenciaCentavos = sumar(
    ventasCaja.map((v) => centavosDe('Venta', 'monto_transferencia', v.monto_transferencia) ?? 0),
  );
  const gastosCentavos = sumar(
    gastosCaja.map((g) => centavosDe('GastoOperativo', 'monto', g.monto) ?? 0),
  );

  const utilidadBrutaCentavos = ventasCentavos - costoCentavos;
  const tickets = ventasCaja.length;

  return {
    ventasCentavos,
    costoCentavos,
    utilidadBrutaCentavos,
    margen: ventasCentavos > 0 ? (utilidadBrutaCentavos / ventasCentavos) * 100 : 0,
    efectivoCentavos,
    tarjetaCentavos,
    transferenciaCentavos,
    gastosCentavos,
    ticketPromedioCentavos: tickets > 0 ? Math.round(ventasCentavos / tickets) : 0,
    tickets,
    utilidadNetaCentavos: utilidadBrutaCentavos - gastosCentavos,
  };
}

export type ClaveDeMetodo = 'efectivo' | 'tarjeta' | 'transferencia';

export interface MetodoConVentas {
  readonly clave: ClaveDeMetodo;
  readonly etiqueta: string;
  readonly centavos: number;
}

/**
 * Los métodos de pago que cobraron algo, en el orden efectivo, tarjeta, transferencia.
 *
 * Son las porciones de la dona. El orden importa: la dona pinta cada porción con el color
 * de su posición, y las cifras de cada método usan el mismo orden para llevar su mismo color.
 */
export function metodosConVentas(cifras: CifrasDelDia): readonly MetodoConVentas[] {
  const todos: readonly MetodoConVentas[] = [
    { clave: 'efectivo', etiqueta: 'Efectivo', centavos: cifras.efectivoCentavos },
    { clave: 'tarjeta', etiqueta: 'Tarjeta', centavos: cifras.tarjetaCentavos },
    { clave: 'transferencia', etiqueta: 'Transferencia', centavos: cifras.transferenciaCentavos },
  ];
  return todos.filter((metodo) => metodo.centavos > 0);
}
