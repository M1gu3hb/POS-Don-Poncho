import { ESCALA_CANTIDAD } from '../catalogo/cantidades.ts';
import { redondear } from '../dinero/redondeo.ts';

/**
 * DP-D165 · EL COSTO EXACTO DE UN INSUMO.
 *
 * ── El defecto ─────────────────────────────────────────────────────────────
 * El costo por unidad base (el gramo, el mililitro, la pieza) vivía en centavos ENTEROS. La leche a
 * $480.00 los 20 litros son 2.4 ¢/ml y se guardaba como 2 (−16.7 %); el maíz a 4.5 ¢/g, como 5
 * (+11 %). Todo lo que multiplicaba cantidad por costo heredaba el error.
 *
 * ── La regla ───────────────────────────────────────────────────────────────
 * El costo se guarda además EXACTO, en DIEZMILÉSIMAS DE CENTAVO por unidad base (dmc): 2.4 ¢/ml son
 * 24 000. La escala es la misma de cuatro decimales que ya usan las cantidades (`ESCALA_CANTIDAD`).
 * Quien MULTIPLICA cantidad por costo usa el exacto y redondea UNA sola vez, al final, a centavos;
 * quien sólo muestra o copia el costo sigue leyendo el de centavos, que es el exacto redondeado.
 *
 * Todo es `bigint`: sin punto flotante, sin un redondeo intermedio.
 */

/** Diezmilésimas de centavo que caben en un centavo. */
export const ESCALA_COSTO = 10_000n;

/**
 * El costo exacto de un costo que sólo se conocía entero: lo que ese costo SIEMPRE valió.
 *
 * Es el mismo relleno de la migración 195 (`centavos × 10 000`) y lo que la base completa cuando
 * alguien escribe sólo los centavos.
 */
export function costoExactoDeCentavos(centavos: bigint): bigint {
  return centavos * ESCALA_COSTO;
}

/** El costo exacto redondeado al centavo: lo que se muestra y lo que guarda `costo_unitario_centavos`. */
export function centavosDelCosto(costoExactoDmc: bigint): bigint {
  return redondear(costoExactoDmc, ESCALA_COSTO);
}

/**
 * Lo que vale una cantidad a un costo exacto, en centavos y redondeado UNA sola vez.
 *
 * @param cantidadEscalada la cantidad en diezmilésimas de unidad base (con signo).
 * @param costoExactoDmc el costo por unidad base en diezmilésimas de centavo.
 */
export function valorDeLaCantidad(cantidadEscalada: bigint, costoExactoDmc: bigint): bigint {
  return valorDeLoAcumulado(cantidadEscalada * costoExactoDmc);
}

/**
 * Lo mismo cuando ya se sumó «cantidad × costo» de varias capas o renglones: UN redondeo sobre la
 * suma, no uno por sumando. El acumulado está en diezmilésimas de unidad × diezmilésimas de centavo.
 */
export function valorDeLoAcumulado(acumulado: bigint): bigint {
  return redondear(acumulado, ESCALA_CANTIDAD * ESCALA_COSTO);
}
