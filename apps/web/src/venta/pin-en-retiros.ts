/**
 * «PEDIR PIN DE GERENTE EN RETIROS MAYORES A $X» EN LA PANTALLA (DP-16, encargo 1.4).
 *
 * El umbral vive en `configuracion.valores.retiro_pin_arriba_de_centavos` (centavos). Sin él —o con
 * algo que no es un entero positivo— no se pide nada. El SERVIDOR es quien lo exige; esto sólo
 * evita ofrecer el retiro sin decir por qué hace falta el PIN. La lectura (con React Query) vive en
 * `use-umbral-de-retiro.ts`.
 */

export const CLAVE_DEL_UMBRAL_DE_RETIRO = [
  'configuracion',
  'retiro_pin_arriba_de_centavos',
] as const;

export function umbralDeRetiroLeido(
  configuracion: { readonly retiro_pin_arriba_de_centavos?: unknown } | undefined,
): number | null {
  const valor = configuracion?.retiro_pin_arriba_de_centavos;
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 ? valor : null;
}

/** ¿Este retiro pide el PIN? Mayor ESTRICTO que el umbral, y no para quien ya es de gerencia. */
export function retiroPideElPin(
  montoCentavos: number,
  umbralCentavos: number | null,
  esDeGerencia: boolean,
): boolean {
  if (umbralCentavos === null || esDeGerencia) return false;
  return Math.abs(montoCentavos) > umbralCentavos;
}

/** «$1,500.00» para decirlo en la pantalla (México: coma de miles, punto decimal). */
export function pesosDelUmbral(centavos: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
    centavos / 100,
  );
}
