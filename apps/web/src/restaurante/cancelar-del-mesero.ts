import { cantidadParaMostrar, esPorPeso, type LineaConPeso } from './peso';

/**
 * LO QUE EL MESERO VE AL CANCELAR, sin pantalla (DP-12.4).
 *
 * El mesero quita un platillo o cancela una cuenta desde SU pantalla, en el diálogo de la mesa
 * ocupada. El servidor decide quién puede (`restaurante.anular_linea` y
 * `restaurante.cancelar_orden`, por rol y por sucursal); aquí se decide qué se ENSEÑA: qué platillos
 * se pueden quitar y qué se le dice antes de quitar algo que la cocina ya preparó.
 */

/** Un renglón de la cuenta tal como lo sirve el puente (`DetalleVenta`). */
export interface DetalleDeLaCuenta extends LineaConPeso {
  readonly id: string;
  readonly producto_nombre: string;
  /** `decimal`: puede llegar como número o como texto (`'2.0000'`). */
  readonly cantidad: number | string;
}

/** Un platillo que se puede quitar, y si la cocina ya lo dejó listo o se entregó. */
export interface PlatilloQuitable {
  readonly detalle: DetalleDeLaCuenta;
  readonly yaSePreparo: boolean;
}

/**
 * Los renglones de la cuenta con su marca de «ya salió de cocina». `yaSalieron` son los NOMBRES
 * de lo que cocina dejó listo o entregado (`nombresQueYaSalieron`): el puente de comandas habla
 * de nombres, no de renglones.
 */
export function platillosQuitables(
  detalles: readonly DetalleDeLaCuenta[],
  yaSalieron: ReadonlySet<string>,
): readonly PlatilloQuitable[] {
  return detalles.map((detalle) => ({
    detalle,
    yaSePreparo: yaSalieron.has(detalle.producto_nombre),
  }));
}

/**
 * «2 × Arrachera» o «Arrachera»: la cantidad sin ceros de relleno. Lo que se vende por peso, con su
 * peso y el formateador único («Barbacoa de horno · ¼ kg», QA2-A1), no «0.25 × Barbacoa».
 */
export function descripcionDelRenglon(detalle: DetalleDeLaCuenta): string {
  if (esPorPeso(detalle)) return `${detalle.producto_nombre} · ${cantidadParaMostrar(detalle)}`;
  const cantidad = Number(detalle.cantidad);
  return Number.isFinite(cantidad) && cantidad !== 1
    ? `${String(cantidad)} × ${detalle.producto_nombre}`
    : detalle.producto_nombre;
}

/**
 * Lo que se le dice al mesero ANTES de cancelar la cuenta entera: si la cocina ya preparó algo,
 * es una pérdida y el corte la va a sacar aparte, con su nombre. Sin nada preparado, no se dice
 * nada: un aviso que siempre sale deja de leerse.
 */
export function avisoDePerdidaAlCancelar(
  detalles: readonly DetalleDeLaCuenta[],
  yaSalieron: ReadonlySet<string>,
): string | null {
  const preparados = [
    ...new Set(
      platillosQuitables(detalles, yaSalieron)
        .filter((p) => p.yaSePreparo)
        .map((p) => p.detalle.producto_nombre),
    ),
  ];
  if (preparados.length === 0) return null;
  return `La cocina ya preparó ${preparados.join(', ')}. Si cancelas, queda como pérdida en el corte, con tu nombre y el motivo.`;
}
