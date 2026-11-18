import 'server-only';

import { cantidad } from '@morphiqpos/domain/catalogo';
import { redondear } from '@morphiqpos/domain/dinero';
import { ESCALA_COSTO, valorDeLaCantidad } from '@morphiqpos/domain/inventario';
import type { MovimientoPlaneado } from '@morphiqpos/domain/inventario';
import type { Transaccion } from '@morphiqpos/data';

/**
 * DP-D180 · EL COSTO DE LO QUE SE VENDE POR KILO O POR PORCIÓN (hallazgo 27).
 *
 * ── El defecto ─────────────────────────────────────────────────────────────
 * El renglón de una venta copia su costo de `productos.costo_unitario_centavos`, y ése sólo lo llena
 * `recalcularCostosRecetas` para los platillos con RECETA. Un platillo que se vende por medida (la
 * barbacoa por kilo) o por porción de un contenedor (la copa de una botella) baja su INSUMO BASE
 * —`estrategia_consumo = 'insumo_base'`— pero su renglón se quedaba en costo cero: costo «desconocido»
 * (DP-12.6). Registros sumaba la venta, no su costo, y dejaba fuera de «Utilidad bruta» y de la base
 * del margen justo el platillo principal.
 *
 * ── La regla ───────────────────────────────────────────────────────────────
 * Al cobrar, el costo del renglón sale del MISMO cálculo que el consumo: lo que el renglón baja del
 * almacén (`planearConsumo`, la única que decide qué sale) × el costo EXACTO del insumo en ese
 * momento (`costo_exacto_dmc`, DP-D165), redondeado UNA vez al centavo por renglón. Es el costo con
 * que el kardex valúa esa misma salida.
 *
 *   · `utilidad_centavos` del renglón = total − costo (el invariante de F1-04 §7.3);
 *   · `costo_unitario_centavos` = ese costo por unidad vendida (por kg, por copa), redondeado una vez
 *     desde lo exacto. Lo leen los demás reportes (`costo × cantidad`);
 *   · la cuenta suma el costo EXACTO de sus renglones (`cotizar` lo recibe): la cifra congelada en la
 *     orden no depende del redondeo por unidad.
 *
 * Un insumo base SIN costo no inventa uno: el renglón se queda como estaba (costo desconocido). Lo ya
 * cobrado con costo cero es historia y no se reescribe.
 *
 * Se recibe `planear` en vez de importar `cobrar.ts` para no cerrar un ciclo de módulos: el cobro es
 * quien sabe traducir una línea a su consumo.
 */

/** Lo que baja UNA línea (identificada y con esta cantidad): lo que `planearConsumo` devuelve. */
export type PlanearLaLinea = (
  lineaId: string,
  cantidad: string,
) => Promise<readonly MovimientoPlaneado[]>;

/** El costo EXACTO (centavos, un solo redondeo) de cada renglón por medida o por porción. */
export type CostosPorLinea = ReadonlyMap<string, bigint>;

/**
 * Congela el costo de los renglones `insumo_base` de la cuenta y devuelve el costo de cada uno.
 *
 * Corre ANTES de cotizar, en la misma transacción del cobro: el costo de la cuenta sale de aquí.
 */
export async function congelarElCostoPorMedida(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
  planear: PlanearLaLinea,
): Promise<CostosPorLinea> {
  const lineas = await tx
    .selectFrom('orden_lineas as l')
    .innerJoin('productos as p', (unir) =>
      unir.onRef('p.id', '=', 'l.producto_id').onRef('p.organizacion_id', '=', 'l.organizacion_id'),
    )
    .select(['l.id as id', 'l.cantidad as cantidad', 'l.total_centavos as totalCentavos'])
    .where('l.organizacion_id', '=', organizacionId)
    .where('l.orden_id', '=', ordenId)
    .where('l.anulada_en', 'is', null)
    .where('p.estrategia_consumo', '=', 'insumo_base')
    .orderBy('l.orden_visual')
    .execute();

  const costos = new Map<string, bigint>();
  for (const linea of lineas) {
    const costo = await costoDeLaLinea(tx, organizacionId, linea, planear);
    if (costo === null) continue;
    costos.set(linea.id, costo.totalCentavos);
    await tx
      .updateTable('orden_lineas')
      .set({
        costo_unitario_centavos: costo.porUnidadCentavos,
        utilidad_centavos: linea.totalCentavos - costo.totalCentavos,
      })
      .where('organizacion_id', '=', organizacionId)
      .where('id', '=', linea.id)
      .execute();
  }
  return costos;
}

interface CostoDeLinea {
  readonly totalCentavos: bigint;
  readonly porUnidadCentavos: bigint;
}

async function costoDeLaLinea(
  tx: Transaccion,
  organizacionId: string,
  linea: { readonly id: string; readonly cantidad: string },
  planear: PlanearLaLinea,
): Promise<CostoDeLinea | null> {
  const salidas = await planear(linea.id, linea.cantidad);
  // `planearConsumo` junta por insumo: una línea `insumo_base` baja uno solo.
  let acumulado = 0n;
  let cantidadBase = 0n;
  let costoExactoDmc = 0n;
  for (const salida of salidas) {
    const insumo = await tx
      .selectFrom('insumos')
      .select('costo_exacto_dmc')
      .where('organizacion_id', '=', organizacionId)
      .where('id', '=', salida.insumoId)
      .executeTakeFirst();
    if (insumo === undefined) continue;
    const baja = cantidad(salida.cantidad);
    const dmc = insumo.costo_exacto_dmc;
    acumulado += baja * dmc;
    cantidadBase += baja;
    costoExactoDmc = dmc;
  }
  const totalCentavos = valorDeLaCantidad(cantidadBase, costoExactoDmc);
  if (acumulado <= 0n || totalCentavos <= 0n) return null;

  // Por unidad vendida, UNA vez desde lo exacto: cantidad base × costo ÷ cantidad vendida.
  const vendida = cantidad(linea.cantidad);
  const porUnidadCentavos = redondear(acumulado, vendida * ESCALA_COSTO);
  return { totalCentavos, porUnidadCentavos };
}
