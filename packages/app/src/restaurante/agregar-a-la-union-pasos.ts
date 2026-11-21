import 'server-only';

import { ErrorDominio } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';

import { mesaEnSala, type MesaEnSala } from './sala-escrituras.ts';
import {
  clasificarLasQueSeAgregan,
  type LoQueSeAgrega,
  type MesaPorAgregar,
} from './reglas-de-agregar.ts';
import { exigirCuentaViva } from './union-comun.ts';
import type { MiembroPorUnir } from './union-escrituras.ts';

/**
 * LOS PASOS DE `restaurante.agregar_a_la_union` (DP-24 · P5): leer el grupo y lo que se le agrega,
 * y las dos escrituras propias de agregar (fundir otro grupo en éste, fijar la cuenta y la gente).
 * El comando y su orden de pasos están en `agregar-a-la-union.ts`.
 */

export interface UnionViva {
  readonly id: string;
  readonly mesaPrincipalId: string;
  readonly ordenId: string | null;
  readonly sucursalId: string;
  readonly principalXOriginal: number | null;
  readonly principalYOriginal: number | null;
}

export interface GrupoAjeno {
  readonly union: UnionViva;
  readonly mesaId: string;
  readonly miembrosIds: readonly string[];
}

export async function unionViva(
  tx: Transaccion,
  organizacionId: string,
  unionId: string,
): Promise<UnionViva> {
  const fila = await tx
    .selectFrom('uniones_mesa')
    .select([
      'id',
      'mesa_principal_id',
      'orden_id',
      'sucursal_id',
      'cerrada_en',
      'principal_x_original',
      'principal_y_original',
    ])
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', unionId)
    .executeTakeFirst();
  if (fila === undefined) {
    throw new ErrorDominio('MESA_NO_ENCONTRADA', 'Ese grupo de mesas no existe en este negocio.');
  }
  if (fila.cerrada_en !== null) {
    throw new ErrorDominio('MESA_NO_LIBERABLE', 'Ese grupo de mesas ya estaba separado.');
  }
  return {
    id: fila.id,
    mesaPrincipalId: fila.mesa_principal_id,
    ordenId: fila.orden_id,
    sucursalId: fila.sucursal_id,
    principalXOriginal: fila.principal_x_original,
    principalYOriginal: fila.principal_y_original,
  };
}

export async function idsDeMiembros(tx: Transaccion, unionId: string): Promise<readonly string[]> {
  const filas = await tx
    .selectFrom('union_mesa_miembros')
    .select('mesa_id')
    .where('union_id', '=', unionId)
    .execute();
  return filas.map((f) => f.mesa_id);
}

/** Lee las mesas pedidas y las clasifica con las reglas puras; un rechazo se lanza tal cual. */
export async function queSeAgrega(
  tx: Transaccion,
  organizacionId: string,
  union: UnionViva,
  pedidas: readonly string[],
): Promise<LoQueSeAgrega> {
  const filas = await tx
    .selectFrom('mesas')
    .select(['id', 'numero', 'estado', 'sucursal_id', 'unida_a_mesa_id', 'activa'])
    .where('organizacion_id', '=', organizacionId)
    .where('id', 'in', [...pedidas])
    .execute();
  const principales = [
    ...new Set(filas.flatMap((f) => (f.unida_a_mesa_id === null ? [] : [f.unida_a_mesa_id]))),
  ];
  const deQuien =
    principales.length === 0
      ? []
      : await tx
          .selectFrom('mesas')
          .select(['id', 'numero'])
          .where('organizacion_id', '=', organizacionId)
          .where('id', 'in', principales)
          .execute();
  const encabezan = await tx
    .selectFrom('uniones_mesa')
    .select(['id', 'mesa_principal_id'])
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_principal_id', 'in', [...pedidas])
    .where('cerrada_en', 'is', null)
    .execute();
  const mesas: MesaPorAgregar[] = filas
    .filter((f) => f.activa)
    .map((f) => ({
      id: f.id,
      numero: f.numero,
      estado: f.estado,
      sucursalId: f.sucursal_id,
      unidaA:
        f.unida_a_mesa_id === null
          ? null
          : {
              id: f.unida_a_mesa_id,
              numero: deQuien.find((q) => q.id === f.unida_a_mesa_id)?.numero ?? 0,
            },
      encabezaUnionId: encabezan.find((e) => e.mesa_principal_id === f.id)?.id ?? null,
    }));
  const clasificacion = clasificarLasQueSeAgregan(
    { principalId: union.mesaPrincipalId, sucursalId: union.sucursalId },
    pedidas,
    mesas,
  );
  if (clasificacion.rechazo !== null) {
    throw new ErrorDominio(clasificacion.rechazo.codigo, clasificacion.rechazo.mensaje);
  }
  return clasificacion.agrega;
}

