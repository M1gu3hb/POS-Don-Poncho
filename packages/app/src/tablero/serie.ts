import 'server-only';

import { PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import {
  PERIODOS_DEL_TABLERO,
  planDelPeriodo,
  type Agrupacion,
  type PeriodoDelTablero,
  type PlanDelPeriodo,
} from '@morphiqpos/domain/tablero';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { armarElTablero, type Armado, type SumaDeVentas } from './armado.ts';
import { sumarGastos, sumarVentas, sumaTotal } from './sumas.ts';

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
