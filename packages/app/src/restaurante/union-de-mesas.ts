import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { aDondeVaLaUnion, type MesaDeLaUnion } from './unir-con-un-grupo-vivo.ts';
import { agregarALaUnion } from './agregar-a-la-union.ts';
import { cambiarDeMesa, mesaEnSala, separarMesas, unionAbiertaDeMesa } from './sala-escrituras.ts';
import {
  COORDENADA,
  MAXIMO_TECNICO,
  ROLES,
  cargarMiembros,
  exigirCuentaViva,
  guardarTotales,
  revisarElGrupo,
  type ResultadoUnion,
} from './union-comun.ts';
import { cuentasQuePasaron, marcarDeDondeVienen, unirMesas } from './union-escrituras.ts';
import { loQueSeQuedaEnLaPrincipal, type LoQueSeQueda } from './al-separar.ts';
import { bloquearElGrupo } from './union-del-salon.ts';

export type { ResultadoUnion } from './union-comun.ts';

/**
 * `restaurante.unir_mesas` y `restaurante.separar_mesas` — F-302, y DP-9.6 (fase B).
 *
 * ── El dolor ───────────────────────────────────────────────────────────────
 * Llegan diez personas, se juntan físicamente las mesas 4 y 5, y el sistema
 * sigue viendo dos cuentas: el mesero comanda partido y la cuenta sale partida.
 *
 * ── DP-9.6: la unión es del SALÓN ──────────────────────────────────────────
 * Las mesas se juntan en el mapa —se arrastran, se atraen, se funden— y se elige
 * qué número queda (la principal). Sólo se unen mesas que quedaron pegadas y
 * dentro de un perímetro razonable (`revisarUnion`, la misma regla que usa la
 * pantalla): sin el tope de seis de antes, pero medio salón no. La unión puede
 * nacer sin cuenta y sobrevive al cobro; separar devuelve cada mesa a donde
 * estaba. Si la principal elegida no tiene cuenta y otra del grupo sí, esa
 * cuenta se muda primero a la principal.
 *
 * ── Unir es una operación de SALA, separar también ─────────────────────────
 * Ninguna de las dos mueve dinero fuera del negocio: el consumo es el mismo,
 * cambia de cuenta. Por eso el mesero puede.
 *
 * ── Lo que separar NO hace ─────────────────────────────────────────────────
 * No vuelve a repartir el consumo. Repartir por consumo es F-321 y es caja.
 */

export const entradaUnirMesas = z.object({
  mesaPrincipalId: z.uuid(),
  mesaIds: z.array(z.uuid()).min(1).max(MAXIMO_TECNICO),
  /**
   * DP-9.6 · Dónde quedó cada mesa del grupo en el plano al juntarlas (la principal incluida).
   * Sin esto, cuentan donde ya están.
   */
  posiciones: z
    .array(z.object({ mesaId: z.uuid(), x: COORDENADA, y: COORDENADA }).strict())
    .max(MAXIMO_TECNICO + 1)
    .optional(),
});

export const entradaSepararMesas = z.object({
  unionId: z.uuid(),
});

export interface ResultadoSeparacion extends LoQueSeQueda {
  readonly unionId: string;
  readonly ordenPrincipalId: string | null;
  readonly mesasLiberadas: number;
}

export const unirMesasComando = definirComando<
  Transaccion,
  typeof entradaUnirMesas,
  ResultadoUnion
