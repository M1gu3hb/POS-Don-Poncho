/**
 * QUIÉN APARECE EN LAS PROPINAS (DP-24). Puro.
 *
 * Al liquidar se elegía a la persona de una lista con TODOS los usuarios activos: cocina, bebidas y
 * almacén salían junto a los meseros, y a ellos no se les liquida por aquí (no atienden cuentas).
 * Aparece sólo quien vende, cobra o atiende cuentas: mesero, cajero, gerente, administrador y dueño.
 * La misma regla en el corte y en el Tablero.
 */

/** Los puestos que atienden, venden o cobran cuentas (con los nombres de la sesión del servidor). */
export const PUESTOS_CON_PROPINA: readonly string[] = [
  'mesero',
  'cajero',
  'gerente',
  'administrador',
  'dueno',
];

/** Los que liquidan sin PIN; la cajera lo hace desde el corte, con el PIN de uno de ellos. */
export const PUESTOS_QUE_LIQUIDAN: readonly string[] = ['gerente', 'administrador', 'dueno'];

export function recibePropina(persona: { readonly rol?: unknown } | null | undefined): boolean {
  return typeof persona?.rol === 'string' && PUESTOS_CON_PROPINA.includes(persona.rol);
}

/** La lista de personas a las que se les puede liquidar, en el orden en que venía. */
export function quienesRecibenPropina<T extends { readonly rol?: unknown }>(
  personas: readonly T[] | null | undefined,
): T[] {
  return (personas ?? []).filter((persona) => recibePropina(persona));
}

/** ¿Este puesto liquida por sí mismo (sin el PIN de otro)? */
export function liquidaSinPin(puesto: string | null | undefined): boolean {
  return typeof puesto === 'string' && PUESTOS_QUE_LIQUIDAN.includes(puesto);
}
