import type { Ambito, Rol } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';

import { sembrarCompanero } from '../../pruebas/negocio-real.ts';
import type { mesaConPortal } from './mesa-con-portal.ts';

/** La mesa de `mesaConPortal`, tal como la devuelve. */
export type CasoDeLaMesa = Awaited<ReturnType<typeof mesaConPortal>>;

/**
 * Una persona del personal con SU sesión (empleo, identidad y rol) en la sucursal de la mesa: la que
 * necesita un comando con sesión —el mesero que vacía o confirma el pedido del portal— y no el
 * ámbito de dueño con el que `mesaConPortal` prepara todo.
 */
export async function ambitoDelPersonal(
  caso: CasoDeLaMesa,
  rol: Rol,
  sucursalId: string = caso.sucursalId,
): Promise<Ambito> {
  const empleoId = await sembrarCompanero(caso.negocio, { nombre: `Persona ${rol}`, rol });
  const { persona_id } = await obtenerDb()
    .selectFrom('empleos')
    .select('persona_id')
    .where('id', '=', empleoId)
    .executeTakeFirstOrThrow();
  const { id: identidadId } = await obtenerDb()
    .insertInto('identidades')
    .values({ persona_id })
    .returning('id')
    .executeTakeFirstOrThrow();
  return {
    organizacionId: caso.negocio.organizacionId,
    sucursalId,
    terminalId: null,
    identidadId,
    empleoId,
    rol,
  };
}
