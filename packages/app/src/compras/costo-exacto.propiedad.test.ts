import { cantidad as aCantidad } from '@morphiqpos/domain/catalogo';
import { centavos } from '@morphiqpos/domain/dinero';
import { centavosDelCosto, valorDeLaCantidad } from '@morphiqpos/domain/inventario';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { costoExactoPorUnidad, costoPromedioPonderado } from './costeo.ts';

/**
 * DP-D165 · LO QUE VALE EL INVENTARIO DIFIERE DE LO COMPRADO EN A LO MÁS N CENTAVOS (propiedad).
 *
 * Se simula el camino REAL de una compra: el costo de la entrada (`costoExactoPorUnidad`), el
 * promedio ponderado sobre el exacto (`costoPromedioPonderado`) y el valor de la existencia
 * (`valorDeLaCantidad`, una sola vez, a centavos). Todo en `bigint`.
 *
 * ── De dónde sale N ────────────────────────────────────────────────────────
 * El costo exacto se guarda REDONDEADO a una diezmilésima de centavo por unidad: el error de cada
 * promedio es de a lo más 0.5 diezmilésimas por unidad. Con Q unidades en el almacén, eso son a lo
 * más Q × 0.5 / 10 000 ¢ = Q / 20 000 ¢ de diferencia. El promedio siguiente pondera contra el valor
 * ya redondeado, así que el error de cada compra se ARRASTRA (no se compensa ni se multiplica):
 *
 *     |valor sin redondear − comprado| ≤ E = Σ_k Q_k / 20 000        (Q_k: la existencia tras la compra k)
 *
 * y el redondeo final al centavo añade, como mucho, medio centavo:
 *
 *     N = ⌊ E + 1/2 ⌋ centavos.
 *
 * Consecuencia: una sola compra de menos de 10 000 unidades base (10 kg, 10 L) vale EXACTAMENTE lo
 * que costó (N = 0); la leche de 20 L, a 2.4 ¢/ml, también, porque 2.4 es exacto en diezmilésimas.
 */

const UNIDAD = 10_000n; // una unidad base = 10 000 diezmilésimas de unidad

interface Compra {
  readonly cantidadDmm: bigint;
  readonly totalCentavos: bigint;
}

/** Cantidad con hasta cuatro decimales (en diezmilésimas) y un importe en centavos. */
const compra = (maximoDmm: bigint) =>
  fc.record({
    cantidadDmm: fc.bigInt({ min: 1n, max: maximoDmm }),
    totalCentavos: fc.bigInt({ min: 0n, max: 100_000_000n }),
  });

function comoCantidad(dmm: bigint) {
  return aCantidad(`${(dmm / UNIDAD).toString()}.${(dmm % UNIDAD).toString().padStart(4, '0')}`);
}

/** Corre las compras de UN insumo por el camino real; devuelve el valor del almacén y la existencia. */
function valuarCompras(compras: readonly Compra[]): { valor: bigint; existencia: bigint } {
  let existencia = 0n;
  let exacto = 0n;
  for (const c of compras) {
    const entrante = comoCantidad(c.cantidadDmm);
    // El costo de la entrada se calcula pero el que queda en el insumo es el PROMEDIO.
    costoExactoPorUnidad(centavos(c.totalCentavos), entrante);
    exacto = costoPromedioPonderado({
      existenciaAnterior: existencia,
      costoAnteriorExactoDmc: exacto,
      cantidadEntrante: entrante,
      costoTotalCentavos: centavos(c.totalCentavos),
    });
    existencia += c.cantidadDmm;
  }
  return { valor: valorDeLaCantidad(existencia, exacto), existencia };
}

/** N = ⌊ Σ_k Q_k / 20 000 + 1/2 ⌋, en enteros: Q_k está en diezmilésimas (÷ 10 000 por unidad). */
function cotaEnCentavos(compras: readonly Compra[]): bigint {
  let acumulada = 0n;
  let sumaDeExistencias = 0n; // Σ_k Q_k, en diezmilésimas de unidad
  for (const c of compras) {
    acumulada += c.cantidadDmm;
    sumaDeExistencias += acumulada;
  }
  // E = sumaDeExistencias / (10 000 × 20 000);  N = ⌊E + 1/2⌋ = ⌊(2·suma + D) / (2·D)⌋, con D = 2 × 10^8.
  const d = UNIDAD * 20_000n;
  return (2n * sumaDeExistencias + d) / (2n * d);
}

describe('DP-D165 · el valor del inventario contra lo comprado', () => {
  it('una sola compra de menos de 10 000 unidades vale EXACTAMENTE lo que costó (N = 0)', () => {
    fc.assert(
      fc.property(compra(99_999_999n), ({ cantidadDmm, totalCentavos }) => {
        const { valor } = valuarCompras([{ cantidadDmm, totalCentavos }]);
        expect(valor).toBe(totalCentavos);
      }),
      { numRuns: 2_000 },
    );
  });

  it('varias compras del mismo insumo difieren de lo comprado en a lo más N = ⌊Σ Q_k/20 000 + ½⌋ ¢', () => {
    fc.assert(
      fc.property(fc.array(compra(50_000_000n), { minLength: 1, maxLength: 12 }), (compras) => {
        const comprado = compras.reduce((suma, c) => suma + c.totalCentavos, 0n);
        const { valor } = valuarCompras(compras);
        const diferencia = valor > comprado ? valor - comprado : comprado - valor;
        expect(diferencia <= cotaEnCentavos(compras)).toBe(true);
      }),
      { numRuns: 3_000 },
    );
  });

  it('el costo de centavos que se muestra es siempre el exacto redondeado', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 12n }), (exacto) => {
        const mostrado = centavosDelCosto(exacto);
        // |exacto − mostrado × 10 000| ≤ 5 000: a lo más medio centavo.
        const resto = exacto - mostrado * 10_000n;
        expect(resto <= 5_000n && resto >= -5_000n).toBe(true);
      }),
    );
  });
});
