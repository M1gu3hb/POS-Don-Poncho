import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { cambiarDeMesa, mesaEnSala, type MesaEnSala } from './sala-escrituras.ts';
import {
  clasificarLasQueSeAgregan,
  type MesaPorAgregar,
  type LoQueSeAgrega,
} from './reglas-de-agregar.ts';
import {
  COORDENADA,
  MAXIMO_TECNICO,
  ROLES,
  cargarMiembros,
  exigirCuentaViva,
  guardarTotales,
  revisarElGrupo,
  type ResultadoUnion,
} from './union-de-mesas.ts';
import {
  anotarElMovimientoDeUnion,
  sumarMiembros,
  type MiembroPorUnir,
} from './union-escrituras.ts';
import { bloquearElGrupo } from './union-del-salon.ts';

/**
 * `restaurante.agregar_a_la_union` — DP-24 · P5, «unir mesas poco a poco».
 *
 * Don Poncho junta las mesas conforme llega la gente: hoy, dos; en media hora, otras dos. Unir
 * rechazaba cualquier mesa que ya estuviera en un grupo («Sepáralo antes de unir otro»), y el
 * mesero tenía que separar y volver a unir todo. Ahora a un grupo vivo se le AGREGAN mesas, las
 * veces que haga falta.
 *
 * ── UN solo camino ─────────────────────────────────────────────────────────
 * Es la misma unión: lo que se agrega entra por `sumarMiembros`, el núcleo que también usa
 * `restaurante.unir_mesas` (su cuenta, sus comandas, sus avisos y sus alergias pasan a la
 * principal de la PRIMERA unión; nada se copia). Lo único nuevo es qué hacer con una mesa que ya
 * está en un grupo:
 *   · si la mesa es la PRINCIPAL de otro grupo, entra TODO ese grupo: su cuenta se absorbe como
 *     la de cualquier mesa y sus mesas pasan a ser miembros de éste (el otro grupo se cierra sin
 *     separar a nadie: nadie se levanta de su silla);
 *   · una mesa absorbida en otro grupo no entra sola: se agrega su principal.
 * Las reglas de «qué mesa es qué» son puras (`reglas-de-agregar.ts`).
 *
 * ── Qué cuentas entran ─────────────────────────────────────────────────────
 * Las mismas que al unir: cuentas vivas (de nuevas a «cuenta pedida»). Una cuenta ya cobrada, dividida o
 * cancelada no se absorbe; y si la cuenta del GRUPO ya se cobró, no se le agrega nada (la mesa está
 * en limpieza: se marca libre primero).
 *
 * ── Lo de siempre se queda igual ───────────────────────────────────────────
 * Separar devuelve cada mesa libre a su lugar (las que venían de otro grupo también: separar
 * deshace TODO el grupo, no la última ampliación); la cuenta se queda en la principal; el grupo
 * se cobra una vez.
 */

const POSICION = z.object({ mesaId: z.uuid(), x: COORDENADA, y: COORDENADA }).strict();

export const entradaAgregarALaUnion = z.object({
  unionId: z.uuid(),
  mesaIds: z.array(z.uuid()).min(1).max(MAXIMO_TECNICO),
  /**
   * Dónde quedan en el plano las mesas que entran (las de otro grupo, con todas las suyas). Sin
   * esto cuentan donde ya están, y el perímetro del grupo se revisa igual que al unir.
   */
  posiciones: z
    .array(POSICION)
    .max(MAXIMO_TECNICO * 2)
    .optional(),
});

export interface ResultadoAgregado extends ResultadoUnion {
  readonly mesasAgregadas: number;
  readonly gruposAbsorbidos: number;
}

interface UnionViva {
  readonly id: string;
  readonly mesaPrincipalId: string;
  readonly ordenId: string | null;
  readonly sucursalId: string;
  readonly principalXOriginal: number | null;
  readonly principalYOriginal: number | null;
}