>({
  nombre: 'restaurante.unir_mesas',
  entidad: 'mesa',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: {
    mesaPrincipalId: 'mesas',
    'mesaIds[]': 'mesas',
    'posiciones[].mesaId': 'mesas',
  },
  modulo: 'mesas',
  entrada: entradaUnirMesas,
  async ejecutar(ctx, entrada) {
    const { organizacionId, empleoId } = ctx.ambito;

    if (entrada.mesaIds.includes(entrada.mesaPrincipalId)) {
      throw new ErrorDominio(
        'MESA_YA_ABIERTA',
        'La mesa principal no se une a sí misma: es la que conserva la cuenta.',
      );
    }
    if (new Set(entrada.mesaIds).size !== entrada.mesaIds.length) {
      throw new ErrorDominio('MESA_YA_ABIERTA', 'Esa mesa viene repetida en el grupo.');
    }
    // DP-25 · P6: si alguna de las mesas YA está en un grupo, esto es agregar al grupo.
    const destino = await ctx.paso('mirar_si_ya_hay_grupo', async () =>
      aDondeVaLaUnion(
        entrada.mesaPrincipalId,
        entrada.mesaIds,
        await mesasDeLaUnion(ctx.tx, organizacionId, [entrada.mesaPrincipalId, ...entrada.mesaIds]),
      ),
    );
    if (destino.tipo === 'nada') throw new ErrorDominio('MESA_YA_ABIERTA', destino.mensaje);
    if (destino.tipo === 'agregar') {
      const posiciones = await ctx.paso('posiciones_de_lo_que_entra', () =>
        posicionesDeLoQueEntra(ctx.tx, organizacionId, destino.principalId, entrada.posiciones),
      );
      return agregarALaUnion(ctx, {
        unionId: destino.unionId,
        mesaIds: [...destino.mesaIds],
        ...(posiciones === undefined ? {} : { posiciones }),
      });
    }

    // Sólo se acomodan las mesas que se están uniendo: una posición ajena movería otra mesa
    // —de otra zona, o de otra sucursal— sin guardar dónde estaba.
    const delGrupo = new Set([entrada.mesaPrincipalId, ...entrada.mesaIds]);
    if (entrada.posiciones?.some((p) => !delGrupo.has(p.mesaId)) === true) {
      throw new ErrorDominio(
        'UNION_DE_MESAS_INVALIDA',
        'Sólo se acomodan las mesas que se están uniendo.',
      );
    }

    await ctx.paso('bloquear_el_grupo', () =>
      bloquearElGrupo(ctx.tx, organizacionId, entrada.mesaPrincipalId, entrada.mesaIds),
    );

    let principal = await ctx.paso('cargar_principal', () =>
      mesaEnSala(ctx.tx, organizacionId, entrada.mesaPrincipalId),
    );
    const yaUnida = await ctx.paso('mirar_grupo', () =>
      unionAbiertaDeMesa(ctx.tx, organizacionId, principal.id),
    );
    if (yaUnida !== null) {
      throw new ErrorDominio(
        'MESA_YA_ABIERTA',
        `La mesa ${String(principal.numero)} ya pertenece a un grupo. Sepáralo antes de unir otro.`,
      );
    }
    // Una principal ya cobrada (en limpieza conserva su cuenta pagada) no absorbe cuentas vivas:
    // lo de las demás caería en una cuenta que ya nadie va a cobrar.
    const cuentaDeLaPrincipal = principal.ordenActivaId;
    if (cuentaDeLaPrincipal !== null) {
      await ctx.paso('mirar_cuenta_de_la_principal', () =>
        exigirCuentaViva(ctx.tx, organizacionId, cuentaDeLaPrincipal, principal.numero),
      );
    }

    let miembros = await ctx.paso('cargar_miembros', () =>
      cargarMiembros(ctx.tx, organizacionId, principal, entrada.mesaIds),
    );
    const avisos = cuentasQuePasaron(miembros, principal);
    // DP-12.3: una mesa en limpieza no se une; se dice con su nombre y qué hacer.
    const enLimpieza = [principal, ...miembros.map((m) => m.mesa)].find(
      (m) => m.estado === 'limpieza',
    );
    if (enLimpieza !== undefined) {
      throw new ErrorDominio(
        'UNION_DE_MESAS_INVALIDA',
        `La mesa ${String(enLimpieza.numero)} está en limpieza: márcala libre primero.`,
      );
    }

    const originales = await ctx.paso('revisar_el_grupo', () =>
      revisarElGrupo(
        ctx.tx,
        organizacionId,
        [principal.id, ...entrada.mesaIds],
        entrada.posiciones,
      ),
    );

    // La principal elegida no tiene cuenta y otra del grupo sí: esa cuenta se muda a ella.
    const conCuenta = miembros.find((m) => m.ordenId !== null);
    if (principal.ordenActivaId === null && conCuenta?.ordenId != null) {
      const ordenMudada = conCuenta.ordenId;
      await ctx.paso('mudar_cuenta_a_la_principal', () =>
        cambiarDeMesa(ctx.tx, {
          organizacionId,
          ordenId: ordenMudada,
          origen: conCuenta.mesa,
          destino: principal,
          empleadoId: empleoId,
          ahora: ctx.ahora,
        }),
      );
      await ctx.paso('marcar_de_donde_vienen', () =>
        marcarDeDondeVienen(ctx.tx, organizacionId, ordenMudada, conCuenta.mesa.numero),
      );
      principal = await mesaEnSala(ctx.tx, organizacionId, principal.id);
      const vacia = await mesaEnSala(ctx.tx, organizacionId, conCuenta.mesa.id);
      miembros = miembros.map((m) => (m.mesa.id === vacia.id ? { mesa: vacia, ordenId: null } : m));
    }
    const ordenPrincipalId = principal.ordenActivaId;

    const escrito = await ctx.paso('unir', () =>
      unirMesas(ctx.tx, {
        organizacionId,
        principal,
        ordenPrincipalId,
        miembros,
        empleadoId: empleoId,
        ahora: ctx.ahora,
        originales,
      }),
    );

    if (entrada.posiciones !== undefined) {
      for (const { mesaId, x, y } of entrada.posiciones) {
        await ctx.paso(`acomodar_${mesaId}`, () =>
          ctx.tx
            .updateTable('mesas')
            .set({ posicion_x: x, posicion_y: y })
            .where('organizacion_id', '=', organizacionId)
            .where('id', '=', mesaId)
            .execute(),
        );
      }
    }

    const totalCentavos =
      ordenPrincipalId === null
        ? 0n
        : await ctx.paso('recalcular_totales', () =>
            guardarTotales(ctx.tx, organizacionId, ordenPrincipalId, ctx.ahora),
          );

    ctx.auditar({
      entidadId: principal.id,
      payload: {
        unionId: escrito.unionId,
        mesaPrincipal: principal.numero,
        mesas: miembros.map((m) => m.mesa.numero),
        cuentasAbsorbidas: escrito.cuentasAbsorbidas,
        lineasMovidas: escrito.lineasMovidas,
        totalCentavos: totalCentavos.toString(),
      },
    });

    return {
      unionId: escrito.unionId,
      ordenPrincipalId,
      mesasUnidas: miembros.length,
      cuentasAbsorbidas: escrito.cuentasAbsorbidas,
      lineasMovidas: escrito.lineasMovidas,
      totalCentavos: totalCentavos.toString(),
      cuentasQuePasaron: avisos,
    };
  },
});

