import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import type { Agrupacion, Rango } from '@morphiqpos/domain/tablero';
import { sql } from 'kysely';

import { ORDEN_VENDIDA } from '../caja/corte/consultas.ts';
import { estadoDelCostoDe } from '../caja/corte/costo-conocido.ts';
import { SIN_VENTAS, type SumaDeVentas } from './armado.ts';

/**
 * LAS SUMAS DEL SERVIDOR que comparten «¿Cómo va tu semana?» (`tablero.serie`) y el resumen de
 * Registros (`registros.resumen`): una sola consulta, las mismas reglas que el corte (`ORDEN_VENDIDA`,
 * costo sólo de las cuentas con costo completo) y el día del NEGOCIO (la zona de la organización).
 * Todo en centavos enteros (`bigint`), sin traer filas ni toparlas.
 */

const FORMATO: Readonly<Record<Agrupacion, string>> = {
  hora: 'HH24',
  dia: 'YYYY-MM-DD',
  mes: 'YYYY-MM',
};

interface FilaSumada {
  readonly clave: string;
  readonly cuentas: number;
  readonly ventas: string;
  readonly ventaConCosto: string;
  readonly costo: string;
  readonly sinReceta: number;
  readonly incompleta: number;
}

export async function sumarVentas(
  tx: Transaccion,
  organizacionId: string,
  rango: Rango,
  agrupar: Agrupacion,
): Promise<ReadonlyMap<string, SumaDeVentas>> {
  const formato = sql.lit(FORMATO[agrupar]);
  const { rows } = await sql<FilaSumada>`
    select to_char(t.local, ${formato})                                  as "clave",
           count(*)::int                                                 as "cuentas",
           coalesce(sum(o.total_centavos), 0)::text                      as "ventas",
           coalesce(sum(o.total_centavos) filter (where e.estado = 'conocido'), 0)::text
                                                                         as "ventaConCosto",
           coalesce(sum(o.costo_total_centavos) filter (where e.estado = 'conocido'), 0)::text
                                                                         as "costo",
           (count(*) filter (where e.estado = 'sin_receta'))::int        as "sinReceta",
           (count(*) filter (where e.estado = 'receta_incompleta'))::int as "incompleta"
      from ordenes o
      join organizaciones og on og.id = o.organizacion_id
      cross join lateral (
        select (coalesce(o.cobrada_en, o.cerrada_en, o.updated_at) at time zone og.zona_horaria) as local
      ) t
      cross join lateral (select ${estadoDelCostoDe('o')} as estado) e
     where o.organizacion_id = ${organizacionId}
       and ${ORDEN_VENDIDA}
       and t.local::date between ${rango.desde}::date and ${rango.hasta}::date
     group by 1
  `.execute(tx);
  return new Map(
    rows.map((f) => [
      f.clave,
      {
        cuentas: f.cuentas,
        ventasCentavos: BigInt(f.ventas),
        ventaConCostoCentavos: BigInt(f.ventaConCosto),
        costoCentavos: BigInt(f.costo),
        sinReceta: f.sinReceta,
        recetaIncompleta: f.incompleta,
      },
    ]),
  );
}

export async function sumarGastos(
  tx: Transaccion,
  organizacionId: string,
  rango: Rango,
  agrupar: Agrupacion,
): Promise<ReadonlyMap<string, bigint>> {
  // Un gasto tiene día, no hora: por hora sólo se pide el total del día.
  const formato = sql.lit(agrupar === 'mes' ? FORMATO.mes : FORMATO.dia);
  const { rows } = await sql<{ readonly clave: string; readonly monto: string }>`
    select to_char(g.fecha, ${formato})                as "clave",
           coalesce(sum(g.monto_centavos), 0)::text    as "monto"
      from gastos g
     where g.organizacion_id = ${organizacionId}
       and g.fecha between ${rango.desde}::date and ${rango.hasta}::date
     group by 1
  `.execute(tx);
  return new Map(rows.map((f) => [f.clave, BigInt(f.monto)]));
}

export function sumaTotal(partes: Iterable<SumaDeVentas>): SumaDeVentas {
  let total = SIN_VENTAS;
  for (const p of partes) {
    total = {
      cuentas: total.cuentas + p.cuentas,
      ventasCentavos: total.ventasCentavos + p.ventasCentavos,
      ventaConCostoCentavos: total.ventaConCostoCentavos + p.ventaConCostoCentavos,
      costoCentavos: total.costoCentavos + p.costoCentavos,
      sinReceta: total.sinReceta + p.sinReceta,
      recetaIncompleta: total.recetaIncompleta + p.recetaIncompleta,
    };
  }
  return total;
}
