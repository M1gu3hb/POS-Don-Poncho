import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql, type RawBuilder } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { etiquetaDeMesero, type PropinaDeMesero } from './desglose.ts';
import { resolverRango } from './rango.ts';
import {
  aMesero,
  NOMBRE_DEL_MESERO,
  PROPINA_DE_LA_ORDEN,
  type FilaDeMesero,
} from './fragmentos.ts';
import { condicionDelPeriodo, type FiltroDePropinas } from './repositorio.ts';

/**
 * `propinas.del_rango` — las propinas de un rango, por mesero, desde el servidor (A23).
 *
 * La pestaña Propinas de Registros bajaba las últimas ventas (el puente topa cada lectura en 1 000)
 * y agrupaba por mesero en el navegador: pasado el tope, las propinas viejas desaparecían sin aviso.
 * Aquí el servidor suma el rango ENTERO, en centavos enteros y sin tope: el total, lo pendiente y lo
 * liquidado, y el total por mesero. Sólo la lista de detalle va topada (`limite`), y dice si hay más.
 *
 * Es el mismo predicado que usan `propinas.pendientes` y `propinas.liquidar` (`condicionDelPeriodo`):
 * lo que Registros enseña es lo que el diálogo de liquidación va a liquidar. Pendiente ES
 * `propina_liquidacion_id is null`: no hay ninguna columna que pueda mentir.
 */

const identificador = z.uuid();

export const ESTADOS_DE_PROPINA = ['todas', 'pendientes', 'liquidadas'] as const;
export type EstadoDePropina = (typeof ESTADOS_DE_PROPINA)[number];

/** Cuántas ventas lista el detalle como máximo. Los totales NO dependen de este número. */
export const MAXIMO_DE_VENTAS_LISTADAS = 300;

export const entradaPropinasDelRango = z.object({
  desde: z.string().min(4).max(40),
  hasta: z.string().min(4).max(40),
  estado: z.enum(ESTADOS_DE_PROPINA).default('todas'),
  meseroId: identificador.nullish(),
  limite: z.number().int().min(1).max(MAXIMO_DE_VENTAS_LISTADAS).default(MAXIMO_DE_VENTAS_LISTADAS),
});

/** Una venta con propina, como la pinta el listado de Registros. */
export interface PropinaDeVenta {
  readonly ordenId: string;
  readonly serie: string;
  readonly folio: string | null;
  readonly cerradaEn: string;
  readonly mesaNumero: number | null;
  readonly meseroId: string | null;
  readonly meseroNombre: string;
  /** El método de los pagos con propina: uno, o «mixto» si fueron varios. */
  readonly metodoPago: string;
  readonly liquidada: boolean;
  readonly origen: string | null;
  readonly propinaCentavos: string;
}

export interface PropinasDelRango {
  readonly desde: string;
  readonly hasta: string;
  readonly estado: EstadoDePropina;
  readonly meseroId: string | null;
  /** Lo del rango y el estado pedidos: la suma de todos los meseros. */
  readonly totalCentavos: string;
  readonly pendientesCentavos: string;
  readonly liquidadasCentavos: string;
  readonly numeroVentas: number;
  readonly meseros: readonly PropinaDeMesero[];
  /** El detalle más reciente primero, topado por `limite`. No decide ningún importe. */
  readonly ventas: readonly PropinaDeVenta[];
  /** `true` si hay más ventas que las listadas: la pantalla debe decirlo. */
  readonly hayMasVentas: boolean;
}

const CLAUSULA_DE_ESTADO: Readonly<Record<EstadoDePropina, RawBuilder<unknown>>> = {
  todas: sql`true`,
  pendientes: sql`o.propina_liquidacion_id is null`,
  liquidadas: sql`o.propina_liquidacion_id is not null`,
};

const dondeSeCuenta = (filtro: FiltroDePropinas, estado: EstadoDePropina) =>
  sql`${condicionDelPeriodo(filtro)} and ${CLAUSULA_DE_ESTADO[estado]} and t.propina > 0`;

async function totales(tx: Transaccion, filtro: FiltroDePropinas, estado: EstadoDePropina) {
  const { rows } = await sql<{ ventas: number; total: string; pendientes: string }>`
    select count(*)::int                                                    as "ventas",
           coalesce(sum(t.propina), 0)::text                                as "total",
           coalesce(sum(t.propina) filter (where o.propina_liquidacion_id is null), 0)::text
                                                                            as "pendientes"
      from ordenes o
      ${PROPINA_DE_LA_ORDEN}
     where ${dondeSeCuenta(filtro, estado)}
  `.execute(tx);
  const fila = rows[0];
  const total = BigInt(fila?.total ?? '0');
  const pendientes = BigInt(fila?.pendientes ?? '0');
  return { ventas: fila?.ventas ?? 0, total, pendientes, liquidadas: total - pendientes };
}

