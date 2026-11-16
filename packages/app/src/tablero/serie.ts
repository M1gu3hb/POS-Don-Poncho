import 'server-only';

import { PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import {
  PERIODOS_DEL_TABLERO,
  planDelPeriodo,
  type Agrupacion,
  type PeriodoDelTablero,
  type PlanDelPeriodo,
  type Rango,
} from '@morphiqpos/domain/tablero';
import { sql } from 'kysely';
import { z } from 'zod';

import { ORDEN_VENDIDA } from '../caja/corte/consultas.ts';
import { estadoDelCostoDe } from '../caja/corte/costo-conocido.ts';
import { definirComando } from '../definicion.ts';
import { armarElTablero, SIN_VENTAS, type Armado, type SumaDeVentas } from './armado.ts';

/**
 * «¿CÓMO VA TU SEMANA?» DESDE EL SERVIDOR (DP-21 · Bloque 13 · M7 y M8).
 *
 * Antes el Tablero bajaba las ventas del día al navegador (con tope de 1000) y sumaba allá, con la
 * medianoche del aparato. Ahora el servidor AGREGA: por cubeta (hora, día del negocio o mes), en
 * centavos enteros, sin traer filas ni truncar, con el día del NEGOCIO (la zona de la organización,
 * America/Mexico_City). Es la misma lectura que pide Registros: `tablero.serie` no sabe quién la
 * llama; cualquier pantalla con rango la comparte.
 *
 * Lo mismo que el corte: una cuenta cuenta si es una venta (`ORDEN_VENDIDA`), el costo sólo de las
 * cuentas con costo completo (`estadoDelCostoDe`), y la venta es el total SIN propina.
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

async function sumarVentas(
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

async function sumarGastos(
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

function sumaTotal(partes: Iterable<SumaDeVentas>): SumaDeVentas {
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

export const entradaSerieDelTablero = z.strictObject({
  periodo: z.enum(PERIODOS_DEL_TABLERO as [PeriodoDelTablero, ...PeriodoDelTablero[]]),
});

export interface SerieDelTablero extends Armado {
  readonly periodo: PeriodoDelTablero;
  readonly agrupar: Agrupacion;
  /** El día del negocio (`AAAA-MM-DD`) que se tomó por «hoy». */
  readonly hoy: string;
  readonly desde: string;
  readonly hasta: string;
}

/** El día del negocio (la zona de la organización) en que `ahora` cae, `AAAA-MM-DD`. */
async function hoyDelNegocio(
  tx: Transaccion,
  organizacionId: string,
  ahora: Date,
): Promise<string> {
  const { rows } = await sql<{ readonly hoy: string }>`
    select to_char((${ahora.toISOString()}::timestamptz at time zone og.zona_horaria)::date, 'YYYY-MM-DD') as "hoy"
      from organizaciones og
     where og.id = ${organizacionId}
  `.execute(tx);
  return rows[0]?.hoy ?? new Date(ahora.getTime()).toISOString().slice(0, 10);
}

export async function serieDelTablero(
  tx: Transaccion,
  organizacionId: string,
  periodo: PeriodoDelTablero,
  ahora: Date,
): Promise<SerieDelTablero> {
  const hoy = await hoyDelNegocio(tx, organizacionId, ahora);
  const plan: PlanDelPeriodo = planDelPeriodo(periodo, hoy);
  const actual = await sumarVentas(tx, organizacionId, plan, plan.agrupar);
  const deAntes =
    plan.referencia === null
      ? new Map<string, SumaDeVentas>()
      : await sumarVentas(tx, organizacionId, plan.referencia, plan.agrupar);
  const gastos = await sumarGastos(tx, organizacionId, plan, plan.agrupar);
  const gastosTotal = [...gastos.values()].reduce((s, g) => s + g, 0n);
  const armado = armarElTablero(
    plan,
    actual,
    deAntes,
    plan.agrupar === 'hora' ? null : gastos,
    gastosTotal,
    plan.referencia === null ? null : sumaTotal(deAntes.values()),
  );
  return { periodo, agrupar: plan.agrupar, hoy, desde: plan.desde, hasta: plan.hasta, ...armado };
}

export const serieDelTableroComando = definirComando<
  Transaccion,
  typeof entradaSerieDelTablero,
  SerieDelTablero
>({
  nombre: 'tablero.serie',
  entidad: 'orden',
  escribe: false,
  roles: ['dueno', 'administrador', 'gerente'],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaSerieDelTablero,
  async ejecutar(ctx, entrada) {
    return ctx.paso('agregar', () =>
      serieDelTablero(ctx.tx, ctx.ambito.organizacionId, entrada.periodo, ctx.ahora),
    );
  },
});
