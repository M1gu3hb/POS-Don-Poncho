import 'server-only';

import type { Transaccion } from '@morphiqpos/data';

/**
 * LOS CANDADOS DE LA COCINA, SIEMPRE EN EL MISMO ORDEN (H2, DP-22).
 *
 * ── El defecto que cierra ──────────────────────────────────────────────────
 * A12 de la semana simulada: la estación tocó «Preparar» mientras el mesero quitaba un platillo de
 * la misma cuenta y Postgres abortó una de las dos con 40P01 (interbloqueo). «Preparar» tomaba, sin
 * pedirlos, la comanda y luego sus platos y sus líneas de venta; «quitar un platillo» tomaba la
 * cuenta, luego la línea, luego los platos y al final la comanda. Cada una esperaba lo que la otra
 * ya tenía. Se parchó con un reintento (`comando.ts`); aquí se quita la causa.
 *
 * ── El orden, para TODO comando que escriba comandas, platos o líneas ──────
 *
 *     1. `ordenes`        por id ascendente   (la cuenta; con ella basta para serializar la cuenta)
 *     2. `comandas`       por id ascendente
 *     3. `comanda_items`  por id ascendente
 *     4. `orden_lineas`   por id ascendente
 *     5. lo demás         (`mesas`, `existencias`, … ) ya con todo lo anterior en la mano
 *
 * Se toman TODOS al principio, con `select … order by id for update`: Postgres bloquea las filas en
 * el orden en que las devuelve, así que dos comandos que quieran el mismo conjunto lo recorren en
 * la misma dirección y uno espera al otro en vez de cruzarse. Tomar de más (los platos hermanos de
 * una comanda) es barato: son unas pocas filas de una cuenta que ya estaba tomada.
 *
 * El reintento de `comando.ts` se queda como red de seguridad; `reintentosPorConcurrencia()` lo
 * cuenta y las pruebas de este orden exigen que valga 0.
 */

/** Qué comandas de la cuenta (o cuentas) se toman. */
export type ComandasPorTomar =
  /** Esas comandas, por id. */
  | { readonly de: 'ids'; readonly ids: readonly string[] }
  /** Todas las que cuelgan de las cuentas por bloquear. */
  | { readonly de: 'las-cuentas' }
  /** Las que tienen platos de esas líneas de venta. */
  | { readonly de: 'las-lineas'; readonly lineaIds: readonly string[] }
  /** Las que tienen platos de CUALQUIER línea de esa cuenta (una parte de una cuenta dividida). */
  | { readonly de: 'las-lineas-de-la-cuenta'; readonly ordenId: string };

export interface AlcanceDeCandados {
  readonly organizacionId: string;
  /** Las cuentas del paso 1. Se ordenan aquí: quien llama no tiene que ordenarlas. */
  readonly ordenIds: readonly string[];
  readonly comandas: ComandasPorTomar;
  /** Líneas de venta que se tocarán aunque no tengan plato en las comandas tomadas. */
  readonly lineaIds?: readonly string[];
  /** Cuentas cuyas líneas de venta se tocarán TODAS (cancelar la cuenta). */
  readonly lineasDeLasCuentas?: readonly string[];
}

const sinRepetir = (ids: readonly string[]): string[] => [...new Set(ids)].sort();

