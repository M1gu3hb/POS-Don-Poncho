/**
 * EL MARGEN DE UNA VENTA SE CALCULA O ES DESCONOCIDO. Nunca «100 %» (DP-12.6).
 *
 * ── El defecto que esto cierra ───────────────────────────────────────────────────────────
 * Al cobrar, el servidor guarda `costo_total_snapshot`, `utilidad_bruta_snapshot` y
 * `margen_snapshot` de la cuenta. Un platillo SIN receta cuesta cero en esa foto
 * (`productos.costo_unitario_centavos` es `not null default 0`), así que una cuenta sin receta
 * salía «costo $0.00 · utilidad = total · 100 % margen»: la cifra más bonita que puede ver un
 * dueño y la única que seguro es falsa. Es el mismo error que ya se cerró en la ficha de
 * Productos (`inventario/costo-del-platillo.ts`) y aquí vuelve por el lado de las ventas.
 *
 * ── La regla ──────────────────────────────────────────────────────────────────────────────
 * Una venta con importe y costo cero (o sin costo) tiene el costo DESCONOCIDO: «sin receta». Su
 * costo, su utilidad y su margen se escriben «—, sin receta». Quien no ve costos (el campo ni
 * llega) no ve nada de eso, y tampoco se le inventa un «sin receta». En un periodo, el margen es
 * el de las ventas con costo, y se dice cuántas quedaron fuera.
 *
 * Todo en pesos (como las sirve el puente) y sin pantalla, para probarlo: las heredadas no
 * tienen pruebas propias.
 */

import { costoDeLaVentaEsDesconocido } from '@morphiqpos/domain/venta';

/** Lo que se escribe donde iría el costo, la utilidad o el margen de una venta sin receta. */
export const SIN_RECETA = '—, sin receta';

/** Lo que se necesita de una venta, en pesos. El costo ausente es «no lo ve»; nulo, «no hay». */
export interface VentaParaElMargen {
  readonly total?: number | null | undefined;
  readonly costo_total_snapshot?: number | null | undefined;
  readonly utilidad_bruta_snapshot?: number | null | undefined;
  /** Porcentaje (60 = 60 %). */
  readonly margen_snapshot?: number | null | undefined;
}

export type EstadoDelMargen = 'conocido' | 'sin_receta' | 'oculto';

export interface EconomiaDeLaVenta {
  readonly estado: EstadoDelMargen;
  readonly costo: number | null;
  readonly utilidad: number | null;
  readonly margen: number | null;
}

const CENTAVOS_POR_PESO = 100;
const PORCIENTO = 100;

const esNumero = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isFinite(valor);

const aCentavos = (pesos: number): number => Math.round(pesos * CENTAVOS_POR_PESO);
const aPesos = (centavos: number): number => centavos / CENTAVOS_POR_PESO;

const DESCONOCIDA: Omit<EconomiaDeLaVenta, 'estado'> = {
  costo: null,
  utilidad: null,
  margen: null,
};

/** Costo, utilidad y margen de UNA venta, o por qué no se pueden dar. */
export function economiaDeLaVenta(venta: VentaParaElMargen): EconomiaDeLaVenta {
  const costo = venta.costo_total_snapshot;
  if (costo === undefined) return { estado: 'oculto', ...DESCONOCIDA };

  const total = esNumero(venta.total) ? venta.total : 0;
  const costoConocido = esNumero(costo) ? costo : 0;
  // La regla es del dominio: el exporte del servidor usa la misma.
  if (costoDeLaVentaEsDesconocido(total, costo)) return { estado: 'sin_receta', ...DESCONOCIDA };

  const utilidad = esNumero(venta.utilidad_bruta_snapshot)
    ? venta.utilidad_bruta_snapshot
    : aPesos(aCentavos(total) - aCentavos(costoConocido));
  const margen =
    total <= 0
      ? null
      : esNumero(venta.margen_snapshot)
        ? venta.margen_snapshot
        : (aCentavos(utilidad) * PORCIENTO) / aCentavos(total);
  return { estado: 'conocido', costo: costoConocido, utilidad, margen };
}

export type EstadoDelPeriodo = 'conocido' | 'parcial' | 'sin_receta' | 'oculto';

export interface EconomiaDelPeriodo {
  readonly estado: EstadoDelPeriodo;
  /** Todo lo vendido, con receta o sin ella. */
  readonly ingresos: number;
  /** Lo vendido en las ventas cuyo costo se conoce: la base del margen. */
  readonly ingresosConCosto: number;
  /** Nulos cuando ninguna venta tiene costo conocido: no existe, no es cero. */
  readonly costo: number | null;
  readonly utilidad: number | null;
  readonly margen: number | null;
  readonly conCosto: number;
  readonly sinReceta: number;
}

