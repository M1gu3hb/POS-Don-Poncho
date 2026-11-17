/** Los dos módulos de las pantallas que las combinaciones usan tal cual, sin copiarlos. */
declare module '*/heredado/utils/tipsUtils.js' {
  export function propinaDerivada(venta: unknown): number;
  export function propinaPorPorcentaje(importePesos: unknown, porcentaje: unknown): number;
}
declare module '*/heredado/components/caja/dinero.js' {
  export function aCentavos(pesos: unknown): number;
  export function aPesos(centavos: unknown): number;
}
