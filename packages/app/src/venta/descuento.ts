import 'server-only';

import { ErrorDominio, ROLES, type Rol } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import type { TopeDePuesto } from '@morphiqpos/domain/venta';

import type { ContextoComando } from '../definicion.ts';
import { TOPES_DE_DESCUENTO } from './topes-del-sistema.ts';

/**
 * F-205 · EL TOPE DE CADA PUESTO.
 *
 * Ronda 2 de DP-14 · `venta.autorizar_descuento` (autorizar un descuento por encima del tope con la
 * sesión del que autoriza) se quitó: nadie lo llamaba. Desde DP-14.2 el descuento lo autoriza el PIN
 * firmado de `/api/identidad/supervisor` y el comando que lo aplica lo gasta
 * (`descuento-de-mostrador.ts`); lo que queda aquí es el tope de cada puesto que ese camino consulta.
 */

/**
 * El tope de un puesto: la fila del negocio para ese puesto o, si no la escribió, la del sistema
 * (`topes-del-sistema.ts`, los de la 078; DP-D59). El respaldo es POR PUESTO desde DP-14.2: antes
 * sólo valía si el negocio no tenía NINGUNA fila, y la primera que alguien escribiera dejaba a los
 * demás puestos en cero —el dueño sin poder autorizar, otra vez QA2-009—. Un puesto que no existe
 * en el sistema se rechaza; uno sin tope en el sistema (mesero, cocina, almacén) vale cero.
 */
export async function topeDe(
  ctx: ContextoComando<Transaccion>,
  rol: string,
): Promise<TopeDePuesto> {
  if (!(ROLES as readonly string[]).includes(rol)) {
    throw new ErrorDominio('PUESTO_INVALIDO', `«${rol}» no es uno de los puestos del sistema.`);
  }
  const fila = await ctx.paso('cargar_tope', () =>
    ctx.tx
      .selectFrom('topes_descuento')
      .select(['tope_centavos', 'tope_bp'])
      .where('organizacion_id', '=', ctx.ambito.organizacionId)
      .where('rol', '=', rol as Rol)
      .executeTakeFirst(),
  );
  if (fila !== undefined) return { topeCentavos: fila.tope_centavos, topeBp: fila.tope_bp };
  // DP-14.2 · El respaldo va POR PUESTO: el puesto que el negocio no escribió usa el del sistema.
  // Con «sólo si no hay ninguna fila», la gerente caía a cero el día que alguien escribiera la
  // fila de la cajera, y volvía QA2-009 (nadie podía autorizar).
  const delSistema = TOPES_DE_DESCUENTO.find((t) => t.rol === rol);
  return {
    topeCentavos: delSistema?.topeCentavos ?? 0n,
    topeBp: delSistema?.topeBp ?? 0,
  };
}