export async function gruposAjenos(
  tx: Transaccion,
  organizacionId: string,
  que: LoQueSeAgrega,
): Promise<readonly GrupoAjeno[]> {
  const salida: GrupoAjeno[] = [];
  for (const { mesaId, unionId } of que.principalesDeOtros) {
    const union = await unionViva(tx, organizacionId, unionId);
    salida.push({ union, mesaId, miembrosIds: await idsDeMiembros(tx, unionId) });
  }
  return salida;
}

/** El grupo al que se agrega tiene que seguir vivo: sin limpieza y con su cuenta por cobrar. */
export async function exigirGrupoVivo(
  tx: Transaccion,
  organizacionId: string,
  principal: MesaEnSala,
): Promise<void> {
  if (principal.estado === 'limpieza') {
    throw new ErrorDominio(
      'UNION_DE_MESAS_INVALIDA',
      `La mesa ${String(principal.numero)} está en limpieza: márcala libre primero.`,
    );
  }
  if (principal.ordenActivaId !== null) {
    await exigirCuentaViva(tx, organizacionId, principal.ordenActivaId, principal.numero);
  }
}

/** Las principales de otros grupos: su cuenta (la de todo su grupo) tiene que poder absorberse. */
export async function cargarPrincipalesAjenas(
  tx: Transaccion,
  organizacionId: string,
  principal: MesaEnSala,
  ajenos: readonly GrupoAjeno[],
): Promise<readonly MiembroPorUnir[]> {
  const salida: MiembroPorUnir[] = [];
  for (const g of ajenos) {
    const mesa = await mesaEnSala(tx, organizacionId, g.mesaId);
    if (mesa.sucursalId !== principal.sucursalId) {
      throw new ErrorDominio(
        'MESA_NO_ENCONTRADA',
        `La mesa ${String(mesa.numero)} es de otra sucursal: no se puede juntar con ésta.`,
      );
    }
    if (mesa.ordenActivaId !== null) {
      await exigirCuentaViva(tx, organizacionId, mesa.ordenActivaId, mesa.numero);
    }
    salida.push({ mesa, ordenId: mesa.ordenActivaId });
  }
  return salida;
}

/**
 * El otro grupo se funde en éste sin separar a nadie: sus miembros pasan a ser de esta unión, y
 * su unión se cierra. Se cierra DESPUÉS de mover a los miembros: el trigger de la 071 apaga
 * `union_abierta` en los que sigan colgando de la unión que se cierra.
 */