/** Lo que `aDondeVaLaUnion` necesita saber de las mesas elegidas y de las principales de sus grupos. */
async function mesasDeLaUnion(
  tx: Transaccion,
  organizacionId: string,
  ids: readonly string[],
): Promise<readonly MesaDeLaUnion[]> {
  const filas = await tx
    .selectFrom('mesas')
    .select(['id', 'unida_a_mesa_id'])
    .where('organizacion_id', '=', organizacionId)
    .where('id', 'in', [...ids])
    .execute();
  const principales = [...new Set(filas.map((f) => f.unida_a_mesa_id ?? f.id))];
  const uniones = await tx
    .selectFrom('uniones_mesa')
    .select(['id', 'mesa_principal_id'])
    .where('organizacion_id', '=', organizacionId)
    .where('mesa_principal_id', 'in', principales)
    .where('cerrada_en', 'is', null)
    .execute();
  const encabeza = new Map(uniones.map((u) => [u.mesa_principal_id, u.id]));
  const elegidas = filas.map((f) => ({
    id: f.id,
    unidaAMesaId: f.unida_a_mesa_id,
    encabezaUnionId: encabeza.get(f.id) ?? null,
  }));
  const sueltas = principales
    .filter((p) => !elegidas.some((m) => m.id === p))
    .map((p) => ({ id: p, unidaAMesaId: null, encabezaUnionId: encabeza.get(p) ?? null }));
  return [...elegidas, ...sueltas];
}

/**
 * Al agregar al grupo que ya existe sólo se mueven las mesas que entran: las posiciones que el
 * plano mande de la principal del grupo y de sus mesas se descartan (la pantalla las dibuja como
 * una caja y no son las de cada mesa; moverlas rompería el lugar al que separar las regresa).
 */
async function posicionesDeLoQueEntra(
  tx: Transaccion,
  organizacionId: string,
  principalDelGrupoId: string,
  posiciones: z.infer<typeof entradaUnirMesas>['posiciones'],
): Promise<z.infer<typeof entradaUnirMesas>['posiciones']> {
  if (posiciones === undefined) return undefined;
  const miembros = await tx
    .selectFrom('mesas')
    .select('id')
    .where('organizacion_id', '=', organizacionId)
    .where('unida_a_mesa_id', '=', principalDelGrupoId)
    .execute();
  const delGrupo = new Set([principalDelGrupoId, ...miembros.map((m) => m.id)]);
  const entran = posiciones.filter((p) => !delGrupo.has(p.mesaId));
  return entran.length === 0 ? undefined : entran;
}

export const separarMesasComando = definirComando<
  Transaccion,
  typeof entradaSepararMesas,
  ResultadoSeparacion
>({
  nombre: 'restaurante.separar_mesas',
  entidad: 'mesa',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { unionId: 'uniones_mesa' },
  modulo: 'mesas',
  entrada: entradaSepararMesas,
  async ejecutar(ctx, entrada) {
    const { organizacionId, empleoId } = ctx.ambito;

    const escrito = await ctx.paso('separar', () =>
      separarMesas(ctx.tx, {
        organizacionId,
        unionId: entrada.unionId,
        empleadoId: empleoId,
        ahora: ctx.ahora,
      }),
    );

    // La cuenta se queda en la principal, ya sin grupo. Sin cuenta, nada que soltar.
    const ordenPrincipalId = escrito.ordenPrincipalId;
    if (ordenPrincipalId !== null) {
      await ctx.paso('soltar_cuenta', () =>
        ctx.tx
          .updateTable('ordenes')
          .set({ union_id: null, updated_at: ctx.ahora })
          .where('organizacion_id', '=', organizacionId)
          .where('id', '=', ordenPrincipalId)
          .execute(),
      );
    }

    // DP-13.3: el pedido del portal y las notas del grupo se quedan en la principal; se dice.
    const queda = await ctx.paso('lo_que_queda_en_la_principal', () =>
      loQueSeQuedaEnLaPrincipal(ctx.tx, organizacionId, entrada.unionId),
    );

    ctx.auditar({
      entidadId: ordenPrincipalId,
      payload: {
        unionId: entrada.unionId,
        mesasLiberadas: escrito.mesasLiberadas,
        lineasDelPortalEnLaPrincipal: queda.lineasDelPortalEnLaPrincipal,
      },
    });

    return {
      unionId: entrada.unionId,
      ordenPrincipalId,
      mesasLiberadas: escrito.mesasLiberadas,
      ...queda,
    };
  },
});
