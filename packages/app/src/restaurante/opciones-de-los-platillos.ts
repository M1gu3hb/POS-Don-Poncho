import 'server-only';

import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion } from '@morphiqpos/data';

/**
 * QA1-4 (DP-13.5) · LAS OPCIONES DE CADA PLATILLO, PARA EL PERSONAL.
 *
 * El mesero abre el diálogo de opciones sólo si el producto trae `modificadores`, y el editor de
 * Productos pinta los que ya tiene; pero `modificadores` no es un campo del puente (son tres
 * tablas) y la entidad `Modificador` no dice si el grupo es obligatorio. Así, el mesero mandaba a
 * cocina una quesadilla SIN su relleno obligatorio (el portal sí lo exige, con su lectura propia,
 * `portal/opciones-publicas.ts`), y el editor abría vacío un juego que, al guardar, se reemplaza
 * entero.
 *
 * Sale cada grupo con sus opciones, activos o no y con su marca: el mesero sólo ofrece lo activo
 * (`SeleccionModificadoresDialog` ya filtra) y el editor necesita también lo inactivo para no
 * borrarlo al guardar. Nada de precio: en el restaurante una opción no cobra (DP-D12).
 */

export interface OpcionDelPlatillo {
  readonly id: string;
  readonly nombre: string;
  readonly activo: boolean;
}

export interface GrupoDelPlatillo {
  readonly id: string;
  readonly nombre: string;
  readonly obligatorio: boolean;
  readonly tipo: 'unica' | 'multiple';
  readonly activo: boolean;
  readonly opciones: readonly OpcionDelPlatillo[];
}

/** Una fila de la consulta: una opción, con su grupo y su producto. */
export interface FilaDeOpcionDelPlatillo {
  readonly producto_id: string;
  readonly grupo_id: string;
  readonly grupo: string;
  readonly obligatorio: boolean;
  readonly tipo: string;
  readonly grupo_activo: boolean;
  readonly opcion_id: string;
  readonly opcion: string;
  readonly opcion_activa: boolean;
}

/** Más filas que esto no las tiene una carta: es el freno de una consulta sin página. */
const TOPE_DE_OPCIONES = 5_000;

/** Las filas planas, agrupadas por producto y por grupo, en el orden en que llegan. */
export function agruparLasOpciones(
  filas: readonly FilaDeOpcionDelPlatillo[],
): Readonly<Record<string, readonly GrupoDelPlatillo[]>> {
  const porProducto = new Map<string, Map<string, GrupoDelPlatillo>>();
  for (const f of filas) {
    const grupos = porProducto.get(f.producto_id) ?? new Map<string, GrupoDelPlatillo>();
    const previo = grupos.get(f.grupo_id);
    const opcion = { id: f.opcion_id, nombre: f.opcion, activo: f.opcion_activa };
    grupos.set(f.grupo_id, {
      id: f.grupo_id,
      nombre: f.grupo,
      obligatorio: f.obligatorio,
      tipo: f.tipo === 'multiple' ? 'multiple' : 'unica',
      activo: f.grupo_activo,
      opciones: [...(previo?.opciones ?? []), opcion],
    });
    porProducto.set(f.producto_id, grupos);
  }
  return Object.fromEntries(
    [...porProducto].map(([productoId, grupos]) => [productoId, [...grupos.values()]]),
  );
}

/** `POST /api/restaurante/opciones-de-los-platillos`: las de toda la carta, en una consulta. */
export async function opcionesDeLosPlatillos(
  ambito: Ambito,
): Promise<Readonly<Record<string, readonly GrupoDelPlatillo[]>>> {
  return conTransaccion(async (tx) => {
    const filas = await tx
      .selectFrom('producto_modificadores as pm')
      .innerJoin('modificadores as m', (union) =>
        union
          .onRef('m.id', '=', 'pm.modificador_id')
          .onRef('m.organizacion_id', '=', 'pm.organizacion_id'),
      )
      .innerJoin('modificador_opciones as mo', 'mo.modificador_id', 'm.id')
      .select([
        'pm.producto_id as producto_id',
        'm.id as grupo_id',
        'm.nombre as grupo',
        'm.obligatorio as obligatorio',
        'm.tipo as tipo',
        'm.activo as grupo_activo',
        'mo.id as opcion_id',
        'mo.nombre as opcion',
        'mo.activa as opcion_activa',
      ])
      .where('pm.organizacion_id', '=', ambito.organizacionId)
      .orderBy('pm.producto_id')
      .orderBy('m.nombre')
      .orderBy('mo.orden')
      .limit(TOPE_DE_OPCIONES)
      .execute();
    return agruparLasOpciones(filas);
  });
}
