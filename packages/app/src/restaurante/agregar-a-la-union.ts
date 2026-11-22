import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando, type ContextoComando } from '../definicion.ts';
import {
  cargarPrincipalesAjenas,
  exigirGrupoVivo,
  fijarLaCuentaYLaGente,
  fundirElGrupo,
  leerLoQueSeAgrega,
} from './agregar-a-la-union-pasos.ts';
import { cambiarDeMesa, mesaEnSala } from './sala-escrituras.ts';
import {
  COORDENADA,
  MAXIMO_TECNICO,
  ROLES,
  cargarMiembros,
  guardarTotales,
  revisarElGrupo,
  type ResultadoUnion,
} from './union-comun.ts';
import {
  anotarElMovimientoDeUnion,
  cuentasQuePasaron,
  marcarDeDondeVienen,
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
 *
 * ── DP-25 · P6 ─────────────────────────────────────────────────────────────
 * «Unir mesas» con una mesa que ya está en un grupo llama a este mismo cuerpo
 * (`unir-con-un-grupo-vivo.ts`); lo leído del grupo se vuelve a leer CON el candado puesto, porque
 * otro mesero pudo agregar mesas mientras se esperaba; y cada renglón y cada comanda que entran
 * dicen de qué mesa vienen / a qué mesa se cobran.
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

export type EntradaAgregarALaUnion = z.infer<typeof entradaAgregarALaUnion>;

export interface ResultadoAgregado extends ResultadoUnion {
  readonly mesasAgregadas: number;
  readonly gruposAbsorbidos: number;
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
  ejecutar: agregarALaUnion,
});

/**
 * El candado del grupo, y la lectura que vale: la de DESPUÉS de tenerlo. Si al releer aparecen
 * mesas que el candado no cubría (otro mesero las agregó mientras se esperaba) se bloquean
 * también; con las principales bloqueadas, el grupo ya no cambia hasta terminar.
 */
async function leerConElCandado(
  ctx: ContextoComando<Transaccion>,
  entrada: EntradaAgregarALaUnion,
) {
  const { organizacionId } = ctx.ambito;
  const { tx } = ctx;
  const leer = () => leerLoQueSeAgrega(tx, organizacionId, entrada.unionId, entrada.mesaIds);
  const antes = await ctx.paso('leer_el_grupo', leer);
  const principalId = antes.union.mesaPrincipalId;
  await ctx.paso('bloquear_el_grupo', () =>
    bloquearElGrupo(tx, organizacionId, principalId, antes.aBloquear),
  );
  const hoy = await ctx.paso('releer_el_grupo', leer);
  const cubiertas = new Set([principalId, ...antes.aBloquear]);
  const sinCandado = hoy.aBloquear.filter((id) => !cubiertas.has(id));
  if (sinCandado.length === 0) return hoy;
  await ctx.paso('bloquear_lo_que_aparecio', () =>
    bloquearElGrupo(tx, organizacionId, principalId, sinCandado),
  );
  const otraVez = await ctx.paso('releer_otra_vez', leer);
  const cubiertasAhora = new Set([...cubiertas, ...sinCandado]);
  if (otraVez.aBloquear.some((id) => !cubiertasAhora.has(id))) {
    throw new ErrorDominio(
      'MESA_NO_LIBERABLE',
      'Ese grupo cambió mientras se agregaba: vuelve a intentarlo.',
    );
  }
  return otraVez;
}

/**
 * El cuerpo de agregar, aparte del comando: `restaurante.unir_mesas` lo llama cuando alguna de las
 * mesas que se unen ya está en un grupo (DP-25 · P6, DP-D226): es la misma operación.
 */
export async function agregarALaUnion(
  ctx: ContextoComando<Transaccion>,
  entrada: EntradaAgregarALaUnion,
): Promise<ResultadoAgregado> {
  const { organizacionId, empleoId } = ctx.ambito;
  const { tx } = ctx;

  const hoy = await leerConElCandado(ctx, entrada);
  const { union, ajenos, que } = hoy;
  if (entrada.posiciones?.some((p) => !hoy.delGrupo.includes(p.mesaId)) === true) {
    throw new ErrorDominio(
      'UNION_DE_MESAS_INVALIDA',
      'Sólo se acomodan las mesas que se están uniendo.',
    );
  }

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
  const avisos = cuentasQuePasaron(miembros, principal);

  const originales = new Map(
    await ctx.paso('revisar_el_grupo', () =>
      revisarElGrupo(tx, organizacionId, hoy.delGrupo, entrada.posiciones),
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
    await ctx.paso('marcar_de_donde_vienen', () =>
      marcarDeDondeVienen(tx, organizacionId, ordenMudada, conCuenta.mesa.numero),
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
        { empleadoId: empleoId, ahora: ctx.ahora },
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
    cuentasQuePasaron: avisos,
  };
}
