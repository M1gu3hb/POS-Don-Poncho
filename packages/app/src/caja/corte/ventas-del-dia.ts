import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../../definicion.ts';
import { alcanceDelCorte, type AlcanceDelCorte } from './alcance-del-corte.ts';
import { ORDEN_VENDIDA, type VentasPorMetodo } from './consultas.ts';
import { opcionesVendidasEn, type OpcionVendida } from './opciones-vendidas.ts';
import { retirosConPinEn, type RetiroConPinDelCorte } from './retiros-con-pin.ts';

/**
 * DP-15 · QA de la jornada, J-H6 · LAS VENTAS DEL DÍA EN EL CIERRE DEL DÍA.
 *
 * Con dos cajas, cada corte cuenta SUS cuentas (DP-D50) y el Cierre del día es el corte de la
 * última caja: su resumen de ventas era el de esa caja nada más, y quien sólo lee el Cierre creía
 * que el día vendió la mitad. El corte que cierra el día trae aparte las ventas de TODAS las cajas
 * de su ventana: las de la sucursal que cerraron después del Cierre del día anterior y hasta éste
 * (la misma ventana de sus cancelaciones, `alcance-del-corte.ts`), con la misma regla de venta y
 * los mismos pagos que el corte de cada caja. Así la suma de los cortes es el día, al centavo.
 */

const ROLES_DE_CAJA = ['cajero', 'gerente', 'administrador', 'dueno'] as const;

export interface VentasDelDia {
  /** Cuántas cajas cerraron en la ventana del día (la de este corte incluida). */
  readonly cajas: number;
  readonly tickets: number;
  readonly totalCentavos: string;
  readonly propinasCentavos: string;
  readonly metodos: readonly VentasPorMetodo[];
  /** DP-17 · Mesas y para llevar del DÍA (`llevar` es para llevar; lo demás, mesas). */
  readonly canales: readonly {
    readonly grupo: 'mesas' | 'llevar';
    readonly cuentas: number;
    readonly totalCentavos: string;
  }[];
  /** DP-17 · Las opciones vendidas y los retiros con PIN de TODAS las cajas del día. */
  readonly opciones: readonly OpcionVendida[];
  readonly retirosConPin: readonly RetiroConPinDelCorte[];
}

/** Las sesiones de caja de la ventana del día: las que cerraron en ella, y la del corte. */
const sesionesDelDia = (organizacionId: string, alcance: AlcanceDelCorte) => sql`
  select s.id
    from sesiones_caja s
   where s.organizacion_id = ${organizacionId}
     and s.sucursal_id = ${alcance.sucursalId}
     and (s.id = ${alcance.sesionId}
          or (s.cerrada_en > ${alcance.desde.toISOString()}::timestamptz
              and s.cerrada_en <= ${alcance.hasta.toISOString()}::timestamptz))
`;

export async function ventasDelDia(
  tx: Transaccion,
  organizacionId: string,
  alcance: AlcanceDelCorte,
): Promise<VentasDelDia> {
  const sesiones = sesionesDelDia(organizacionId, alcance);
  const [resumen, metodos, canales, opciones, retirosConPin] = await Promise.all([
    sql<{ cajas: number; tickets: number; totalCentavos: string }>`
      select (select count(*) from (${sesiones}) d)::int     as "cajas",
             count(o.id)::int                                as "tickets",
             coalesce(sum(o.total_centavos), 0)::text        as "totalCentavos"
        from ordenes o
       where o.organizacion_id = ${organizacionId}
         and o.sesion_caja_id in (${sesiones})
         and ${ORDEN_VENDIDA}
    `.execute(tx),
    sql<VentasPorMetodo>`
      select p.metodo                          as "metodo",
             sum(p.monto_centavos)::text       as "ventasCentavos",
             sum(p.propina_centavos)::text     as "propinasCentavos",
             count(*)::int                     as "pagos"
        from pagos p
       where p.organizacion_id = ${organizacionId}
         and p.sesion_caja_id in (${sesiones})
         and p.estado = 'confirmado'
       group by p.metodo
       order by sum(p.monto_centavos) desc
    `.execute(tx),
    sql<VentasDelDia['canales'][number]>`
      select case when o.canal = 'llevar' then 'llevar' else 'mesas' end  as "grupo",
             count(*)::int                                                as "cuentas",
             sum(o.total_centavos)::text                                  as "totalCentavos"
        from ordenes o
       where o.organizacion_id = ${organizacionId}
         and o.sesion_caja_id in (${sesiones})
         and ${ORDEN_VENDIDA}
       group by 1
       order by 1 desc
    `.execute(tx),
    opcionesVendidasEn(tx, organizacionId, sesiones),
    retirosConPinEn(tx, organizacionId, sesiones),
  ]);
  const fila = resumen.rows[0] ?? { cajas: 1, tickets: 0, totalCentavos: '0' };
  const propinas = metodos.rows.reduce((suma, m) => suma + BigInt(m.propinasCentavos), 0n);
  return {
    ...fila,
    propinasCentavos: propinas.toString(),
    metodos: metodos.rows,
    canales: canales.rows,
    opciones,
    retirosConPin,
  };
}

/**
 * Las ventas del día, sólo si el corte cierra el día Y el día tuvo más de una caja: con una sola,
 * el resumen de su corte ya es el día y repetirlo sólo estorba.
 */
export async function ventasDelDiaConVariasCajas(
  tx: Transaccion,
  organizacionId: string,
  alcance: AlcanceDelCorte,
): Promise<VentasDelDia | null> {
  if (!alcance.cierraElDia) return null;
  const delDia = await ventasDelDia(tx, organizacionId, alcance);
  return delDia.cajas > 1 ? delDia : null;
}

export const entradaVentasDelDia = z.object({ sesionCajaId: z.uuid() });

/** `null` si el corte no cierra el día o si el día tuvo una sola caja: su resumen ya basta. */
export const ventasDelDiaDelCorte = definirComando<
  Transaccion,
  typeof entradaVentasDelDia,
  VentasDelDia | null
>({
  nombre: 'caja.ventas_del_dia',
  entidad: 'sesion_caja',
  escribe: false,
  roles: [...ROLES_DE_CAJA],
  paquetes: PAQUETES_MOSTRADOR,
  sucursal: { sesionCajaId: 'sesiones_caja' },
  entrada: entradaVentasDelDia,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const alcance = await ctx.paso('leer_alcance', () =>
      alcanceDelCorte(ctx.tx, organizacionId, entrada.sesionCajaId, ctx.ahora),
    );
    if (alcance === null) {
      throw new ErrorDominio('PUENTE_NO_ENCONTRADO', 'Ese corte no existe en este negocio.');
    }
    return ctx.paso('leer_ventas_del_dia', () =>
      ventasDelDiaConVariasCajas(ctx.tx, organizacionId, alcance),
    );
  },
});
