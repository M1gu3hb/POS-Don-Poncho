/**
 * DP-18 (A4) · EL ALMACÉN DE LA SUCURSAL: leerlo y, si no hay, crearlo.
 *
 * Sin almacén no hay compras (`compras.registrar` responde «Esta sucursal no tiene un almacén donde
 * recibir la compra») ni inventario que guardar. El comando que lo crea —`inventario.crear_almacen`,
 * `POST /api/inventario/almacenes/crear`— existía sin que ninguna pantalla lo llamara, y la base de
 * Don Poncho en producción no tenía ninguno.
 *
 * El puente no expone la entidad `Almacen`: la lista sale de `GET /api/inventario/resumen` (dueño,
 * administración, gerencia y almacén; a la cocina le responde 403 y quien llama debe soportarlo). No
 * se guarda en memoria, por la misma razón que `obtenerAlmacenPrincipalId` en `heredado/`: un id
 * guardado sobrevive a un cambio de sesión y llegaría al comando el almacén de otro negocio.
 */
import { invocarComando, obtenerApi } from '~/cliente/api';

export interface AlmacenDeLaSucursal {
  readonly id: string;
  readonly nombre: string;
  readonly principal: boolean;
}

/** El nombre con el que nace el primero: el dueño lo puede renombrar después. */
export const NOMBRE_DEL_ALMACEN_PRINCIPAL = 'Almacén principal';

/** El principal; si ninguno lo es, el primero; sin almacenes, ninguno. */
export function almacenPrincipal(
  almacenes: readonly AlmacenDeLaSucursal[],
): AlmacenDeLaSucursal | null {
  return almacenes.find((a) => a.principal) ?? almacenes[0] ?? null;
}

/** Los almacenes activos de la organización, el principal primero. */
export async function leerAlmacenes(signal?: AbortSignal): Promise<readonly AlmacenDeLaSucursal[]> {
  const resumen = await obtenerApi<{ readonly almacenes?: readonly AlmacenDeLaSucursal[] }>(
    '/api/inventario/resumen',
    signal,
  );
  return resumen.almacenes ?? [];
}

/** Crea el almacén principal de la sucursal de la sesión y devuelve su id. */
export async function crearAlmacenPrincipal(): Promise<string> {
  const creado = await invocarComando<{ readonly id: string }>('/api/inventario/almacenes/crear', {
    nombre: NOMBRE_DEL_ALMACEN_PRINCIPAL,
  });
  return creado.id;
}
