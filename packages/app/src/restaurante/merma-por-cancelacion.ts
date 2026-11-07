import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { yaHechoElPlatillo, yaHechoEnLaCuenta } from '../caja/corte/cancelaciones.ts';
import { planearConsumo } from '../venta/cobrar.ts';

/**
 * LO CANCELADO QUE YA ESTABA HECHO ES MERMA (DP-13.3, decisión DP-D57).
 *
 * El almacén sólo bajaba al cobrar: la arrachera que la cocina ya sirvió y la mesa no pagó se
 * quedaba en el inventario aunque ya no existía, y el corte la contaba como pérdida sin que el
 * almacén lo supiera. Al cancelar la cuenta (o anular el platillo), lo que ya estaba listo o
 * entregado sale ahora del almacén como merma, con la MISMA traducción que usa el cobro
 * (`planearConsumo`: la receta del canal con sus opciones, o la pieza si se vende por pieza).
 * Lo que la cocina no había hecho no toca el almacén.
 *
 *   · «Ya hecho» es lo mismo que el corte llama pérdida (`caja/corte/cancelaciones.ts`): de la
 *     cuenta, cada platillo vivo por lo que su comanda (o él) dejó listo o entregado; de un
 *     platillo que se anula, sólo si ÉL ya estaba hecho.
 *   · Cancelar nunca se traba por el inventario: si el almacén decía que no había, ya estaba mal
 *     (la cocina lo preparó), y la existencia queda en negativo para que el conteo lo enseñe.
 *   · La clave del motivo es `platillo_rehecho`: `motivos_merma` es un catálogo GLOBAL de la base
 *     compartida, y una clave nueva («por_cancelación») sería escribir en lo de los demás
 *     negocios. El movimiento se reconoce por su referencia (`orden` o `anulacion`) y su nota, y
 *     el corte lo dice «Por cancelación». La ficha 27 pide al maestro sembrar la clave propia.
 */

/**
 * DP-14.6 · Lo que canceló el CLIENTE no es culpa del empleado: el motivo no puede ser
 * imputable. `platillo_rehecho` SÍ lo es (un platillo que el cocinero tuvo que rehacer) y se queda
 * para ese caso. La clave propia es `por_cancelacion` (restaurante, no imputable); es un DATO de
 * `motivos_merma` que se siembra aparte (`insert` en la entrega). Mientras no exista, la merma usa
 * `prueba_cocina` —existente, no imputable—, de modo que cancelar nunca se traba ni se imputa.
 */
export const MOTIVO_DE_LA_MERMA = 'por_cancelacion';
export const MOTIVO_SI_FALTA_LA_CLAVE = 'prueba_cocina';

/** La clave que se escribe: la propia si ya está sembrada y activa, y si no la existente. */
async function motivoDeLaMerma(tx: Transaccion): Promise<string> {
  const propia = await tx
    .selectFrom('motivos_merma')
    .select('clave')
    .where('clave', '=', MOTIVO_DE_LA_MERMA)
    .where('activo', '=', true)
    .where('imputable', '=', false)
    .executeTakeFirst();
  return propia === undefined ? MOTIVO_SI_FALTA_LA_CLAVE : MOTIVO_DE_LA_MERMA;
}
export const NOTA_DE_LA_MERMA = 'Por cancelación';

interface Contexto {
  readonly tx: Transaccion;
  readonly organizacionId: string;
  readonly empleoId: string;
}

/** De cada platillo vivo de la cuenta, cuánto ya estaba hecho (nunca más que el platillo). */
async function hechoDeLaCuenta(ctx: Contexto, ordenId: string): Promise<Map<string, string>> {
  const { rows } = await sql<{ id: string; cantidad: string }>`
    select l.id, least(l.cantidad::numeric, hecho.cantidad)::text as cantidad
      from orden_lineas l
      join lateral (
        select sum(ci.cantidad::numeric) as cantidad
          from comanda_items ci
          join comandas c on c.id = ci.comanda_id and c.organizacion_id = ci.organizacion_id
         where ci.organizacion_id = l.organizacion_id
           and ci.orden_linea_id = l.id
           and ${yaHechoEnLaCuenta}
      ) hecho on hecho.cantidad is not null
     where l.organizacion_id = ${ctx.organizacionId}
       and l.orden_id = ${ordenId}
       and l.anulada_en is null
  `.execute(ctx.tx);
  return new Map(rows.map((r) => [r.id, r.cantidad]));
}

