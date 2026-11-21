/**
 * DP-25 · CADA PAGO POR SEPARADO (lo que DP-24 no cumplió del 1.4).
 *
 * Una venta cobrada con tres tarjetas y efectivo salía en el corte y en Registros como «Mixto» con un
 * total por método. Quien cuadra la caja necesita ver cada pago: «Tarjeta 1», «Tarjeta 2» y
 * «Efectivo» (con lo recibido y el cambio), y la propina de cada uno. Esto sólo ARMA los renglones a
 * partir de las filas de `pagos` que entrega el puente (`PagoDeVenta`, en pesos): el dinero no se
 * recalcula, se lee. Los totales por método siguen donde estaban.
 *
 * Reglas:
 *   · El orden es el del cobro (`created_date`). Cada pago guarda la hora exacta de su registro y el
 *     servidor los entrega ordenados por ella; aquí la hora llega a la milésima, así que a la misma
 *     milésima se respeta el orden en que llegaron (el orden de `sort` es estable).
 *   · Varios pagos del mismo método se numeran («Tarjeta 1», «Tarjeta 2»); uno solo, sin número.
 *   · Lo recibido y el cambio son del efectivo: una tarjeta o una transferencia no los lleva.
 *   · Un pago devuelto (`reembolsado`) se dice.
 */

export interface PagoLeido {
  readonly id: string;
  readonly venta_id: string;
  readonly metodo: string;
  readonly monto: number;
  readonly propina: number;
  readonly recibido: number | null;
  readonly cambio: number;
  readonly estado: string;
  readonly created_date: string;
}

export interface RenglonDePago {
  readonly id: string;
  readonly rotulo: string;
  readonly metodo: string;
  readonly monto: number;
  readonly propina: number;
  /** Sólo el efectivo; `null` en lo demás. */
  readonly recibido: number | null;
  /** Sólo el efectivo; `0` en lo demás. */
  readonly cambio: number;
  readonly devuelto: boolean;
}

const NOMBRES: Readonly<Record<string, string>> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

function nombreDelMetodo(metodo: string): string {
  const conocido = NOMBRES[metodo];
  if (conocido !== undefined) return conocido;
  const limpio = metodo.trim().replace(/_/g, ' ');
  return limpio === '' ? 'Pago' : `${limpio.charAt(0).toUpperCase()}${limpio.slice(1)}`;
}

function enOrdenDeCobro(pagos: readonly PagoLeido[]): PagoLeido[] {
  return [...pagos].sort((a, b) => {
    const porHora = Date.parse(a.created_date) - Date.parse(b.created_date);
    return Number.isFinite(porHora) ? porHora : 0;
  });
}

/** Los renglones de UNA venta, en el orden en que se cobró. */
export function renglonesDePagos(pagos: readonly PagoLeido[]): RenglonDePago[] {
  const ordenados = enOrdenDeCobro(pagos);
  const cuantos = new Map<string, number>();
  for (const p of ordenados) cuantos.set(p.metodo, (cuantos.get(p.metodo) ?? 0) + 1);
  const vistos = new Map<string, number>();
  return ordenados.map((p) => {
    const numero = (vistos.get(p.metodo) ?? 0) + 1;
    vistos.set(p.metodo, numero);
    const nombre = nombreDelMetodo(p.metodo);
    const esEfectivo = p.metodo === 'efectivo';
    return {
      id: p.id,
      rotulo: (cuantos.get(p.metodo) ?? 0) > 1 ? `${nombre} ${String(numero)}` : nombre,
      metodo: p.metodo,
      monto: p.monto,
      propina: p.propina,
      recibido: esEfectivo ? p.recibido : null,
      cambio: esEfectivo ? p.cambio : 0,
      devuelto: p.estado === 'reembolsado',
    };
  });
}

/** Los pagos del turno, por venta (en el orden de la primera vez que aparece cada una). */
export function pagosPorVenta(pagos: readonly PagoLeido[]): Map<string, RenglonDePago[]> {
  const porVenta = new Map<string, PagoLeido[]>();
  for (const p of enOrdenDeCobro(pagos)) {
    const lista = porVenta.get(p.venta_id) ?? [];
    lista.push(p);
    porVenta.set(p.venta_id, lista);
  }
  const salida = new Map<string, RenglonDePago[]>();
  for (const [ventaId, lista] of porVenta) salida.set(ventaId, renglonesDePagos(lista));
  return salida;
}
