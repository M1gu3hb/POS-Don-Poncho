import type { EstadoDelCosto } from '@morphiqpos/domain/venta';

import { centavosDe } from '~/cliente/dinero-del-puente';

import { economiaDelPeriodo, notaDeLasVentasFuera, seVeElMargen } from './margen-de-las-ventas.ts';

/**
 * EL DINERO DEL DÍA DEL RESTAURANTE, sin pantalla (C.6 y auditoría de la 2.4).
 *
 * Vive aparte de `CierreDiario.tsx` para probarse: el proyecto de pruebas `unidad` no
 * transforma JSX, y estas cuentas —qué es venta, qué es propina, qué debe haber en el
 * cajón— no tenían ninguna prueba. Por eso nadie vio que la propina en efectivo se
 * contaba dos veces en el esperado.
 */

export type Canal = 'efectivo' | 'tarjeta' | 'transferencia';

export interface VentaDelDia {
  readonly id: string;
  readonly estado: string | null;
  readonly total: number | null;
  /** Ausente para quien no ve márgenes: el puente no se lo manda (DP-13.2). */
  readonly costo_total_snapshot?: number | null | undefined;
  /** DP-13.2 · Lo que el servidor dice de su costo (`caja/corte/costo-conocido.ts`). */
  readonly estado_costo?: EstadoDelCosto | null;
  readonly propina_efectivo: number | null;
  readonly propina_tarjeta: number | null;
  readonly propina_transferencia: number | null;
  readonly monto_efectivo: number | null;
  readonly monto_tarjeta: number | null;
  readonly monto_transferencia: number | null;
  readonly usuario_mesero_nombre: string | null;
  readonly fecha_apertura: string | null;
  /** Lo que nombra a una parte de una cuenta dividida: «Mesa 5 · cuenta 1 de 2». */
  readonly cliente_nombre?: string | null;
}

export interface GastoDelDia {
  readonly id: string;
  readonly monto: number | null;
  readonly metodo_pago: string | null;
}

/** Un gasto, en centavos. Sin monto cuenta como cero: no suma, y no rompe la suma. */
function montoDe(gasto: GastoDelDia): number {
  return centavosDe('GastoOperativo', 'monto', gasto.monto) ?? 0;
}

export interface ResumenDelDia {
  readonly ventas: number;
  readonly tickets: number;
  readonly promedio: number;
  /**
   * DP-13.2 · Costo, utilidad, margen y neta salen SÓLO de las ventas con costo completo: una
   * venta sin receta (o con receta incompleta) se cobró con costo cero en esa parte y sumarla
   * inflaba el margen. Nulos si ninguna lo tiene: no se sabe, no es cero.
   */
  readonly costo: number | null;
  readonly utilidad: number | null;
  /** En puntos base sobre la venta CON COSTO: 6543 se lee 65.43 %. */
  readonly margen: number | null;
  readonly gastos: number;
  readonly neta: number | null;
  /** Las que quedaron fuera del margen, dichas («1 venta sin receta»); vacío si ninguna. */
  readonly fueraDelMargen: string;
  /** DP-13.2 · `false` para quien no ve márgenes: ni costo, ni utilidad, ni «sin receta». */
  readonly margenVisible: boolean;
  readonly propinas: Readonly<Record<Canal, number>>;
  readonly porCanal: Readonly<Record<Canal, number>>;
  readonly gastosEnEfectivo: number;
}

/**
 * El resumen del día, SIN propinas dentro del dinero del negocio.
 *
 * La propina no es venta ni margen: es dinero de los meseros que pasó por la
 * caja. Mezclarla infla la utilidad del día, y quien lea el PDF creerá que ganó
 * lo que en realidad debe.
 */
export function resumirDia(
  ventas: readonly VentaDelDia[],
  gastos: readonly GastoDelDia[],
): ResumenDelDia {
  const pagadas = ventas.filter((venta) => venta.estado === 'pagada');
  // Cada lector ya devuelve CENTAVOS —pasa por `centavosDe`—; lo que no vino suma cero.
  const suma = (lee: (venta: VentaDelDia) => number | null): number =>
    pagadas.reduce((total, venta) => total + (lee(venta) ?? 0), 0);
  const total = suma((venta) => centavosDe('Venta', 'total', venta.total));
  const operativos = gastos.reduce((lleva, gasto) => lleva + montoDe(gasto), 0);
  // La economía (en pesos) la decide la regla de las ventas; aquí se pasa a centavos.
  const economia = economiaDelPeriodo(pagadas);
  const enCentavos = (pesos: number | null): number | null =>
    pesos === null ? null : Math.round(pesos * 100);
  const costo = enCentavos(economia.costo);
  const utilidad = enCentavos(economia.utilidad);
  return {
    ventas: total,
    tickets: pagadas.length,
    promedio: pagadas.length === 0 ? 0 : Math.round(total / pagadas.length),
    costo,
    utilidad,
    margen:
      economia.margen === null
        ? pagadas.length === 0
          ? 0
          : null
        : Math.round(economia.margen * 100),
    gastos: operativos,
    neta: utilidad === null ? null : utilidad - operativos,
    fueraDelMargen: notaDeLasVentasFuera(economia),
    margenVisible: seVeElMargen(economia),
    propinas: {
      efectivo: suma((venta) => centavosDe('Venta', 'propina_efectivo', venta.propina_efectivo)),
      tarjeta: suma((venta) => centavosDe('Venta', 'propina_tarjeta', venta.propina_tarjeta)),
      transferencia: suma((venta) =>
        centavosDe('Venta', 'propina_transferencia', venta.propina_transferencia),
      ),
    },
    // LO VENDIDO por canal, SIN la propina (auditoría de la 2.4). `monto_*` de la vista
    // 057 es lo COBRADO por ese método —venta más propina—; leerlo como venta contaba la
    // propina dos veces en el esperado del cajón (una aquí y otra en `propinas`) y un
    // conteo correcto salía «FALTA $75». La resta es por venta, y por método: exacta.
    porCanal: {
      efectivo: suma(
        (venta) =>
          (centavosDe('Venta', 'monto_efectivo', venta.monto_efectivo) ?? 0) -
          (centavosDe('Venta', 'propina_efectivo', venta.propina_efectivo) ?? 0),
      ),
      tarjeta: suma(
        (venta) =>
          (centavosDe('Venta', 'monto_tarjeta', venta.monto_tarjeta) ?? 0) -
          (centavosDe('Venta', 'propina_tarjeta', venta.propina_tarjeta) ?? 0),
      ),
      transferencia: suma(
        (venta) =>
          (centavosDe('Venta', 'monto_transferencia', venta.monto_transferencia) ?? 0) -
          (centavosDe('Venta', 'propina_transferencia', venta.propina_transferencia) ?? 0),
      ),
    },
    gastosEnEfectivo: gastos
      .filter((gasto) => gasto.metodo_pago === 'efectivo' || gasto.metodo_pago === null)
      .reduce((lleva, gasto) => lleva + montoDe(gasto), 0),
  };
}

/** Lo que DEBERÍA haber en el cajón. No se enseña hasta que hay un conteo. */
export function esperadoEnCaja(
  datos: { readonly fondoInicial: number },
  resumen: ResumenDelDia,
): number {
  const entra = resumen.porCanal.efectivo + resumen.propinas.efectivo;
  return datos.fondoInicial + entra - resumen.gastosEnEfectivo;
}