export async function fundirElGrupo(
  tx: Transaccion,
  d: {
    readonly organizacionId: string;
    readonly destino: string;
    readonly principal: MesaEnSala;
    readonly g: GrupoAjeno;
  },
  quien: { readonly empleadoId: string; readonly ahora: Date },
): Promise<void> {
  const { organizacionId, g } = d;
  await tx
    .updateTable('union_mesa_miembros')
    .set({ union_id: d.destino })
    .where('union_id', '=', g.union.id)
    .execute();
  await tx
    .updateTable('mesas')
    .set({ unida_a_mesa_id: d.principal.id, estado: d.principal.estado })
    .where('organizacion_id', '=', organizacionId)
    .where('unida_a_mesa_id', '=', g.mesaId)
    .execute();
  await tx
    .updateTable('ordenes')
    .set({ union_id: d.destino, updated_at: quien.ahora })
    .where('organizacion_id', '=', organizacionId)
    .where('union_id', '=', g.union.id)
    .execute();
  const cerrada = await tx
    .updateTable('uniones_mesa')
    .set({ cerrada_en: quien.ahora, empleado_cierra_id: quien.empleadoId })
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', g.union.id)
    .where('cerrada_en', 'is', null)
    .executeTakeFirst();
  if (Number(cerrada.numUpdatedRows) !== 1) {
    throw new ErrorDominio('MESA_NO_LIBERABLE', 'Ese grupo cambió mientras se agregaba.');
  }
}

/** La unión toma la cuenta si no la tenía, y la principal recibe a toda la gente. */
export async function fijarLaCuentaYLaGente(
  tx: Transaccion,
  d: {
    readonly organizacionId: string;
    readonly union: UnionViva;
    readonly ordenPrincipalId: string | null;
    readonly personas: number;
    readonly ahora: Date;
  },
): Promise<void> {
  if (d.ordenPrincipalId !== null) {
    if (d.union.ordenId !== d.ordenPrincipalId) {
      await tx
        .updateTable('uniones_mesa')
        .set({ orden_id: d.ordenPrincipalId })
        .where('organizacion_id', '=', d.organizacionId)
        .where('id', '=', d.union.id)
        .execute();
    }
    await tx
      .updateTable('ordenes')
      .set({ union_id: d.union.id, updated_at: d.ahora })
      .where('organizacion_id', '=', d.organizacionId)
      .where('id', '=', d.ordenPrincipalId)
      .execute();
  }
  await tx
    .updateTable('mesas')
    .set({ personas_actuales: d.personas })
    .where('organizacion_id', '=', d.organizacionId)
    .where('id', '=', d.union.mesaPrincipalId)
    .execute();
}

/** Lo que se lee del grupo y de lo que se le agrega, para decidir qué se bloquea y qué se mueve. */
export interface LoQueSeLee {
  readonly union: UnionViva;
  readonly actuales: readonly string[];
  readonly que: LoQueSeAgrega;
  readonly ajenos: readonly GrupoAjeno[];
  /** Las mesas que entran: sueltas, principales de otros grupos y las mesas de esos grupos. */
  readonly aAgregar: readonly string[];
  /** Todas las mesas del grupo ya con lo que entra: es lo que se revisa en el plano. */
  readonly delGrupo: readonly string[];
  /** Lo que el candado tiene que cubrir (la principal se bloquea siempre). */
  readonly aBloquear: readonly string[];
}

/**
 * Se lee el grupo y se clasifica lo pedido. Se hace DOS veces: antes del candado, sólo para saber
 * qué bloquear, y con el candado puesto, que es la lectura que vale: mientras se esperaba el
 * candado otro mesero pudo agregar mesas a este grupo o al ajeno, y revisar el plano sin ellas
 * dejaba pasar a dos que juntos se pasaban del perímetro.
 */
export async function leerLoQueSeAgrega(
  tx: Transaccion,
  organizacionId: string,
  unionId: string,
  pedidas: readonly string[],
): Promise<LoQueSeLee> {
  const union = await unionViva(tx, organizacionId, unionId);
  const actuales = await idsDeMiembros(tx, union.id);
  const que = await queSeAgrega(tx, organizacionId, union, pedidas);
  const ajenos = await gruposAjenos(tx, organizacionId, que);
  const aAgregar = [
    ...que.sueltas,
    ...ajenos.map((g) => g.mesaId),
    ...ajenos.flatMap((g) => g.miembrosIds),
  ];
  return {
    union,
    actuales,
    que,
    ajenos,
    aAgregar,
    delGrupo: [union.mesaPrincipalId, ...actuales, ...aAgregar],
    aBloquear: [...actuales, ...aAgregar],
  };
}
