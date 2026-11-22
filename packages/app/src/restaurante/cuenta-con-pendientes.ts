import 'server-only';

import { CODIGOS_ERROR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';

import { Rechazo } from '../fallos.ts';

/**
 * DP-25 · Parte 2 · PEDIR LA CUENTA CON PLATILLOS PENDIENTES.
 *
 * La cuenta se puede pedir aunque a la mesa le falten platillos, pero quien la pide tiene que
 * saberlo: el servidor lee los platillos vivos de la cuenta y, si hay alguno que no se ha
 * entregado, rechaza con la lista —por estación— hasta que llegue la confirmación explícita.
 * Vive en el servidor para que valga igual en la tableta del mesero, en el mapa del
 * administrador y en cualquier pantalla futura.
 *
 *   · «sin preparar»: `pendiente` y `en_preparacion`.
 *   · «listos sin entregar»: `listo`.
 *   · `entregado` y `cancelado` no cuentan.
 */

export interface PlatilloPendiente {
  readonly id: string;
  readonly nombre: string;
  readonly cantidad: string;
  readonly tipoVenta: string | null;
  readonly unidadVariable: string | null;
}

export interface GrupoPendiente {
  /** La estación como esté configurada; `null` si la comanda no guardó el nombre. */
  readonly estacion: string | null;
  readonly platillos: readonly PlatilloPendiente[];
}

export interface PendientesDeLaCuenta {
  readonly sinPreparar: readonly GrupoPendiente[];
  readonly listos: readonly GrupoPendiente[];
}

export interface FilaPendiente extends PlatilloPendiente {
  readonly estado: string;
  readonly estacion: string | null;
  readonly ordenVisual: number;
}

const SIN_PREPARAR = ['pendiente', 'nuevo', 'en_preparacion'] as const;

/** Agrupa por estación (en orden alfabético, sin nombre al final) y por estado. Puro. */
export function agruparPendientes(filas: readonly FilaPendiente[]): PendientesDeLaCuenta {
  const agrupar = (estados: readonly string[]): readonly GrupoPendiente[] => {
    const porEstacion = new Map<string | null, FilaPendiente[]>();
    for (const fila of filas.filter((f) => estados.includes(f.estado))) {
      porEstacion.set(fila.estacion, [...(porEstacion.get(fila.estacion) ?? []), fila]);
    }
    return [...porEstacion.entries()]
      .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b, 'es')))
      .map(([estacion, platillos]) => ({
        estacion,
        platillos: [...platillos]
          .sort((x, y) => x.ordenVisual - y.ordenVisual || x.id.localeCompare(y.id))
          .map(({ id, nombre, cantidad, tipoVenta, unidadVariable }) => ({
            id,
            nombre,
            cantidad,
            tipoVenta,
            unidadVariable,
          })),
      }));
  };
  return { sinPreparar: agrupar(SIN_PREPARAR), listos: agrupar(['listo']) };
}

export const hayPendientes = (p: PendientesDeLaCuenta): boolean =>
  p.sinPreparar.length > 0 || p.listos.length > 0;

/** Los platillos vivos de la cuenta que todavía no se entregan. */
export async function pendientesDeLaCuenta(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
): Promise<PendientesDeLaCuenta> {
  const filas = await tx
    .selectFrom('comanda_items as i')
    .innerJoin('comandas as c', (j) =>
      j.onRef('c.id', '=', 'i.comanda_id').onRef('c.organizacion_id', '=', 'i.organizacion_id'),
    )
    .select([
      'i.id as id',
      'i.producto_nombre as nombre',
      'i.cantidad as cantidad',
      'i.tipo_venta as tipoVenta',
      'i.unidad_variable as unidadVariable',
      'i.estado as estado',
      'i.orden_visual as ordenVisual',
      'c.estacion_nombre as estacion',
    ])
    .where('i.organizacion_id', '=', organizacionId)
    .where('c.orden_id', '=', ordenId)
    .where('i.estado', 'in', [...SIN_PREPARAR, 'listo'])
    .execute();
  return agruparPendientes(filas);
}

/** El rechazo con la lista. No se audita: no pasó nada, sólo se avisó. */
export function rechazoPorPendientes(pendientes: PendientesDeLaCuenta): Rechazo {
  return new Rechazo('REGLA_DE_NEGOCIO', null, {
    codigo: 'REGLA_DE_NEGOCIO',
    mensaje: 'A esta mesa todavía le faltan platillos por entregar.',
    datos: {
      regla: CODIGOS_ERROR.CUENTA_CON_PENDIENTES,
      pendientes: JSON.stringify(pendientes),
    },
  });
}
