import 'server-only';

import { ErrorDominio } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { medidasDeMesa, revisarUnion, type MesaEnPlano } from '@morphiqpos/domain/sala';
import { z } from 'zod';

import { cotizar } from '../venta/cotizar.ts';
import { mesaEnSala, unionAbiertaDeMesa, type MesaEnSala } from './sala-escrituras.ts';
import { CUENTAS_VIVAS, type CuentaQuePaso } from './union-escrituras.ts';

/**
 * LO QUE COMPARTEN «UNIR MESAS» Y «AGREGAR MESAS» (F-302, DP-24 · P5, DP-25 · P6): el tope técnico,
 * los roles, el resultado, la revisión del grupo en el plano y la carga de las mesas que entran.
 * Vive aparte para que `unir_mesas` pueda agregar a un grupo vivo sin que los dos archivos se
 * importen en círculo.
 */

/** Un tope técnico, no de negocio: el de negocio es el perímetro del grupo. */
export const MAXIMO_TECNICO = 40;
export const COORDENADA = z.number().int().min(0).max(10_000);

export interface ResultadoUnion {
  readonly unionId: string;
  /** `null`: la unión nació sin cuenta; la toma la primera que se abra en la principal. */
  readonly ordenPrincipalId: string | null;
  readonly mesasUnidas: number;
  readonly cuentasAbsorbidas: number;
  readonly lineasMovidas: number;
  readonly totalCentavos: string;
  /** DP-D226 · «La cuenta de la mesa 7 pasó a la mesa 3»: una por cada mesa que traía consumo. */
  readonly cuentasQuePasaron: readonly CuentaQuePaso[];
}

export const ROLES = ['mesero', 'cajero', 'gerente', 'administrador', 'dueno'] as const;

export interface Miembro {
  readonly mesa: MesaEnSala;
  readonly ordenId: string | null;
}

export async function exigirCuentaViva(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
  numero: number,
): Promise<void> {
  const orden = await tx
    .selectFrom('ordenes')
    .select('estado')
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', ordenId)
    .executeTakeFirst();
  if (orden === undefined || !(CUENTAS_VIVAS as readonly string[]).includes(orden.estado)) {
    throw new ErrorDominio(
      'ORDEN_NO_EDITABLE',
      `La mesa ${String(numero)} ya cobró su cuenta: márcala limpia antes de unirla.`,
      { estado: orden?.estado ?? 'inexistente' },
    );
  }
}

export async function guardarTotales(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
  ahora: Date,
): Promise<bigint> {
  const { totales } = await cotizar(tx, organizacionId, ordenId);
  await tx
    .updateTable('ordenes')
    .set({
      subtotal_centavos: totales.subtotalCentavos,
      descuento_centavos: totales.descuentoCentavos,
      impuestos_centavos: totales.impuestosCentavos,
      total_centavos: totales.totalCentavos,
      costo_total_centavos: totales.costoTotalCentavos,
      utilidad_centavos: totales.utilidadCentavos,
      margen_bp: totales.margenBp,
      updated_at: ahora,
    })
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', ordenId)
    .execute();
  return totales.totalCentavos;
}

/**
 * DP-9.6 · Las mesas del grupo en el plano: misma zona, pegadas y dentro del perímetro, con las
 * posiciones en que quedaron (o donde ya están). Devuelve dónde estaba cada una ANTES, para que
 * separar las regrese.
 */
export async function revisarElGrupo(
  tx: Transaccion,
  organizacionId: string,
  ids: readonly string[],
  posiciones:
    readonly { readonly mesaId: string; readonly x: number; readonly y: number }[] | undefined,
): Promise<ReadonlyMap<string, { readonly x: number; readonly y: number }>> {
  const filas = await tx
    .selectFrom('mesas')
    .select(['id', 'posicion_x', 'posicion_y', 'forma', 'tamano', 'zona_id'])
    .where('organizacion_id', '=', organizacionId)
    .where('id', 'in', [...ids])
    .execute();
  if (new Set(filas.map((f) => f.zona_id)).size > 1) {
    throw new ErrorDominio('UNION_DE_MESAS_INVALIDA', 'Sólo se unen mesas de la misma zona.');
  }
  const nuevas = new Map((posiciones ?? []).map((p) => [p.mesaId, p]));
  const enPlano: MesaEnPlano[] = filas.map((f) => ({
    id: f.id,
    x: nuevas.get(f.id)?.x ?? f.posicion_x,
    y: nuevas.get(f.id)?.y ?? f.posicion_y,
    ...medidasDeMesa(f.forma, f.tamano),
  }));
  const problema = revisarUnion(enPlano);
  if (problema !== null) throw new ErrorDominio('UNION_DE_MESAS_INVALIDA', problema);
  return new Map(filas.map((f) => [f.id, { x: f.posicion_x, y: f.posicion_y }]));
}

/**
 * Carga cada mesa que se va a unir y comprueba lo que la base no puede.
 *
 * Una mesa de otra sucursal, una que ya está en otro grupo o una cuyo consumo
 * ya se cobró son tres formas distintas de acabar con un grupo imposible; las
 * tres se cierran aquí, antes de escribir nada.
 */
export async function cargarMiembros(
  tx: Transaccion,
  organizacionId: string,
  principal: MesaEnSala,
  mesaIds: readonly string[],
): Promise<readonly Miembro[]> {
  const salida: Miembro[] = [];

  for (const mesaId of mesaIds) {
    const mesa = await mesaEnSala(tx, organizacionId, mesaId);

    if (mesa.sucursalId !== principal.sucursalId) {
      throw new ErrorDominio(
        'MESA_NO_ENCONTRADA',
        `La mesa ${String(mesa.numero)} es de otra sucursal: no se puede juntar con ésta.`,
      );
    }

    const grupo = await unionAbiertaDeMesa(tx, organizacionId, mesaId);
    if (grupo !== null) {
      throw new ErrorDominio(
        'MESA_YA_ABIERTA',
        `La mesa ${String(mesa.numero)} ya pertenece a otro grupo.`,
      );
    }

    if (mesa.ordenActivaId === null) {
      // Una mesa libre se une sin traer consumo: es el caso de «pásate a esta
      // otra que está vacía», y es legítimo.
      salida.push({ mesa, ordenId: null });
      continue;
    }

    const orden = await tx
      .selectFrom('ordenes')
      .select(['id', 'estado'])
      .where('organizacion_id', '=', organizacionId)
      .where('id', '=', mesa.ordenActivaId)
      .executeTakeFirst();

    if (orden === undefined || !(CUENTAS_VIVAS as readonly string[]).includes(orden.estado)) {
      throw new ErrorDominio(
        'ORDEN_NO_EDITABLE',
        `La cuenta de la mesa ${String(mesa.numero)} ya se cobró o se cerró: no se puede absorber.`,
        { estado: orden?.estado ?? 'inexistente' },
      );
    }

    salida.push({ mesa, ordenId: orden.id });
  }

  return salida;
}