/** Toma, en el orden de arriba, todo lo que el comando va a escribir en la cocina de la cuenta. */
export async function tomarCandadosDeCocina(
  tx: Transaccion,
  alcance: AlcanceDeCandados,
): Promise<void> {
  const { organizacionId } = alcance;
  const cuentas = sinRepetir(alcance.ordenIds);

  // 1 · La cuenta.
  if (cuentas.length > 0) {
    await tx
      .selectFrom('ordenes')
      .select('id')
      .where('organizacion_id', '=', organizacionId)
      .where('id', 'in', cuentas)
      .orderBy('id')
      .forUpdate()
      .execute();
  }

  // 2 · Las comandas.
  const comandaIds = await bloquearComandas(tx, alcance, cuentas);

  // 3 · Sus platos.
  const lineasDeLosPlatos: string[] = [];
  if (comandaIds.length > 0) {
    const platos = await tx
      .selectFrom('comanda_items')
      .select(['id', 'orden_linea_id'])
      .where('organizacion_id', '=', organizacionId)
      .where('comanda_id', 'in', comandaIds)
      .orderBy('id')
      .forUpdate()
      .execute();
    for (const plato of platos) {
      if (plato.orden_linea_id !== null) lineasDeLosPlatos.push(plato.orden_linea_id);
    }
  }

  // 4 · Las líneas de venta: las de esos platos, las pedidas y las de las cuentas indicadas.
  const lineaIds = sinRepetir([...lineasDeLosPlatos, ...(alcance.lineaIds ?? [])]);
  const cuentasDeLasLineas = sinRepetir(alcance.lineasDeLasCuentas ?? []);
  if (lineaIds.length === 0 && cuentasDeLasLineas.length === 0) return;
  await tx
    .selectFrom('orden_lineas')
    .select('id')
    .where('organizacion_id', '=', organizacionId)
    .where((eb) =>
      eb.or([
        ...(lineaIds.length > 0 ? [eb('id', 'in', lineaIds)] : []),
        ...(cuentasDeLasLineas.length > 0 ? [eb('orden_id', 'in', cuentasDeLasLineas)] : []),
      ]),
    )
    .orderBy('id')
    .forUpdate()
    .execute();
}

async function bloquearComandas(
  tx: Transaccion,
  alcance: AlcanceDeCandados,
  cuentas: readonly string[],
): Promise<string[]> {
  const { organizacionId, comandas } = alcance;
  const consulta = tx
    .selectFrom('comandas')
    .select('id')
    .where('organizacion_id', '=', organizacionId);

  let filas: { readonly id: string }[];
  switch (comandas.de) {
    case 'ids': {
      if (comandas.ids.length === 0) return [];
      filas = await consulta
        .where('id', 'in', sinRepetir(comandas.ids))
        .orderBy('id')
        .forUpdate()
        .execute();
      break;
    }
    case 'las-cuentas': {
      if (cuentas.length === 0) return [];
      filas = await consulta.where('orden_id', 'in', cuentas).orderBy('id').forUpdate().execute();
      break;
    }
    case 'las-lineas': {
      if (comandas.lineaIds.length === 0) return [];
      filas = await consulta
        .where('id', 'in', (eb) =>
          eb
            .selectFrom('comanda_items')
            .select('comanda_id')
            .where('organizacion_id', '=', organizacionId)
            .where('orden_linea_id', 'in', sinRepetir(comandas.lineaIds)),
        )
        .orderBy('id')
        .forUpdate()
        .execute();
      break;
    }
    case 'las-lineas-de-la-cuenta': {
      filas = await consulta
        .where('id', 'in', (eb) =>
          eb
            .selectFrom('comanda_items as ci')
            .innerJoin('orden_lineas as ol', 'ol.id', 'ci.orden_linea_id')
            .select('ci.comanda_id')
            .where('ci.organizacion_id', '=', organizacionId)
            .where('ol.organizacion_id', '=', organizacionId)
            .where('ol.orden_id', '=', comandas.ordenId),
        )
        .orderBy('id')
        .forUpdate()
        .execute();
      break;
    }
  }
  return filas.map((fila) => fila.id);
}

/**
 * La cuenta y las que absorbió al unir mesas: sus LÍNEAS pasaron a la cuenta, pero cada comanda
 * sigue colgada de la absorbida. Cancelar la cuenta toma las dos.
 */
export async function cuentaYSusAbsorbidas(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
): Promise<string[]> {
  const absorbidas = await tx
    .selectFrom('union_mesa_miembros')
    .innerJoin('uniones_mesa', 'uniones_mesa.id', 'union_mesa_miembros.union_id')
    .select('union_mesa_miembros.orden_absorbida_id as ordenId')
    .where('uniones_mesa.organizacion_id', '=', organizacionId)
    .where('uniones_mesa.orden_id', '=', ordenId)
    .where('union_mesa_miembros.orden_absorbida_id', 'is not', null)
    .execute();
  return sinRepetir([
    ordenId,
    ...absorbidas.flatMap((fila) => (fila.ordenId === null ? [] : [fila.ordenId])),
  ]);
}