async function porMesero(
  tx: Transaccion,
  filtro: FiltroDePropinas,
  estado: EstadoDePropina,
): Promise<PropinaDeMesero[]> {
  const { rows } = await sql<FilaDeMesero>`
    select o.empleado_atiende_id as empleado_id,
           max(per.nombre)       as nombre,
           count(*)::text        as ventas,
           sum(t.propina)::text  as propina
      from ordenes o
      ${PROPINA_DE_LA_ORDEN}
      ${NOMBRE_DEL_MESERO}
     where ${dondeSeCuenta(filtro, estado)}
     group by o.empleado_atiende_id
     order by sum(t.propina) desc, max(per.nombre)
  `.execute(tx);
  return rows.map(aMesero);
}

interface FilaDeVenta {
  readonly id: string;
  readonly serie: string;
  readonly folio: string | null;
  readonly cerrada_en: Date;
  readonly mesa: number | null;
  readonly empleado_id: string | null;
  readonly nombre: string | null;
  readonly metodo: string;
  readonly liquidada: boolean;
  readonly origen: string | null;
  readonly propina: string;
}

async function detalle(
  tx: Transaccion,
  filtro: FiltroDePropinas,
  estado: EstadoDePropina,
  limite: number,
): Promise<PropinaDeVenta[]> {
  const { rows } = await sql<FilaDeVenta>`
    select o.id,
           o.serie,
           o.folio::text                          as folio,
           coalesce(o.cerrada_en, o.created_at)   as cerrada_en,
           m.numero                               as mesa,
           o.empleado_atiende_id                  as empleado_id,
           per.nombre                             as nombre,
           mp.metodo                              as metodo,
           (o.propina_liquidacion_id is not null) as liquidada,
           o.propina_origen                       as origen,
           t.propina::text                        as propina
      from ordenes o
      ${PROPINA_DE_LA_ORDEN}
      ${NOMBRE_DEL_MESERO}
      left join mesas m on m.id = o.mesa_id and m.organizacion_id = o.organizacion_id
      cross join lateral (
        select case when count(distinct p.metodo) = 1 then min(p.metodo) else 'mixto' end as metodo
          from pagos p
         where p.orden_id = o.id
           and p.organizacion_id = o.organizacion_id
           and p.estado = 'confirmado'
           and p.propina_centavos > 0
      ) mp
     where ${dondeSeCuenta(filtro, estado)}
     order by coalesce(o.cerrada_en, o.created_at) desc, o.id
     limit ${limite}
  `.execute(tx);
  return rows.map((fila) => ({
    ordenId: fila.id,
    serie: fila.serie,
    folio: fila.folio,
    cerradaEn: fila.cerrada_en.toISOString(),
    mesaNumero: fila.mesa,
    meseroId: fila.empleado_id,
    meseroNombre: etiquetaDeMesero(fila.nombre),
    metodoPago: fila.metodo,
    liquidada: fila.liquidada,
    origen: fila.origen,
    propinaCentavos: fila.propina,
  }));
}

export const propinasDelRango = definirComando<
  Transaccion,
  typeof entradaPropinasDelRango,
  PropinasDelRango
>({
  nombre: 'propinas.del_rango',
  entidad: 'liquidacion_propina',
  escribe: false,
  // Los puestos que ven Registros y liquidan: es dinero de la gente, no una ruta abierta.
  roles: ['dueno', 'administrador', 'gerente'],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { meseroId: 'empleos' },
  entrada: entradaPropinasDelRango,
  async ejecutar(ctx, entrada) {
    const { organizacionId, sucursalId } = ctx.ambito;
    // Como `pendientes`: la propina por mesero es de UNA sucursal; un panel de toda la organización
    // es otra pregunta (agregada por sucursal) y no se ensancha por accidente.
    if (sucursalId === null) {
      throw new ErrorDominio(
        'LIQUIDACION_INVALIDA',
        'Para ver las propinas hace falta estar en una sucursal.',
      );
    }
    const rango = resolverRango(entrada.desde, entrada.hasta);
    const filtro: FiltroDePropinas = {
      organizacionId,
      sucursalId,
      meseroId: entrada.meseroId ?? null,
      ...rango,
    };
    const [suma, meseros, ventas] = await ctx.paso('leer_propinas', () =>
      Promise.all([
        totales(ctx.tx, filtro, entrada.estado),
        porMesero(ctx.tx, filtro, entrada.estado),
        detalle(ctx.tx, filtro, entrada.estado, entrada.limite),
      ]),
    );
    return {
      desde: rango.inicio.toISOString(),
      hasta: rango.fin.toISOString(),
      estado: entrada.estado,
      meseroId: filtro.meseroId,
      totalCentavos: suma.total.toString(),
      pendientesCentavos: suma.pendientes.toString(),
      liquidadasCentavos: suma.liquidadas.toString(),
      numeroVentas: suma.ventas,
      meseros,
      ventas,
      hayMasVentas: suma.ventas > ventas.length,
    };
  },
});