interface GrupoAjeno {
  readonly union: UnionViva;
  readonly mesaId: string;
  readonly miembrosIds: readonly string[];
}

export const agregarALaUnionComando = definirComando<
  Transaccion,
  typeof entradaAgregarALaUnion,
  ResultadoAgregado
>({
  nombre: 'restaurante.agregar_a_la_union',
  entidad: 'mesa',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: {
    unionId: 'uniones_mesa',
    'mesaIds[]': 'mesas',
    'posiciones[].mesaId': 'mesas',
  },
  modulo: 'mesas',
  entrada: entradaAgregarALaUnion,
  async ejecutar(ctx, entrada) {
    const { organizacionId, empleoId } = ctx.ambito;
    const { tx } = ctx;

    const union = await ctx.paso('cargar_grupo', () =>
      unionViva(tx, organizacionId, entrada.unionId),
    );
    const actuales = await ctx.paso('miembros_actuales', () => idsDeMiembros(tx, union.id));
    const que = await ctx.paso('clasificar', () =>
      queSeAgrega(tx, organizacionId, union, entrada.mesaIds),
    );
    const ajenos = await ctx.paso('grupos_ajenos', () => gruposAjenos(tx, organizacionId, que));

    const absorbidasDeOtros = ajenos.flatMap((g) => g.miembrosIds);
    const aAgregar = [...que.sueltas, ...ajenos.map((g) => g.mesaId), ...absorbidasDeOtros];
    const delGrupo = [union.mesaPrincipalId, ...actuales, ...aAgregar];
    if (entrada.posiciones?.some((p) => !delGrupo.includes(p.mesaId)) === true) {
      throw new ErrorDominio(
        'UNION_DE_MESAS_INVALIDA',
        'Sólo se acomodan las mesas que se están uniendo.',
      );
    }

    await ctx.paso('bloquear_el_grupo', () =>
      bloquearElGrupo(tx, organizacionId, union.mesaPrincipalId, [...actuales, ...aAgregar]),
    );
    // Con el candado, el grupo no cambió por debajo: se vuelve a mirar si sigue abierto.
    await ctx.paso('sigue_abierto', () => unionViva(tx, organizacionId, union.id));

    let principal = await ctx.paso('cargar_principal', () =>
      mesaEnSala(tx, organizacionId, union.mesaPrincipalId),
    );
    await ctx.paso('mirar_la_principal', () => exigirGrupoVivo(tx, organizacionId, principal));

    const sueltas = await ctx.paso('cargar_sueltas', () =>
      cargarMiembros(tx, organizacionId, principal, que.sueltas),
    );
    const principalesAjenas = await ctx.paso('cargar_principales_ajenas', () =>
      cargarPrincipalesAjenas(tx, organizacionId, principal, ajenos),
    );
    let miembros: readonly MiembroPorUnir[] = [...sueltas, ...principalesAjenas];

    const originales = new Map(
      await ctx.paso('revisar_el_grupo', () =>
        revisarElGrupo(tx, organizacionId, delGrupo, entrada.posiciones),
      ),
    );
    // La principal de otro grupo vuelve, al separar, a donde estaba ANTES de unir ese grupo.
    for (const g of ajenos) {
      const x = g.union.principalXOriginal;
      const y = g.union.principalYOriginal;
      if (x !== null && y !== null) originales.set(g.mesaId, { x, y });
    }

    const personasQueEntran = miembros.reduce((suma, m) => suma + m.mesa.personas, 0);
    const personasDeAntes = principal.personas;

    // El grupo todavía no tiene cuenta y una mesa que entra sí: esa cuenta se muda a la principal
    // (igual que al unir).
    const conCuenta = miembros.find((m) => m.ordenId !== null);
    if (principal.ordenActivaId === null && conCuenta?.ordenId != null) {
      const ordenMudada = conCuenta.ordenId;
      await ctx.paso('mudar_cuenta_a_la_principal', () =>
        cambiarDeMesa(tx, {
          organizacionId,
          ordenId: ordenMudada,
          origen: conCuenta.mesa,
          destino: principal,
          empleadoId: empleoId,
          ahora: ctx.ahora,
        }),
      );
      principal = await mesaEnSala(tx, organizacionId, principal.id);
      const vacia = await mesaEnSala(tx, organizacionId, conCuenta.mesa.id);
      miembros = miembros.map((m) => (m.mesa.id === vacia.id ? { mesa: vacia, ordenId: null } : m));
    }
    const ordenPrincipalId = principal.ordenActivaId;

    for (const g of ajenos) {
      await ctx.paso(`absorber_el_grupo_${g.mesaId}`, () =>
        fundirElGrupo(
          tx,
          { organizacionId, destino: union.id, principal, g },
          {
            empleadoId: empleoId,
            ahora: ctx.ahora,
          },
        ),
      );
    }

    const sumados = await ctx.paso('agregar', () =>
      sumarMiembros(tx, {
        organizacionId,
        unionId: union.id,
        principal,
        ordenPrincipalId,
        miembros,
        empleadoId: empleoId,
        ahora: ctx.ahora,
        originales,
      }),
    );

    await ctx.paso('fijar_cuenta_y_gente', () =>
      fijarLaCuentaYLaGente(tx, {
        organizacionId,
        union,
        ordenPrincipalId,
        personas: personasDeAntes + personasQueEntran,
        ahora: ctx.ahora,
      }),
    );

    for (const { mesaId, x, y } of entrada.posiciones ?? []) {
      await ctx.paso(`acomodar_${mesaId}`, () =>
        tx
          .updateTable('mesas')
          .set({ posicion_x: x, posicion_y: y })
          .where('organizacion_id', '=', organizacionId)
          .where('id', '=', mesaId)
          .execute(),
      );
    }

    const totalCentavos =
      ordenPrincipalId === null
        ? 0n
        : await ctx.paso('recalcular_totales', () =>
            guardarTotales(tx, organizacionId, ordenPrincipalId, ctx.ahora),
          );
    if (ordenPrincipalId !== null) {
      await ctx.paso('anotar_el_movimiento', () =>
        anotarElMovimientoDeUnion(
          tx,
          { organizacionId, principal, miembros, empleadoId: empleoId, ahora: ctx.ahora },
          ordenPrincipalId,
        ),
      );
    }

    ctx.auditar({
      entidadId: principal.id,
      payload: {
        unionId: union.id,
        mesaPrincipal: principal.numero,
        mesas: miembros.map((m) => m.mesa.numero),
        gruposAbsorbidos: ajenos.length,
        cuentasAbsorbidas: sumados.cuentasAbsorbidas,
        lineasMovidas: sumados.lineasMovidas,
        totalCentavos: totalCentavos.toString(),
      },
    });

    return {
      unionId: union.id,
      ordenPrincipalId,
      mesasUnidas: miembros.length,
      mesasAgregadas: miembros.length,
      gruposAbsorbidos: ajenos.length,
      cuentasAbsorbidas: sumados.cuentasAbsorbidas,
      lineasMovidas: sumados.lineasMovidas,
      totalCentavos: totalCentavos.toString(),
    };
  },
});

async function unionViva(
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

async function idsDeMiembros(tx: Transaccion, unionId: string): Promise<readonly string[]> {
  const filas = await tx
    .selectFrom('union_mesa_miembros')
    .select('mesa_id')
    .where('union_id', '=', unionId)
    .execute();
  return filas.map((f) => f.mesa_id);
}

/** Lee las mesas pedidas y las clasifica con las reglas puras; un rechazo se lanza tal cual. */
async function queSeAgrega(
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

async function gruposAjenos(
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
async function exigirGrupoVivo(
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
async function cargarPrincipalesAjenas(
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
async function fundirElGrupo(
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
async function fijarLaCuentaYLaGente(
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
