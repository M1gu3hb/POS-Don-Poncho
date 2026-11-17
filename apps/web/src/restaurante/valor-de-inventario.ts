/**
 * LA REGLA DEL VALOR DE LO QUE HAY EN EL ALMACÉN, EN UN SOLO LUGAR (A24).
 *
 * La tarjeta «Valor de inventario» de la pantalla y la valuación guardada del servidor
 * (`packages/domain/src/inventario/valuacion.ts`) tienen que decir lo mismo. Una existencia en
 * NEGATIVO —DP-D116 la permite al cobrar lo que pasó por cocina, DP-D57 al cancelarlo— es un
 * dato que falta por contar, no una deuda: vale cero y no resta del total. El conteo físico la
 * corrige. La tarjeta lo avisa en vez de ocultarlo.
 */

/** Una existencia dato-por-dato como la sirve el puente: puede venir sin valor. */
export interface ExistenciaLeida {
  readonly stock_actual?: number | null;
}

/** Existencia por costo, con lo negativo y lo que no se sabe valiendo cero. En pesos, como el puente. */
export function valorDeLaExistencia(
  existencia: number | null | undefined,
  costoPorUnidad: number | null | undefined,
): number {
  const hay = existencia ?? 0;
  return hay > 0 ? hay * (costoPorUnidad ?? 0) : 0;
}

/** Cuántos ingredientes tienen la existencia por debajo de cero. */
export function cuantosEnNegativo(ingredientes: readonly ExistenciaLeida[]): number {
  return ingredientes.filter((i) => Number(i.stock_actual ?? 0) < 0).length;
}

/** Lo que la tarjeta dice debajo del valor cuando hay ingredientes en negativo; nada si no hay. */
export function avisoDeNegativosEnElValor(cuantos: number): string | null {
  if (cuantos <= 0) return null;
  const quienes =
    cuantos === 1 ? '1 ingrediente en negativo' : `${String(cuantos)} ingredientes en negativo`;
  return `${quienes}: no resta del valor. Haz un conteo físico para corregirlo.`;
}
