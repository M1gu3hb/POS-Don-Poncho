import 'server-only';

import { obtenerDb } from '@morphiqpos/data';

import { TOPES_DE_DESCUENTO } from '../venta/topes-del-sistema.ts';

/**
 * DP-14 ronda 2 (medio 5) · HASTA CUÁNTO LLEGA EL PIN DE QUIEN AUTORIZA.
 *
 * La pantalla del descuento lo dice al autorizar («Autoriza hasta 30 %») y no deja aplicar más. Es la
 * misma regla que `venta/descuento.ts` (`topeDe`) aplica al descuento: la fila del negocio para ese
 * puesto o, si no la escribió, la del sistema; un puesto sin tope vale cero. El servidor vuelve a
 * comprobarlo al aplicar: esto sólo evita pedir un PIN para algo que no va a pasar.
 */
export interface TopeDelAutorizador {
  /** En centavos y en texto (un `bigint` no viaja en JSON). */
  readonly topeCentavos: string;
  /** En puntos base: 3000 = 30 %. */
  readonly topeBp: number;
}

export async function topeDelAutorizador(
  organizacionId: string,
  rol: string,
): Promise<TopeDelAutorizador> {
  const fila = await obtenerDb()
    .selectFrom('topes_descuento')
    .select(['tope_centavos', 'tope_bp'])
    .where('organizacion_id', '=', organizacionId)
    .where('rol', '=', rol as never)
    .executeTakeFirst();
  if (fila !== undefined) {
    return { topeCentavos: fila.tope_centavos.toString(), topeBp: fila.tope_bp };
  }
  const delSistema = TOPES_DE_DESCUENTO.find((t) => t.rol === rol);
  return {
    topeCentavos: (delSistema?.topeCentavos ?? 0n).toString(),
    topeBp: delSistema?.topeBp ?? 0,
  };
}
