import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

/**
 * LO QUE SE QUEDA EN LA PRINCIPAL AL SEPARAR LAS MESAS (DP-13.3).
 *
 * Separar devuelve cada mesa a su lugar, pero el pedido del portal que armaron los teléfonos de
 * todo el grupo y las notas que se juntaron (alergias, celebración) se quedan en la principal: no
 * hay manera honesta de repartirlos. Antes se quedaban ahí en silencio y el mesero de la mesa que
 * volvía al servicio no sabía que «lo suyo» ya no estaba. Ahora el resultado lo cuenta y lo dice.
 */

export interface LoQueSeQueda {
  readonly lineasDelPortalEnLaPrincipal: number;
  /** Qué se quedó y en qué mesa, para decírselo a quien separó; `null` si nada. */
  readonly aviso: string | null;
}

/** El aviso, dicho: «El pedido del portal (3 cosas) se quedó en la mesa 1.» */
export function avisoAlSeparar(numero: number, lineas: number, conNotas: boolean): string | null {
  const mesa = `la mesa ${String(numero)}`;
  const pedido = `El pedido del portal (${String(lineas)} ${lineas === 1 ? 'cosa' : 'cosas'})`;
  if (lineas > 0 && conNotas) return `${pedido} y las notas se quedaron en ${mesa}.`;
  if (lineas > 0) return `${pedido} se quedó en ${mesa}.`;
  if (conNotas) return `Las alergias y la celebración se quedaron en ${mesa}.`;
  return null;
}

export async function loQueSeQuedaEnLaPrincipal(
  tx: Transaccion,
  organizacionId: string,
  unionId: string,
): Promise<LoQueSeQueda> {
  const { rows } = await sql<{ numero: number; lineas: string; conNotas: boolean }>`
    select m.numero,
           (select count(*)
              from carrito_mesa_lineas l
             where l.organizacion_id = m.organizacion_id and l.mesa_id = m.id) as lineas,
           (coalesce(m.notas_alergias, '') <> '' or m.celebracion_especial) as "conNotas"
      from uniones_mesa u
      join mesas m on m.id = u.mesa_principal_id and m.organizacion_id = u.organizacion_id
     where u.organizacion_id = ${organizacionId} and u.id = ${unionId}
  `.execute(tx);
  const [principal] = rows;
  if (principal === undefined) return { lineasDelPortalEnLaPrincipal: 0, aviso: null };
  const lineas = Number(principal.lineas);
  return {
    lineasDelPortalEnLaPrincipal: lineas,
    aviso: avisoAlSeparar(principal.numero, lineas, principal.conNotas),
  };
}
