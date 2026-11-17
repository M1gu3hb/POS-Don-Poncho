import 'server-only';

import { PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import type { Rango } from '@morphiqpos/domain/tablero';
import { sql } from 'kysely';
import { z } from 'zod';

import { ORDEN_VENDIDA } from '../caja/corte/consultas.ts';
import { definirComando } from '../definicion.ts';
import { PROPINA_DE_LA_ORDEN } from '../propinas/fragmentos.ts';
import { sumarVentas, sumaTotal } from '../tablero/sumas.ts';

/**
 * EL RESUMEN DE REGISTROS, DESDE EL SERVIDOR (H3).
 *
 * Registros sumaba las filas que bajaba al navegador, y el puente no devuelve más de 1 000 por
 * petición: con un periodo grande («Este año») el resumen era la suma de una parte. Ahora el servidor
 * AGREGA el periodo entero: ventas, costo, utilidad, propinas, compras, gastos y neto, en centavos
 * enteros, sin traer filas ni toparlas.
 *
 * Es la misma consulta de «¿Cómo va tu semana?» (`tablero/sumas.ts`): las reglas del corte
 * (`ORDEN_VENDIDA`, el costo sólo de las cuentas con costo completo, la venta sin propina) y el día
 * del NEGOCIO (la zona de la organización). Las compras y los gastos tienen su día contable (`fecha`).
 * La propina es la de los pagos confirmados de esas cuentas.
 */

/** Un periodo más largo que esto no es una pregunta de Registros. */
export const DIAS_MAXIMOS_DEL_PERIODO = 3_660;

const MS_POR_DIA = 86_400_000;
const dia = z.iso.date();

export const entradaResumenDelPeriodo = z
  .strictObject({ desde: dia, hasta: dia })
  .superRefine((periodo, ctx) => {
    const dias = (Date.parse(periodo.hasta) - Date.parse(periodo.desde)) / MS_POR_DIA;
    if (dias < 0) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'El periodo está al revés.' });
    } else if (dias > DIAS_MAXIMOS_DEL_PERIODO) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'El periodo es demasiado largo.' });
    }
  });

export interface TotalDelDia {
  readonly cantidad: number;
  readonly totalCentavos: string;
}

export interface ResumenDelPeriodo {
  readonly desde: string;
  readonly hasta: string;
  readonly ventas: {
    readonly cuentas: number;
    readonly ventasCentavos: string;
    /** La venta de las cuentas con costo completo, y su costo: de ahí sale la utilidad. */
    readonly ventaConCostoCentavos: string;
    readonly costoCentavos: string;
    readonly utilidadBrutaCentavos: string;
    readonly sinReceta: number;
    readonly recetaIncompleta: number;
  };
  /** La propina de esas cuentas (pagos confirmados): no es venta ni entra al neto. */
  readonly propinasCentavos: string;
  readonly compras: TotalDelDia;
  readonly gastos: TotalDelDia;
  /** Ventas − compras − gastos (sin propinas). */
  readonly netoCentavos: string;
}

async function propinasDelPeriodo(
  tx: Transaccion,
  organizacionId: string,
  rango: Rango,
): Promise<bigint> {
  const { rows } = await sql<{ readonly propinas: string }>`
    select coalesce(sum(t.propina), 0)::text as "propinas"
      from ordenes o
      join organizaciones og on og.id = o.organizacion_id
      ${PROPINA_DE_LA_ORDEN}
     where o.organizacion_id = ${organizacionId}
       and ${ORDEN_VENDIDA}
       and (coalesce(o.cobrada_en, o.cerrada_en, o.updated_at) at time zone og.zona_horaria)::date
           between ${rango.desde}::date and ${rango.hasta}::date
  `.execute(tx);
  return BigInt(rows[0]?.propinas ?? '0');
}

/** Cuántas filas y cuánto suman las compras o los gastos de un periodo, por su día contable. */
async function totalPorDia(
  tx: Transaccion,
  tabla: 'compras' | 'gastos',
  organizacionId: string,
  rango: Rango,
): Promise<{ readonly cantidad: number; readonly total: bigint }> {
  const monto = tabla === 'compras' ? 'total_centavos' : 'monto_centavos';
  const { rows } = await sql<{ readonly cantidad: number; readonly total: string }>`
    select count(*)::int                              as "cantidad",
           coalesce(sum(${sql.ref(monto)}), 0)::text   as "total"
      from ${sql.table(tabla)}
     where organizacion_id = ${organizacionId}
       and fecha between ${rango.desde}::date and ${rango.hasta}::date
  `.execute(tx);
  return { cantidad: rows[0]?.cantidad ?? 0, total: BigInt(rows[0]?.total ?? '0') };
}

export async function resumenDelPeriodoEnLaBase(
  tx: Transaccion,
  organizacionId: string,
  rango: Rango,
): Promise<ResumenDelPeriodo> {
  // Por mes: el mismo agrupado que la serie del tablero, sumado en uno solo para el periodo.
  const ventas = sumaTotal((await sumarVentas(tx, organizacionId, rango, 'mes')).values());
  const propinas = await propinasDelPeriodo(tx, organizacionId, rango);
  const compras = await totalPorDia(tx, 'compras', organizacionId, rango);
  const gastos = await totalPorDia(tx, 'gastos', organizacionId, rango);
  return {
    desde: rango.desde,
    hasta: rango.hasta,
    ventas: {
      cuentas: ventas.cuentas,
      ventasCentavos: ventas.ventasCentavos.toString(),
      ventaConCostoCentavos: ventas.ventaConCostoCentavos.toString(),
      costoCentavos: ventas.costoCentavos.toString(),
      utilidadBrutaCentavos: (ventas.ventaConCostoCentavos - ventas.costoCentavos).toString(),
      sinReceta: ventas.sinReceta,
      recetaIncompleta: ventas.recetaIncompleta,
    },
    propinasCentavos: propinas.toString(),
    compras: { cantidad: compras.cantidad, totalCentavos: compras.total.toString() },
    gastos: { cantidad: gastos.cantidad, totalCentavos: gastos.total.toString() },
    netoCentavos: (ventas.ventasCentavos - compras.total - gastos.total).toString(),
  };
}

export const resumenDelPeriodo = definirComando<
  Transaccion,
  typeof entradaResumenDelPeriodo,
  ResumenDelPeriodo
>({
  nombre: 'registros.resumen',
  entidad: 'orden',
  escribe: false,
  // Los tres puestos que ven Registros (como `tablero.serie`).
  roles: ['dueno', 'administrador', 'gerente'],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaResumenDelPeriodo,
  async ejecutar(ctx, entrada) {
    return ctx.paso('agregar', () =>
      resumenDelPeriodoEnLaBase(ctx.tx, ctx.ambito.organizacionId, {
        desde: entrada.desde,
        hasta: entrada.hasta,
      }),
    );
  },
});
