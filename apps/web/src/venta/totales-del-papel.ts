/**
 * LO QUE DICE EL PAPEL, Y QUE SUME (DP-14 · ronda 2, bloqueante 1).
 *
 * El ticket (la precuenta, el final, la reimpresión, el de `/pos` y el de cada parte de una cuenta
 * dividida: todos son `PreCuentaTicket`) calculaba TOTAL = suma de los renglones + propina, sobre el
 * subtotal BRUTO. Con un descuento, el papel decía más de lo que se cobró: $500 con $50 de descuento
 * imprimía 500 y se cobraban 450. El cobro de la Caja tenía el mismo hueco en su «Subtotal».
 *
 * Ahora el papel dice: los renglones, el descuento, el IVA y el TOTAL del SERVIDOR (`venta.total`,
 * la venta real sin propina: `domain/venta/totales.ts`), y suma: renglones − descuento (+ IVA si no
 * va incluido en el precio) = TOTAL. Si el total del servidor aún no llegó (el respaldo de HOTFIX 6A:
 * la venta leída con total 0 y renglones), se calcula igual, restando el descuento.
 *
 * Los importes llegan en pesos (el puente los traduce de centavos) y se redondean al centavo.
 */

export interface VentaDelPapel {
  readonly total?: number | string | null | undefined;
  readonly subtotal?: number | string | null | undefined;
  readonly descuentos?: number | string | null | undefined;
  readonly impuestos?: number | string | null | undefined;
}

export interface RenglonDelPapel {
  readonly subtotal?: number | string | null | undefined;
  readonly precio_unitario_snapshot?: number | string | null | undefined;
  readonly cantidad?: number | string | null | undefined;
}

export interface TotalesDelPapel {
  /** La suma de los renglones (el subtotal bruto). */
  readonly renglones: number;
  readonly descuento: number;
  readonly iva: number;
  /** `true` si el IVA se suma al total; `false` si va incluido en el precio (sólo se informa). */
  readonly ivaSeSuma: boolean;
  /** Lo cobrado SIN propina: el total del servidor. */
  readonly total: number;
}

const numero = (valor: number | string | null | undefined): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};
const alCentavo = (valor: number): number => Math.round(valor * 100) / 100;

function sumaDeLosRenglones(renglones: readonly RenglonDelPapel[]): number {
  return renglones.reduce((suma, r) => {
    if (r.subtotal !== undefined && r.subtotal !== null) return suma + numero(r.subtotal);
    return suma + numero(r.precio_unitario_snapshot) * numero(r.cantidad);
  }, 0);
}

export function totalesDelPapel(
  venta: VentaDelPapel | null | undefined,
  renglones: readonly RenglonDelPapel[] | null | undefined,
): TotalesDelPapel {
  const leidos = alCentavo(sumaDeLosRenglones(renglones ?? []));
  const bruto = leidos > 0 ? leidos : alCentavo(numero(venta?.subtotal));
  const descuento = alCentavo(Math.max(0, numero(venta?.descuentos)));
  const iva = alCentavo(Math.max(0, numero(venta?.impuestos)));
  const base = alCentavo(bruto - descuento);
  const delServidor = alCentavo(numero(venta?.total));
  if (delServidor <= 0) {
    return { renglones: bruto, descuento, iva, ivaSeSuma: false, total: Math.max(0, base) };
  }
  // El servidor suma el IVA al total sólo si no va incluido en el precio: lo que esté más cerca.
  const ivaSeSuma = iva > 0 && Math.abs(delServidor - (base + iva)) < Math.abs(delServidor - base);
  return { renglones: bruto, descuento, iva, ivaSeSuma, total: delServidor };
}
