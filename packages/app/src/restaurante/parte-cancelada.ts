import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { ajustarLaMadreASusPartes } from './division-escrituras.ts';
import {
  limpiarMesa,
  llevarElGrupoConLaPrincipal,
  partesSinSaldar,
  pasarMesaCobradaALimpieza,
} from './mesas-escrituras.ts';

/**
 * CANCELAR UNA PARTE DE UNA CUENTA DIVIDIDA (DP-14.6, medio 1).
 *
 * Las partes nacen sin mesa (`division-escrituras.ts`) y cuelgan de su madre, que conserva la mesa
 * y queda `dividida`. Lo que `cancelar_orden` hace con una cuenta entera se reparte aquí:
 *
 *   · La cocina deja de preparar SÓLO lo de esa parte: las comandas siguen colgadas de la madre y
 *     llevan platillos de las demás partes, así que se cancelan los renglones de la comanda de
 *     las líneas de la parte, y la comanda sólo si ya no le queda ninguno vivo.
 *   · La madre vale lo que suman sus partes vivas (`division_cuadra`, 070).
 *   · Si ya no queda ninguna parte por cobrar la mesa no se queda ocupada: a `limpieza` si alguna
 *     se cobró (hay platos encima), a `libre` si todas se cancelaron (como al cancelar una cuenta).
 */

/** Cancela en cocina lo que corresponde a las líneas de la parte. Devuelve cuántos renglones. */
export async function cancelarLoDeLaParte(
  tx: Transaccion,
  organizacionId: string,
  parteId: string,
): Promise<number> {
  const items = await tx
    .updateTable('comanda_items')
    .set({ estado: 'cancelado' })
    .where('organizacion_id', '=', organizacionId)
    .where('orden_linea_id', 'in', (eb) =>
      eb
        .selectFrom('orden_lineas')
        .select('id')
        .where('organizacion_id', '=', organizacionId)
        .where('orden_id', '=', parteId),
    )
    .where('estado', 'in', ['pendiente', 'en_preparacion', 'listo'])
    .returning('comanda_id')
    .execute();
  const comandas = [...new Set(items.map((i) => i.comanda_id))];
  if (comandas.length > 0) {
    await sql`
      update comandas c
         set estado = 'cancelado'
       where c.organizacion_id = ${organizacionId}
         and c.id in (${sql.join(comandas.map((id) => sql.val(id)))})
         and c.estado in ('nuevo', 'en_preparacion', 'listo')
         and not exists (
           select 1 from comanda_items ci
            where ci.organizacion_id = c.organizacion_id
              and ci.comanda_id = c.id
              and ci.estado <> 'cancelado')
    `.execute(tx);
  }
  return items.length;
}

export interface EfectoEnLaMesa {
  readonly mesaId: string | null;
  readonly mesaLiberada: boolean;
}

/** La madre y la mesa después de cancelar `parteId` (que ya quedó cancelada). */
export async function cerrarLaParteCancelada(
  tx: Transaccion,
  datos: {
    readonly organizacionId: string;
    readonly madreId: string;
    readonly parteId: string;
    readonly empleoId: string;
    readonly ahora: Date;
  },
): Promise<EfectoEnLaMesa> {
  const { organizacionId, madreId, parteId, empleoId, ahora } = datos;
  // El candado de la madre, como al cobrar la última parte: dos cierres a la vez cuentan bien.
  await tx
    .selectFrom('ordenes')
    .select('id')
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', madreId)
    .forUpdate()
    .execute();
  await ajustarLaMadreASusPartes(tx, organizacionId, madreId, ahora);

  const mesa = await tx
    .selectFrom('mesas')
    .select(['id', 'estado', 'sucursal_id as sucursalId'])
    .where('organizacion_id', '=', organizacionId)
    .where('orden_activa_id', '=', madreId)
    .executeTakeFirst();
  if (mesa === undefined) return { mesaId: null, mesaLiberada: false };
  if ((await partesSinSaldar(tx, organizacionId, madreId)) > 0) {
    return { mesaId: mesa.id, mesaLiberada: false };
  }

  const cobradas = await tx
    .selectFrom('ordenes')
    .select('id')
    .where('organizacion_id', '=', organizacionId)
    .where('orden_padre_id', '=', madreId)
    .where('estado', 'in', ['pagada', 'parcialmente_reembolsada', 'reembolsada'])
    .executeTakeFirst();
  if (cobradas !== undefined) {
    await pasarMesaCobradaALimpieza(tx, organizacionId, parteId, { empleoId, ahora });
    return { mesaId: mesa.id, mesaLiberada: false };
  }

  await limpiarMesa(tx, organizacionId, mesa.id, {
    sucursalId: mesa.sucursalId,
    estadoAnterior: mesa.estado,
    empleoId,
    ahora,
  });
  await llevarElGrupoConLaPrincipal(tx, organizacionId, mesa.id, {
    estado: 'libre',
    ordenId: madreId,
    empleoId,
    ahora,
  });
  return { mesaId: mesa.id, mesaLiberada: true };
}
