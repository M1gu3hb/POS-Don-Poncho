/**
 * ¿EL COSTO DE ESTA VENTA SE DESCONOCE? (DP-12.6)
 *
 * Al cobrar se guarda una foto: `costo_total`, `utilidad` y `margen` de la cuenta. Un platillo SIN
 * receta cuesta cero en esa foto (`productos.costo_unitario_centavos` es `not null default 0`), y
 * una cuenta de platillos sin receta salía «costo $0.00 · utilidad = total · 100 % margen»: la
 * cifra más bonita que puede ver un dueño y la única que seguro es falsa. Costo cero (o ausente)
 * en una venta CON importe es costo desconocido, no costo cero.
 *
 * Una sola regla para el historial, el tablero, los registros y los exportes. Sólo mira el signo:
 * sirve igual en pesos que en centavos. El campo AUSENTE (`undefined`) es «este rol no ve costos»
 * y no se declara «sin receta»; el nulo, en cambio, sí es «no hay costo».
 */

type Cantidad = number | bigint | string | null | undefined;

function comoNumero(valor: Cantidad): number | null {
  if (valor === null || valor === undefined) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function costoDeLaVentaEsDesconocido(total: Cantidad, costo: Cantidad): boolean {
  if (costo === undefined) return false;
  const importe = comoNumero(total);
  if (importe === null || importe <= 0) return false;
  const costoConocido = comoNumero(costo);
  return costoConocido === null || costoConocido <= 0;
}
