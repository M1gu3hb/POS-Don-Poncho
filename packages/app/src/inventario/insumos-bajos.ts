import 'server-only';

import { PAQUETES_OPERATIVOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { cantidad as diezmilesimas } from '@morphiqpos/domain/catalogo';
import {
  alertasDeMinimo,
  existenciaConSigno,
  type NivelDeAlerta,
} from '@morphiqpos/domain/inventario';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';

/**
 * EL AVISO DE INSUMO BAJO (DP-22 · DP-D159). Lectura.
 *
 * Inventario ordena sus insumos por semáforo, pero fuera de esa pantalla nadie se enteraba, y el
 * Tablero lo contaba con una lista de ingredientes bajada al navegador (que puede venir cortada). Aquí
 * el servidor cuenta sobre TODOS los insumos activos, con la existencia sumada de todos los
 * almacenes (lo mismo que la vista `existencias_por_insumo`, pero sólo de esta organización) y la regla de `alertasDeMinimo`: un piso en
 * cero es «no lo vigiles»; con piso (o con piso crítico), cuenta lo que está en él o por debajo, lo
 * agotado y lo que quedó en negativo (DP-D116) también.
 *
 * Los primeros nombres salen del más urgente al menos: crítico antes que bajo y, dentro de cada nivel,
 * lo que menos cobertura tiene respecto de su piso (existencia ÷ mínimo); a igualdad, por nombre.
 */

/** Cuántos nombres se enseñan en la tarjeta del Tablero. */
export const NOMBRES_DEL_AVISO = 3;

const ORDEN_DEL_NIVEL: Readonly<Record<NivelDeAlerta, number>> = { critico: 0, bajo: 1, normal: 2 };
const ESCALA_DE_LA_COBERTURA = 10_000n;

export const entradaInsumosBajos = z.strictObject({});

export interface InsumoBajo {
  readonly id: string;
  readonly nombre: string;
  readonly unidad: string;
  /** La existencia total (todos los almacenes), como texto decimal; puede ser negativa. */
  readonly existencia: string;
  readonly minimo: string;
  readonly nivel: 'critico' | 'bajo';
  /** Sin nada que usar (cero o negativo): la tarjeta lo dice con otra palabra. */
  readonly agotado: boolean;
}

export interface AvisoDeInsumosBajos {
  readonly total: number;
  readonly primeros: readonly InsumoBajo[];
}

interface FilaDeInsumo {
  readonly id: string;
  readonly nombre: string;
  readonly unidad: string;
  readonly existencia: string;
  readonly minimo: string;
  readonly critico: string;
}

/** Existencia ÷ piso, en diezmilésimas: menos es más urgente. Sin piso (sólo crítico) va al final del nivel. */
function coberturaDe(existencia: string, minimo: string): bigint {
  const piso = diezmilesimas(minimo);
  if (piso <= 0n) return ESCALA_DE_LA_COBERTURA * 1_000_000n;
  return (existenciaConSigno(existencia) * ESCALA_DE_LA_COBERTURA) / piso;
}

export async function insumosBajosEnLaBase(
  tx: Transaccion,
  organizacionId: string,
): Promise<AvisoDeInsumosBajos> {
  const { rows } = await sql<FilaDeInsumo>`
    select i.id::text                                   as "id",
           i.nombre                                     as "nombre",
           i.unidad_base                                as "unidad",
           trim_scale(round(coalesce(e.cantidad, 0), 4))::text as "existencia",
           trim_scale(round(i.stock_minimo, 4))::text         as "minimo",
           trim_scale(round(i.stock_critico, 4))::text        as "critico"
      from insumos i
      left join (
              select x.insumo_id, sum(x.cantidad) as cantidad
                from existencias x
               where x.organizacion_id = ${organizacionId}
               group by x.insumo_id
            ) e on e.insumo_id = i.id
     where i.organizacion_id = ${organizacionId}
       and i.activo
       and (i.stock_minimo > 0 or i.stock_critico > 0)
  `.execute(tx);
  const porId = new Map(rows.map((f) => [f.id, f]));
  const alertas = alertasDeMinimo(
    rows.map((f) => ({
      insumoId: f.id,
      existenciaBase: f.existencia,
      stockMinimo: f.minimo,
      stockCritico: f.critico,
    })),
  );
  const alertados = alertas.flatMap((a) => {
    const fila = porId.get(a.insumoId);
    return fila === undefined || a.nivel === 'normal' ? [] : [{ fila, nivel: a.nivel }];
  });
  alertados.sort((x, y) => {
    const porNivel = ORDEN_DEL_NIVEL[x.nivel] - ORDEN_DEL_NIVEL[y.nivel];
    if (porNivel !== 0) return porNivel;
    const cx = coberturaDe(x.fila.existencia, x.fila.minimo);
    const cy = coberturaDe(y.fila.existencia, y.fila.minimo);
    if (cx !== cy) return cx < cy ? -1 : 1;
    return x.fila.nombre.localeCompare(y.fila.nombre, 'es');
  });
  return {
    total: alertados.length,
    primeros: alertados.slice(0, NOMBRES_DEL_AVISO).map(({ fila, nivel }) => ({
      id: fila.id,
      nombre: fila.nombre,
      unidad: fila.unidad,
      existencia: fila.existencia,
      minimo: fila.minimo,
      nivel: nivel === 'critico' ? 'critico' : 'bajo',
      agotado: existenciaConSigno(fila.existencia) <= 0n,
    })),
  };
}

export const insumosBajos = definirComando<
  Transaccion,
  typeof entradaInsumosBajos,
  AvisoDeInsumosBajos
>({
  nombre: 'inventario.insumos_bajos',
  entidad: 'insumo',
  escribe: false,
  // Los puestos que leen Inventario (`/api/inventario/resumen`).
  roles: ['dueno', 'administrador', 'gerente', 'almacen'],
  paquetes: PAQUETES_OPERATIVOS,
  modulo: 'inventario',
  entrada: entradaInsumosBajos,
  async ejecutar(ctx) {
    return ctx.paso('contar', () => insumosBajosEnLaBase(ctx.tx, ctx.ambito.organizacionId));
  },
});
