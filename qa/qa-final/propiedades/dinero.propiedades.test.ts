import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { aCentavos, aPesos } from '../../../apps/web/heredado/components/caja/dinero.js';
import { propinaPorPorcentaje } from '../../../apps/web/heredado/utils/tipsUtils.js';
import {
  aplicarPorcentaje,
  centavos,
  porCantidad,
  repartirPorPesos,
} from '../../../packages/domain/src/dinero/index.ts';
import { calcularTotales } from '../../../packages/domain/src/venta/totales.ts';
import { calcularCuenta, importeDelRenglon, partesIguales } from '../oraculo/dinero.ts';

/**
 * DP-22 · PROPIEDADES DEL DINERO (fast-check): carritos al azar —cantidades, precios, pesos,
 * opciones, descuentos, tasa— y el total del sistema (`calcularTotales` y las funciones de dinero del
 * dominio) tiene que ser IGUAL, al centavo, al del oráculo independiente.
 *
 * La semilla está FIJA: un rojo se repite con la misma semilla (`SEMILLA`) y el contraejemplo que
 * fast-check encoge queda en el mensaje.
 */

const SEMILLA = 20261117;
const CORRIDAS = 3_000;
const config = { seed: SEMILLA, numRuns: CORRIDAS } as const;

const precio = fc.integer({ min: 1, max: 5_000_000 });
/** Piezas enteras (1 a 40) o peso con hasta tres decimales (0.001 a 12.999 kg). */
const cantidad = fc.oneof(
  fc.integer({ min: 1, max: 40 }).map(String),
  fc.integer({ min: 1, max: 12_999 }).map((m) => (m / 1000).toFixed(3)),
);
const opciones = fc.integer({ min: -500, max: 5_000 });
const tasa = fc.oneof(fc.constantFrom(0, 800, 1600), fc.integer({ min: 0, max: 3_000 }));

interface RenglonAlAzar {
  readonly precio: number;
  readonly cantidad: string;
  readonly opciones: number;
  readonly porPieza: boolean;
  readonly descuentoBp: number;
}

const renglon = fc.record({
  precio,
  cantidad,
  opciones,
  porPieza: fc.boolean(),
  descuentoBp: fc.integer({ min: 0, max: 10_000 }),
});
const carrito = fc.array(renglon, { minLength: 1, maxLength: 12 });

/** El renglón como el sistema lo cobra: el precio con opciones por pieza, o la opción una vez. */
function importeDelSistema(r: RenglonAlAzar): bigint {
  const base = r.porPieza
    ? porCantidad(BigInt(r.precio + r.opciones), r.cantidad)
    : porCantidad(BigInt(r.precio), r.cantidad) + BigInt(r.opciones);
  return base < 0n ? 0n : base;
}

const delOraculo = (r: RenglonAlAzar, descuento = 0n) => ({
  precioCentavos: BigInt(r.precio),
  cantidad: r.cantidad,
  opcionesCentavos: BigInt(r.opciones),
  opcionesPorPieza: r.porPieza,
  descuentoCentavos: descuento,
});