/** El platillo que se anula: si ÉL ya estaba hecho, la cantidad que se anula; si no, nada. */
async function hechoDeLaLinea(
  ctx: Contexto,
  lineaId: string,
  cantidad: string,
): Promise<Map<string, string>> {
  const { rows } = await sql<{ hecho: boolean }>`
    select (l.estado_preparacion in ('listo', 'entregado')
            or exists (select 1
                         from comanda_items ci
                        where ci.organizacion_id = l.organizacion_id
                          and ci.orden_linea_id = l.id
                          and ${yaHechoElPlatillo})) as hecho
      from orden_lineas l
     where l.organizacion_id = ${ctx.organizacionId} and l.id = ${lineaId}
  `.execute(ctx.tx);
  return rows[0]?.hecho === true ? new Map([[lineaId, cantidad]]) : new Map();
}

/** Saca del almacén lo ya hecho, como merma «Por cancelación». Devuelve cuántos movimientos. */
async function registrar(
  ctx: Contexto,
  ordenId: string,
  hecho: ReadonlyMap<string, string>,
  referencia: { readonly tipo: 'orden' | 'anulacion'; readonly id: string },
  porque: string,
): Promise<number> {
  if (hecho.size === 0) return 0;
  const orden = await ctx.tx
    .selectFrom('ordenes')
    .select(['sucursal_id', 'canal'])
    .where('organizacion_id', '=', ctx.organizacionId)
    .where('id', '=', ordenId)
    .executeTakeFirst();
  if (orden?.sucursal_id == null) return 0;
  const plan = await planearConsumo(
    ctx.tx,
    ctx.organizacionId,
    orden.sucursal_id,
    ordenId,
    orden.canal,
    hecho,
  );
  const nota = `${NOTA_DE_LA_MERMA} · ${porque}`.slice(0, 300);
  const motivo = await motivoDeLaMerma(ctx.tx);
  for (const m of plan) {
    await sql`
      insert into existencias (organizacion_id, almacen_id, insumo_id, cantidad)
      values (${m.organizacionId}, ${m.almacenId}, ${m.insumoId}, 0)
      on conflict (almacen_id, insumo_id) do nothing
    `.execute(ctx.tx);
    await sql`
      update existencias
         set cantidad = cantidad - ${m.cantidad}::numeric, actualizado_en = now()
       where organizacion_id = ${m.organizacionId}
         and almacen_id = ${m.almacenId}
         and insumo_id = ${m.insumoId}
    `.execute(ctx.tx);
    await sql`
      insert into movimientos_stock (
        organizacion_id, almacen_id, insumo_id, tipo, cantidad, unidad, costo_unitario_centavos,
        referencia_tipo, referencia_id, motivo, nota, empleado_id
      )
      select ${m.organizacionId}, ${m.almacenId}, ${m.insumoId}, 'merma',
             -(${m.cantidad}::numeric), ${m.unidad}, i.costo_unitario_centavos,
             ${referencia.tipo}, ${referencia.id}, ${motivo}, ${nota}, ${ctx.empleoId}
        from insumos i
       where i.organizacion_id = ${m.organizacionId} and i.id = ${m.insumoId}
    `.execute(ctx.tx);
  }
  return plan.length;
}

/** DP-14.6-7 · Sin poder comprobar la cocina: TODO platillo vivo de la cuenta, entero. */
async function todoDeLaCuenta(ctx: Contexto, ordenId: string): Promise<Map<string, string>> {
  const filas = await ctx.tx
    .selectFrom('orden_lineas')
    .select(['id', 'cantidad'])
    .where('organizacion_id', '=', ctx.organizacionId)
    .where('orden_id', '=', ordenId)
    .where('anulada_en', 'is', null)
    .execute();
  return new Map(filas.map((f) => [f.id, f.cantidad]));
}

/**
 * Al cancelar la cuenta: lo hecho de cada platillo vivo (lo anulado aparte ya salió al anularse).
 * Con `todoComoHecho` (la cocina no se pudo comprobar y un gerente lo autorizó), todo lo vivo.
 */
export async function mermaDeLaCuentaCancelada(
  ctx: Contexto,
  ordenId: string,
  motivo: string,
  todoComoHecho = false,
): Promise<number> {
  const hecho = todoComoHecho
    ? await todoDeLaCuenta(ctx, ordenId)
    : await hechoDeLaCuenta(ctx, ordenId);
  return registrar(ctx, ordenId, hecho, { tipo: 'orden', id: ordenId }, motivo);
}

/** Al anular un platillo (o parte): si ya estaba hecho, lo que se anula. */
export async function mermaDelPlatilloAnulado(
  ctx: Contexto,
  datos: {
    readonly ordenId: string;
    readonly lineaId: string;
    readonly cantidad: string;
    readonly motivo: string;
  },
): Promise<number> {
  const hecho = await hechoDeLaLinea(ctx, datos.lineaId, datos.cantidad);
  return registrar(
    ctx,
    datos.ordenId,
    hecho,
    { tipo: 'anulacion', id: datos.lineaId },
    datos.motivo,
  );
}