/**
 * La economía de un periodo: la utilidad y el margen son los de las ventas con costo conocido,
 * y `sinReceta` cuenta las que quedaron fuera (su importe sí está en `ingresos`).
 */
export function economiaDelPeriodo(ventas: readonly VentaParaElMargen[]): EconomiaDelPeriodo {
  let ingresos = 0;
  let ingresosConCosto = 0;
  let costo = 0;
  let utilidad = 0;
  let conCosto = 0;
  let sinReceta = 0;
  let ocultas = 0;

  for (const venta of ventas) {
    const total = aCentavos(esNumero(venta.total) ? venta.total : 0);
    ingresos += total;
    const economia = economiaDeLaVenta(venta);
    if (economia.estado === 'oculto') {
      ocultas += 1;
      continue;
    }
    if (economia.estado === 'sin_receta') {
      sinReceta += 1;
      continue;
    }
    conCosto += 1;
    ingresosConCosto += total;
    costo += aCentavos(economia.costo ?? 0);
    utilidad += aCentavos(economia.utilidad ?? 0);
  }

  const base = {
    ingresos: aPesos(ingresos),
    ingresosConCosto: aPesos(ingresosConCosto),
    conCosto,
    sinReceta,
  };
  if (ventas.length > 0 && ocultas === ventas.length) {
    return { estado: 'oculto', ...base, costo: null, utilidad: null, margen: null };
  }
  if (conCosto === 0 && sinReceta > 0) {
    return { estado: 'sin_receta', ...base, costo: null, utilidad: null, margen: null };
  }
  return {
    estado: sinReceta > 0 ? 'parcial' : 'conocido',
    ...base,
    costo: aPesos(costo),
    utilidad: aPesos(utilidad),
    margen: ingresosConCosto > 0 ? (utilidad * PORCIENTO) / ingresosConCosto : null,
  };
}

/** «1 venta sin receta» / «3 ventas sin receta». */
export function notaDeLasVentasSinReceta(cuantas: number): string {
  return `${String(cuantas)} ${cuantas === 1 ? 'venta' : 'ventas'} sin receta`;
}

/**
 * Lo que va debajo de la utilidad de un periodo: «sin receta» si ninguna venta tiene costo,
 * «60.0% margen» si todas, y «60.0% margen · 1 venta sin receta» si quedaron algunas fuera.
 */
export function subtituloDelMargen(economia: EconomiaDelPeriodo): string {
  if (economia.estado === 'oculto') return '';
  if (economia.estado === 'sin_receta') return 'sin receta';
  const margen = `${textoDelMargen(economia.margen ?? 0)} margen`;
  return economia.estado === 'parcial'
    ? `${margen} · ${notaDeLasVentasSinReceta(economia.sinReceta)}`
    : margen;
}

/** Un margen (60 = 60 %) para escribir; «—» si no existe. */
export function textoDelMargen(margen: number | null, decimales = 1): string {
  return margen === null ? '—' : `${margen.toFixed(decimales)}%`;
}

// ───────────────────────────────────────── el encabezado del historial de ventas

export interface VentaParaElResumen {
  readonly estado?: string | null | undefined;
  readonly total?: number | null | undefined;
}

export interface ResumenDeLasVentas {
  readonly transacciones: number;
  readonly pagadas: number;
  /** Pesos cobrados: sólo cuentan las pagadas. */
  readonly cobradoPesos: number;
}

/**
 * El historial enseñaba «1 transacciones · Total: $0.00» con una cuenta abierta: el total sólo
 * suma las PAGADAS y no lo decía. Aquí se cuenta todo y se dice qué suma cada cifra.
 */
export function resumenDeLasVentas(ventas: readonly VentaParaElResumen[]): ResumenDeLasVentas {
  const pagadas = ventas.filter((venta) => venta.estado === 'pagada');
  const centavos = pagadas.reduce(
    (suma, venta) => suma + aCentavos(esNumero(venta.total) ? venta.total : 0),
    0,
  );
  return {
    transacciones: ventas.length,
    pagadas: pagadas.length,
    cobradoPesos: aPesos(centavos),
  };
}

/** «3 transacciones · 1 pagada · Cobrado: $150.50». */
export function textoDelResumenDeVentas(
  resumen: ResumenDeLasVentas,
  dinero: (pesos: number) => string,
): string {
  const transacciones = resumen.transacciones === 1 ? 'transacción' : 'transacciones';
  const pagadas = resumen.pagadas === 1 ? 'pagada' : 'pagadas';
  return [
    `${String(resumen.transacciones)} ${transacciones}`,
    `${String(resumen.pagadas)} ${pagadas}`,
    `Cobrado: ${dinero(resumen.cobradoPesos)}`,
  ].join(' · ');
}