describe(`propiedades del dinero · semilla ${String(SEMILLA)} · ${String(CORRIDAS)} corridas`, () => {
  it('el importe de cada renglón del sistema es el del oráculo', () => {
    fc.assert(
      fc.property(renglon, (r) => {
        expect(importeDelSistema(r)).toBe(importeDelRenglon(delOraculo(r)));
      }),
      config,
    );
  });

  it('subtotal, descuento, IVA y total de un carrito: el sistema = el oráculo (incluido y sumado)', () => {
    fc.assert(
      fc.property(carrito, tasa, fc.boolean(), (renglones, puntosBase, incluido) => {
        const importes = renglones.map(importeDelSistema);
        const descuentos = renglones.map(
          (r, i) => ((importes[i] ?? 0n) * BigInt(r.descuentoBp)) / 10_000n,
        );
        const sistema = calcularTotales(
          importes.map((importe, i) => ({
            subtotalCentavos: centavos(importe),
            descuentoCentavos: centavos(descuentos[i] ?? 0n),
          })),
          { tasaPuntosBase: puntosBase, incluidoEnPrecio: incluido },
        );
        const oraculo = calcularCuenta({
          renglones: renglones.map((r, i) => delOraculo(r, descuentos[i] ?? 0n)),
          impuesto: { puntosBase, incluidoEnPrecio: incluido },
        });
        expect(sistema.subtotalCentavos).toBe(oraculo.subtotalCentavos);
        expect(sistema.descuentoCentavos).toBe(oraculo.descuentoCentavos);
        expect(sistema.impuestosCentavos).toBe(oraculo.impuestosCentavos);
        expect(sistema.totalCentavos).toBe(oraculo.totalCentavos);
      }),
      config,
    );
  });

  it('el descuento de la cuenta, repartido entre los renglones, suma lo descontado y el total coincide', () => {
    fc.assert(
      fc.property(
        carrito,
        fc.integer({ min: 1, max: 9_999 }),
        tasa,
        fc.boolean(),
        (renglones, bp, puntosBase, incluido) => {
          const importes = renglones.map(importeDelSistema);
          const base = importes.reduce((s, i) => s + i, 0n);
          fc.pre(base > 1n);
          const descuento = (base * BigInt(bp)) / 10_000n;
          fc.pre(descuento > 0n && descuento < base);
          const partes = repartirPorPesos(centavos(descuento), importes.map(Number));
          expect(partes.reduce((s, p) => s + p, 0n)).toBe(descuento);
          const sistema = calcularTotales(
            importes.map((importe, i) => ({
              subtotalCentavos: centavos(importe),
              descuentoCentavos: centavos(partes[i] ?? 0n),
            })),
            { tasaPuntosBase: puntosBase, incluidoEnPrecio: incluido },
          );
          const oraculo = calcularCuenta({
            renglones: renglones.map((r) => delOraculo(r)),
            descuentoDeLaCuenta: { tipo: 'monto', centavos: descuento },
            impuesto: { puntosBase, incluidoEnPrecio: incluido },
          });
          expect(sistema.descuentoCentavos).toBe(oraculo.descuentoCentavos);
          expect(sistema.impuestosCentavos).toBe(oraculo.impuestosCentavos);
          expect(sistema.totalCentavos).toBe(oraculo.totalCentavos);
        },
      ),
      config,
    );
  });

  it('la propina por porcentaje del dominio (puntos base) = la del oráculo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (total, bp) => {
          const oraculo = calcularCuenta({
            renglones: [{ precioCentavos: BigInt(total), cantidad: '1' }],
            impuesto: { puntosBase: 0, incluidoEnPrecio: true },
            propina: { tipo: 'porcentaje', puntosBase: bp },
          });
          expect(aplicarPorcentaje(centavos(BigInt(total)), bp)).toBe(oraculo.propinaCentavos);
        },
      ),
      config,
    );
  });

  it('partes iguales: el reparto del dominio da las partes del oráculo, sin perder un centavo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000 }),
        fc.integer({ min: 1, max: 12 }),
        (importe, partes) => {
          const sistema = repartirPorPesos(
            centavos(BigInt(importe)),
            Array.from({ length: partes }, () => 1),
          );
          expect(sistema.reduce((s, p) => s + p, 0n)).toBe(BigInt(importe));
          const ordenar = (lista: readonly bigint[]): bigint[] =>
            [...lista].sort((a, b) => Number(a - b));
          expect(ordenar(sistema)).toEqual(ordenar(partesIguales(BigInt(importe), partes)));
        },
      ),
      config,
    );
  });

  it('la propina del diálogo de la Caja (pesos en punto flotante) = la del oráculo, al centavo', () => {
    // El diálogo de propina de la Caja y el del portal calculan con `propinaPorPorcentaje`.
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5_000_000 }),
        fc.constantFrom(5, 10, 12, 15, 18, 20),
        (total, pct) => {
          const delDialogo = BigInt(aCentavos(propinaPorPorcentaje(aPesos(total), pct)));
          const oraculo = calcularCuenta({
            renglones: [{ precioCentavos: BigInt(total), cantidad: '1' }],
            impuesto: { puntosBase: 0, incluidoEnPrecio: true },
            propina: { tipo: 'porcentaje', puntosBase: pct * 100 },
          }).propinaCentavos;
          expect(delDialogo, `total ${String(total)} · ${String(pct)} %`).toBe(oraculo);
        },
      ),
      config,
    );
  });
});
