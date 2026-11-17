import 'server-only';

import { PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import type { Rango } from '@morphiqpos/domain/tablero';
import { sql } from 'kysely';

import { ORDEN_VENDIDA } from '../caja/corte/consultas.ts';
import { definirComando } from '../definicion.ts';
import { PROPINA_DE_LA_ORDEN } from '../propinas/fragmentos.ts';
import {
  armarLoMasVendido,
  type DevueltoDelPlatillo,
  type LoMasVendidoArmado,
  type VendidoDelPlatillo,
} from './lo-mas-vendido-armado.ts';
import { entradaResumenDelPeriodo } from './resumen-del-periodo.ts';

/**
 * «LO MÁS VENDIDO» (DP-22 · DP-D160), DESDE EL SERVIDOR.
 *
 * Las ventas por platillo sólo existían como exportación. Aquí el servidor suma el periodo ENTERO (sin
 * tope de filas, en centavos enteros) con las mismas reglas del resumen de Registros y del corte:
 *
 *  - cuentas vendidas (`ORDEN_VENDIDA`): lo cancelado y la cuenta madre de una división no cuentan, y
 *    la devuelta entera sigue siendo venta de su día;
 *  - líneas no anuladas (`anulada_en is null`);
 *  - el día es el del NEGOCIO (la zona de la organización), igual que `registros.resumen`;
 *  - lo que se vende por peso cuenta sus kilos, no la pieza de la línea;
 *  - las devoluciones restan, en el día en que se hicieron (como el corte).
 *
 * Por mesero: cuentas, venta (el total de la cuenta, sin propina) y propina confirmada. La venta de los
 * meseros suma la del resumen; la de los platillos más «lo que no es platillo» (el descuento y los
 * impuestos de la cuenta) también: `cuentas.ajusteCentavos` lo dice.
 */

const DIA_DEL_NEGOCIO = sql`(coalesce(o.cobrada_en, o.cerrada_en, o.updated_at) at time zone og.zona_horaria)::date`;

export const entradaLoMasVendido = entradaResumenDelPeriodo;

export interface MeseroDeLoMasVendido {
  /** `null`: cuentas sin quien las atendiera. */
  readonly nombre: string | null;
  readonly cuentas: number;
  readonly ventaCentavos: string;
  readonly propinaCentavos: string;
}

export interface LoMasVendido extends LoMasVendidoArmado {
  readonly desde: string;
  readonly hasta: string;
  readonly cuentas: {
    readonly cantidad: number;
    /** La venta de las cuentas: la misma cifra de `registros.resumen`. */
    readonly ventasCentavos: string;
    /** Lo que las cuentas traen además de sus platillos (descuento de la cuenta, impuestos). */
    readonly ajusteCentavos: string;
  };
  readonly meseros: readonly MeseroDeLoMasVendido[];
}

interface FilaVendida {
  readonly clave: string;
  readonly nombre: string;
  readonly categoria: string | null;
  readonly lineas: number;
  readonly cantidad: string;
  readonly unidad: string;
  readonly importe: string;
}

async function vendidoPorPlatillo(
  tx: Transaccion,
  organizacionId: string,
  rango: Rango,
): Promise<readonly VendidoDelPlatillo[]> {
  const { rows } = await sql<FilaVendida>`
    select coalesce(l.producto_id::text, l.producto_nombre)         as "clave",
           max(l.producto_nombre)                                   as "nombre",
           max(cat.nombre)                                          as "categoria",
           count(*)::int                                            as "lineas",
           trim_scale(sum(case when l.tipo_venta = 'variable_medida'
                               then coalesce(l.cantidad_variable, l.cantidad)
                               else l.cantidad end::numeric))::text as "cantidad",
           max(case when l.tipo_venta = 'variable_medida'
                    then coalesce(l.unidad_variable, l.unidad)
                    else l.unidad end)                              as "unidad",
           sum(l.total_centavos)::text                              as "importe"
      from orden_lineas l
      join ordenes o on o.id = l.orden_id and o.organizacion_id = l.organizacion_id
      join organizaciones og on og.id = o.organizacion_id
      left join productos pr on pr.id = l.producto_id and pr.organizacion_id = l.organizacion_id
      left join categorias cat on cat.id = pr.categoria_id and cat.organizacion_id = l.organizacion_id
     where l.organizacion_id = ${organizacionId}
       and ${ORDEN_VENDIDA}
       and l.anulada_en is null
       and ${DIA_DEL_NEGOCIO} between ${rango.desde}::date and ${rango.hasta}::date
     group by coalesce(l.producto_id::text, l.producto_nombre)
  `.execute(tx);
  return rows.map((f) => ({
    clave: f.clave,
    nombre: f.nombre,
    categoria: f.categoria,
    lineas: f.lineas,
    cantidad: f.cantidad,
    unidad: f.unidad,
    importeCentavos: BigInt(f.importe),
  }));
}

interface FilaDevuelta {
  readonly clave: string;
  readonly nombre: string;
  readonly categoria: string | null;
  readonly unidad: string;
  readonly cantidad: string;
  readonly monto: string;
}

/** Lo devuelto en el periodo, por el día de la devolución; los kilos, en proporción a la línea. */
async function devueltoPorPlatillo(
  tx: Transaccion,
  organizacionId: string,
  rango: Rango,
): Promise<readonly DevueltoDelPlatillo[]> {
  const { rows } = await sql<FilaDevuelta>`
    select coalesce(l.producto_id::text, l.producto_nombre)          as "clave",
           max(l.producto_nombre)                                    as "nombre",
           max(cat.nombre)                                           as "categoria",
           max(case when l.tipo_venta = 'variable_medida'
                    then coalesce(l.unidad_variable, l.unidad)
                    else l.unidad end)                               as "unidad",
           trim_scale(sum(case when l.tipo_venta = 'variable_medida' and l.cantidad > 0
                               then dl.cantidad / l.cantidad * coalesce(l.cantidad_variable, l.cantidad)
                               else dl.cantidad end::numeric))::text as "cantidad",
           sum(dl.monto_centavos)::text                              as "monto"
      from devoluciones_lineas dl
      join devoluciones d on d.id = dl.devolucion_id and d.organizacion_id = dl.organizacion_id
      join orden_lineas l on l.id = dl.orden_linea_id and l.organizacion_id = dl.organizacion_id
      join ordenes o on o.id = l.orden_id and o.organizacion_id = l.organizacion_id
      join organizaciones og on og.id = o.organizacion_id
      left join productos pr on pr.id = l.producto_id and pr.organizacion_id = l.organizacion_id
      left join categorias cat on cat.id = pr.categoria_id and cat.organizacion_id = l.organizacion_id
     where dl.organizacion_id = ${organizacionId}
       and (d.created_at at time zone og.zona_horaria)::date between ${rango.desde}::date and ${rango.hasta}::date
     group by coalesce(l.producto_id::text, l.producto_nombre)
  `.execute(tx);
  return rows.map((f) => ({
    clave: f.clave,
    nombre: f.nombre,
    categoria: f.categoria,
    unidad: f.unidad,
    cantidad: f.cantidad,
    montoCentavos: BigInt(f.monto),
  }));
}

async function ventasDeLasCuentas(
  tx: Transaccion,
  organizacionId: string,
  rango: Rango,
): Promise<{ readonly cantidad: number; readonly ventas: bigint }> {
  const { rows } = await sql<{ readonly cantidad: number; readonly ventas: string }>`
    select count(*)::int as "cantidad", coalesce(sum(o.total_centavos), 0)::text as "ventas"
      from ordenes o
      join organizaciones og on og.id = o.organizacion_id
     where o.organizacion_id = ${organizacionId}
       and ${ORDEN_VENDIDA}
       and ${DIA_DEL_NEGOCIO} between ${rango.desde}::date and ${rango.hasta}::date
  `.execute(tx);
  return { cantidad: rows[0]?.cantidad ?? 0, ventas: BigInt(rows[0]?.ventas ?? '0') };
}

async function ventasPorMesero(
  tx: Transaccion,
  organizacionId: string,
  rango: Rango,
): Promise<readonly MeseroDeLoMasVendido[]> {
  const { rows } = await sql<{
    readonly nombre: string | null;
    readonly cuentas: number;
    readonly venta: string;
    readonly propina: string;
  }>`
    select per.nombre                              as "nombre",
           count(*)::int                           as "cuentas",
           sum(o.total_centavos)::text             as "venta",
           coalesce(sum(t.propina), 0)::text       as "propina"
      from ordenes o
      join organizaciones og on og.id = o.organizacion_id
      ${PROPINA_DE_LA_ORDEN}
      left join empleos e on e.id = o.empleado_atiende_id and e.organizacion_id = o.organizacion_id
      left join personas per on per.id = e.persona_id and per.organizacion_id = e.organizacion_id
     where o.organizacion_id = ${organizacionId}
       and ${ORDEN_VENDIDA}
       and ${DIA_DEL_NEGOCIO} between ${rango.desde}::date and ${rango.hasta}::date
     group by per.nombre, o.empleado_atiende_id
     order by sum(o.total_centavos) desc, per.nombre
  `.execute(tx);
  return rows.map((f) => ({
    nombre: f.nombre,
    cuentas: f.cuentas,
    ventaCentavos: f.venta,
    propinaCentavos: f.propina,
  }));
}

export async function loMasVendidoEnLaBase(
  tx: Transaccion,
  organizacionId: string,
  rango: Rango,
): Promise<LoMasVendido> {
  const armado = armarLoMasVendido(
    await vendidoPorPlatillo(tx, organizacionId, rango),
    await devueltoPorPlatillo(tx, organizacionId, rango),
  );
  const cuentas = await ventasDeLasCuentas(tx, organizacionId, rango);
  return {
    desde: rango.desde,
    hasta: rango.hasta,
    ...armado,
    cuentas: {
      cantidad: cuentas.cantidad,
      ventasCentavos: cuentas.ventas.toString(),
      ajusteCentavos: (cuentas.ventas - BigInt(armado.vendidoCentavos)).toString(),
    },
    meseros: await ventasPorMesero(tx, organizacionId, rango),
  };
}

export const loMasVendido = definirComando<Transaccion, typeof entradaLoMasVendido, LoMasVendido>({
  nombre: 'registros.lo_mas_vendido',
  entidad: 'orden',
  escribe: false,
  // Los tres puestos que ven Registros (como `registros.resumen`).
  roles: ['dueno', 'administrador', 'gerente'],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaLoMasVendido,
  async ejecutar(ctx, entrada) {
    return ctx.paso('agregar', () =>
      loMasVendidoEnLaBase(ctx.tx, ctx.ambito.organizacionId, {
        desde: entrada.desde,
        hasta: entrada.hasta,
      }),
    );
  },
});
