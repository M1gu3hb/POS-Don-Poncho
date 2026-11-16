/**
 * EN EL PORTAL: «TU PROPINA YA QUEDÓ REGISTRADA EN CAJA» (DP-21 · Bloque 4 · M11). Puro.
 *
 * La propina se decide una sola vez. Si mientras el comensal tiene abierta su pantalla de
 * propina la Caja (o el mesero) ya la eligió, o la cuenta ya se cobró, esa pantalla no tiene
 * nada que ofrecer: se cierra sola y lo dice. La regla de quién gana vive en el servidor
 * (`propinas/una-sola-verdad.ts`); esto sólo decide qué ve el comensal.
 */

export type CierreDeLaPropina = 'caja' | 'pagada';

interface CuentaDelPortal {
  readonly id?: string | null | undefined;
  readonly estado?: string | null | undefined;
  readonly propina_tipo?: string | null | undefined;
  readonly propina_origen?: string | null | undefined;
}

const DECISIONES: readonly string[] = ['sin_propina', 'porcentaje', 'monto_manual'];
/** Lo que deja el propio portal: una elección del comensal o la espera de la suya. */
const DEL_PORTAL: readonly string[] = ['portal_qr', 'pendiente_portal_qr'];

/** Cuánto se deja leer el mensaje antes de cerrar la pantalla. */
export const ESPERA_ANTES_DE_CERRAR_MS = 2_500;

/**
 * Por qué se cierra la pantalla de propina, o `null` si sigue valiendo.
 *
 * @param cuenta      la cuenta de la mesa en la última lectura pública (`null` si ya no hay).
 * @param huboCuenta  si esta pantalla llegó a ver una cuenta abierta.
 * @param confirmada  si el comensal ya confirmó la suya aquí (entonces no hay nada que cerrar).
 */
export function cierreDeLaPropina(
  cuenta: CuentaDelPortal | null | undefined,
  huboCuenta: boolean,
  confirmada: boolean,
): CierreDeLaPropina | null {
  if (confirmada) return null;
  if (cuenta === null || cuenta === undefined) return huboCuenta ? 'pagada' : null;
  if (cuenta.estado === 'pagada') return 'pagada';
  const tipo = cuenta.propina_tipo;
  const decidida = typeof tipo === 'string' && DECISIONES.includes(tipo);
  if (!decidida) return null;
  return DEL_PORTAL.includes(cuenta.propina_origen ?? '') ? null : 'caja';
}

export function textoDelCierre(cierre: CierreDeLaPropina): string {
  return cierre === 'caja'
    ? 'Tu propina ya quedó registrada en caja'
    : 'Tu cuenta ya se pagó, ¡gracias!';
}
