import type { Ambito } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';

import {
  ambitoDe,
  sembrarCompanero,
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
} from '../../pruebas/negocio-real.ts';

/**
 * UN RESTAURANTE CON VARIOS DUEÑOS, cada uno con su ámbito (identidad incluida), para las
 * pruebas de la marca de plataforma: quién la pone, quién la quita y quién la pierde.
 */
export interface NegocioConDuenos {
  readonly negocio: NegocioReal;
  readonly duenos: readonly Ambito[];
}

export async function negocioConDuenos(nombre: string, cuantos: number): Promise<NegocioConDuenos> {
  const negocio = await sembrarNegocio({
    nombre,
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  const { sucursalId } = await sembrarSucursal(negocio, { terminales: [] });
  const primero = ambitoDe(negocio, sucursalId, null);
  const duenos: Ambito[] = [primero];
  for (let i = 1; i < cuantos; i += 1) {
    const empleoId = await sembrarCompanero(negocio, {
      nombre: `Dueño ${String(i + 1)}`,
      rol: 'dueno',
    });
    // `sembrarCompanero` no le da identidad (no entra): ésta sí la necesita para tener ámbito.
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
    duenos.push({ ...primero, empleoId, identidadId });
  }
  return { negocio, duenos };
}

/** El documento de configuración tal como está: la lista de plataforma y su versión. */
export async function marcaGuardada(organizacionId: string) {
  const fila = await obtenerDb()
    .selectFrom('configuracion')
    .select(['valores', 'version'])
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  const valores =
    typeof fila?.valores === 'object' && fila.valores !== null
      ? (fila.valores as Record<string, unknown>)
      : {};
  const marca = valores['plataforma'];
  const empleos =
    typeof marca === 'object' && marca !== null
      ? ((marca as { empleos?: unknown }).empleos ?? [])
      : [];
  return {
    empleos: Array.isArray(empleos) ? (empleos as string[]) : [],
    version: fila?.version ?? 0,
  };
}
