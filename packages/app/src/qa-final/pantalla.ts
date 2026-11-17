/**
 * DP-22 · LO QUE LA PANTALLA CALCULA, con las mismas funciones que la pantalla usa.
 *
 *   · `totalesDelPapel` y `propinaDerivada`: lo que dice el ticket, la precuenta y la reimpresión.
 *   · `propinaDelDialogo`: la propina por porcentaje del diálogo de la Caja y del portal
 *     (`propinaPorPorcentaje`, de `tipsUtils.js`), en centavos.
 */
import { totalesDelPapel } from '../../../../apps/web/src/venta/totales-del-papel.ts';
import { aCentavos, aPesos } from '../../../../apps/web/heredado/components/caja/dinero.js';
import {
  propinaDerivada,
  propinaPorPorcentaje,
} from '../../../../apps/web/heredado/utils/tipsUtils.js';

/** La propina por porcentaje que el diálogo de la Caja le pone a una cuenta, en centavos. */
export function propinaDelDialogo(totalCentavos: bigint, porcentaje: number): bigint {
  return BigInt(aCentavos(propinaPorPorcentaje(aPesos(Number(totalCentavos)), porcentaje)));
}

export function totalesDelPapelDeLaPantalla(venta: unknown, detalles: readonly unknown[]) {
  return totalesDelPapel(
    venta as Parameters<typeof totalesDelPapel>[0],
    detalles as Parameters<typeof totalesDelPapel>[1],
  );
}

export function propinaDeLaVentaEnPantalla(venta: unknown): number {
  return propinaDerivada(venta);
}
