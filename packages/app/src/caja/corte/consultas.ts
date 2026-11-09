import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import type { AlcanceDelCorte } from './alcance-del-corte.ts';
import { estadoDelCostoDe, lineaSinCosto, lineaSinCostoCompleto } from './costo-conocido.ts';

/**
 * LO QUE TODO CORTE LLEVA, leído de la base en la transacción del documento (C.6 de la 2.4).
 *
 * Cada `02-DINERO-Y-CAJA.md` §9.3 pide su corte sección por sección, y las cinco comparten
 * un tronco: quién abrió y cerró, el arqueo con su fondo, de dónde salió el esperado, las
 * ventas por método con su propina, el detalle, los productos, los gastos, las
 * cancelaciones, el inventario bajo y lo que se consumió. Aquí va ese tronco; lo propio de
 * cada giro vive en `extras.ts`.
 *
 * Todas van ACOTADAS a la organización y a la sesión —o a su ventana de tiempo cuando la
 * fila no guarda la sesión—, con un tope de filas. Los importes salen como texto de
 * `bigint`: el navegador los recibe en centavos y ningún número pasa por coma flotante.
 */

/** Tope de filas de las tablas largas del documento: un día de restaurante lleno cabe. */
export const TOPE_DE_FILAS = 500;

/**
 * La ventana de una sesión: desde que se abrió hasta que se cerró. Con la caja abierta, quien la
 * lee pone el «hasta» (`ctx.ahora`, el `alcance` del corte): DP-13.2, nada lee su propio reloj.
 */
export type Ventana = Pick<SesionDelCorte, 'sucursalId' | 'abiertaEn' | 'cerradaEn'>;

export interface SesionDelCorte {
  readonly id: string;
  readonly sucursalId: string;
  readonly serie: string;
  readonly folio: string | null;
  readonly estado: string;
  readonly turno: string | null;
  readonly abiertaEn: Date;
  readonly cerradaEn: Date | null;
  readonly notasApertura: string | null;
  readonly notasCierre: string | null;
  readonly fondoInicialCentavos: string;
  readonly fondoEsperadoCentavos: string;
  readonly fondoMonedasCentavos: string;
  readonly fondoChicosCentavos: string;
  readonly fondoGrandesCentavos: string;
  readonly contadoCentavos: string | null;
  readonly retiradoCentavos: string | null;
  readonly esperadoCentavos: string | null;
  readonly diferenciaCentavos: string | null;
  readonly boteContadoCentavos: string | null;
  readonly saldoRecargasAperturaCentavos: string;
  readonly saldoRecargasCierreCentavos: string | null;
  readonly terminal: string | null;
  readonly sucursal: string;
  readonly sucursalDireccion: string | null;
  readonly sucursalTelefono: string | null;
  readonly abrio: string | null;
  readonly cerro: string | null;
}

export async function leerSesion(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<SesionDelCorte | null> {
  const { rows } = await sql<SesionDelCorte>`
    select s.id                                   as "id",
           s.sucursal_id                          as "sucursalId",
           s.serie                                as "serie",
           s.folio::text                          as "folio",
           s.estado                               as "estado",
           s.turno                                as "turno",
           s.abierta_en                           as "abiertaEn",
           s.cerrada_en                           as "cerradaEn",
           s.notas_apertura                       as "notasApertura",
           s.notas_cierre                         as "notasCierre",
           s.fondo_inicial_centavos::text         as "fondoInicialCentavos",
           s.fondo_esperado_centavos::text        as "fondoEsperadoCentavos",
           s.fondo_monedas_centavos::text         as "fondoMonedasCentavos",
           s.fondo_chicos_centavos::text          as "fondoChicosCentavos",
           s.fondo_grandes_centavos::text         as "fondoGrandesCentavos",
           s.efectivo_contado_centavos::text      as "contadoCentavos",
           s.efectivo_retirado_centavos::text     as "retiradoCentavos",
           s.efectivo_esperado_centavos::text     as "esperadoCentavos",
           s.diferencia_centavos::text            as "diferenciaCentavos",
           s.bote_contado_centavos::text          as "boteContadoCentavos",
           s.saldo_recargas_apertura_centavos::text as "saldoRecargasAperturaCentavos",
           s.saldo_recargas_cierre_centavos::text as "saldoRecargasCierreCentavos",
           t.nombre                               as "terminal",
           su.nombre                              as "sucursal",
           su.direccion                           as "sucursalDireccion",
           su.telefono                            as "sucursalTelefono",
           ea.nombre                              as "abrio",
           ec.nombre                              as "cerro"
      from sesiones_caja s
      join sucursales su on su.id = s.sucursal_id and su.organizacion_id = s.organizacion_id
      left join terminales t on t.id = s.terminal_id and t.organizacion_id = s.organizacion_id
      left join empleados_visibles ea on ea.id = s.empleado_abre_id
      left join empleados_visibles ec on ec.id = s.empleado_cierra_id
     where s.organizacion_id = ${organizacionId}
       and s.id = ${sesionCajaId}
  `.execute(tx);
  return rows[0] ?? null;
}

export interface NegocioCrudo {
  readonly nombre: string;
  readonly giro: string;
  readonly paquete: string;
  readonly valores: unknown;
}

export async function leerNegocio(tx: Transaccion, organizacionId: string): Promise<NegocioCrudo> {
  const { rows } = await sql<NegocioCrudo>`
    select o.nombre as "nombre", o.giro as "giro", o.paquete as "paquete", c.valores as "valores"
      from organizaciones o
      left join configuracion c on c.organizacion_id = o.id
     where o.id = ${organizacionId}
  `.execute(tx);
  const fila = rows[0];
  if (fila === undefined) throw new Error('La organización del corte no existe.');
  return fila;
}

export interface MovimientoAgrupado {
  readonly tipo: string;
  readonly montoCentavos: string;
  readonly cuantos: number;
}

/** «De dónde salió el efectivo esperado»: los movimientos del cajón, por tipo. */
export async function movimientosPorTipo(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly MovimientoAgrupado[]> {
  const { rows } = await sql<MovimientoAgrupado>`
    select m.tipo                           as "tipo",
           sum(m.monto_centavos)::text      as "montoCentavos",
           count(*)::int                    as "cuantos"
      from movimientos_caja m
     where m.organizacion_id = ${organizacionId}
       and m.sesion_caja_id = ${sesionCajaId}
     group by m.tipo
     order by min(m.created_at)
  `.execute(tx);
  return rows;
}

/**
 * DP-15.1 · Un AJUSTE del cajón, con su motivo y quién lo hizo.
 *
 * El agrupado de arriba sólo dice «Ajustes: +$55». Un ajuste cambia lo que el corte espera sin que
 * haya pasado dinero, así que es el único movimiento capaz de tapar un faltante: el corte lo enseña
 * uno por uno para que la diferencia de la noche no salga limpia sin que nadie sepa por qué.
 */
export interface AjusteDelCorte {
  readonly movimientoId: string;
  /** Con signo: a la baja es negativo. */
  readonly montoCentavos: string;
  readonly motivo: string | null;
  /** Quién lo registró (no necesariamente quien tiene la caja). */
  readonly quien: string | null;
  readonly registradoEn: string;
}

export async function ajustesDelCorte(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly AjusteDelCorte[]> {
  const { rows } = await sql<AjusteDelCorte>`
    select m.id::text                          as "movimientoId",
           m.monto_centavos::text              as "montoCentavos",
           m.motivo                            as "motivo",
           ev.nombre                           as "quien",
           to_char(m.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                                               as "registradoEn"
      from movimientos_caja m
      left join empleados_visibles ev on ev.id = m.empleado_id
     where m.organizacion_id = ${organizacionId}
       and m.sesion_caja_id = ${sesionCajaId}
       and m.tipo = 'ajuste'
     order by m.created_at, m.id
     limit ${TOPE_DE_FILAS}
  `.execute(tx);
  return rows;
}

export interface PiezasContadas {
  readonly denominacionCentavos: string;
  readonly piezas: number;
}

export async function conteoDelCierre(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly PiezasContadas[]> {
  const { rows } = await sql<PiezasContadas>`
    select d.denominacion_centavos::text as "denominacionCentavos", d.piezas as "piezas"
      from conteos_denominacion d
     where d.organizacion_id = ${organizacionId}
       and d.sesion_caja_id = ${sesionCajaId}
       and d.momento = 'cierre'
     order by d.denominacion_centavos desc
  `.execute(tx);
  return rows;
}

export interface VentasPorMetodo {
  readonly metodo: string;
  readonly ventasCentavos: string;
  readonly propinasCentavos: string;
  readonly pagos: number;
}

/** Ventas, propina y total por método: la tabla que concilia el voucher con lo declarado. */
export async function ventasPorMetodo(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly VentasPorMetodo[]> {
  const { rows } = await sql<VentasPorMetodo>`
    select p.metodo                          as "metodo",
           sum(p.monto_centavos)::text       as "ventasCentavos",
           sum(p.propina_centavos)::text     as "propinasCentavos",
           count(*)::int                     as "pagos"
      from pagos p
     where p.organizacion_id = ${organizacionId}
       and p.sesion_caja_id = ${sesionCajaId}
       and p.estado = 'confirmado'
     group by p.metodo
     order by sum(p.monto_centavos) desc
  `.execute(tx);
  return rows;
}

export interface ResumenDeVentas {
  readonly tickets: number;
  readonly totalCentavos: string;
  readonly descuentoCentavos: string;
  readonly impuestosCentavos: string;
  readonly costoCentavos: string;
  /**
   * DP-13.2 · La base del margen (`costo-conocido.ts`): lo vendido y lo que costó en las cuentas
   * con costo conocido, y cuántas quedaron fuera por no tener receta o tenerla incompleta.
   */
  readonly ventaConCostoCentavos: string;
  readonly costoConocidoCentavos: string;
  readonly ventasSinReceta: number;
  readonly ventasRecetaIncompleta: number;
}

/**
 * Lo COBRADO y vivo. Una orden cancelada o dividida no es venta. El corte cuenta además la
 * devuelta entera por documento —ver `ORDEN_VENDIDA`—, que sigue siendo venta de su día.
 */
export const ESTADOS_VENDIDOS = ['pagada', 'parcialmente_reembolsada'] as const;

/**
 * UNA ORDEN VENDIDA EN ESTA CAJA, en SQL sobre el alias `o` (cierre de la 2.4).
 *
 * Cobrada, devuelta en parte, o devuelta ENTERA por un documento de devolución (178): la
 * devuelta sigue siendo venta de SU día, y la devolución resta del día en que se hace
 * («el histórico no se toca», ferretería §1). Antes una venta devuelta entera mañana
 * desaparecía del corte de hoy —ya cerrado— y la devolución no restaba en ninguno. Lo que
 * el pedido de barra reembolsó (`venta.devolver`: sus pagos en `reembolsado`, sin
 * documento) no se vendió y no entra.
 */
export const ORDEN_VENDIDA = sql`(o.estado in ('pagada', 'parcialmente_reembolsada') or (o.estado = 'reembolsada' and exists (select 1 from devoluciones dv where dv.organizacion_id = o.organizacion_id and dv.orden_id = o.id)))`;

export async function resumenDeVentas(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<ResumenDeVentas> {
  const { rows } = await sql<ResumenDeVentas>`
    select count(*)::int                                  as "tickets",
           coalesce(sum(o.total_centavos), 0)::text       as "totalCentavos",
           coalesce(sum(o.descuento_centavos), 0)::text   as "descuentoCentavos",
           coalesce(sum(o.impuestos_centavos), 0)::text   as "impuestosCentavos",
           coalesce(sum(o.costo_total_centavos), 0)::text as "costoCentavos",
           coalesce(sum(o.total_centavos) filter (where e.estado = 'conocido'), 0)::text
                                                          as "ventaConCostoCentavos",
           coalesce(sum(o.costo_total_centavos) filter (where e.estado = 'conocido'), 0)::text
                                                          as "costoConocidoCentavos",
           (count(*) filter (where e.estado = 'sin_receta'))::int        as "ventasSinReceta",
           (count(*) filter (where e.estado = 'receta_incompleta'))::int as "ventasRecetaIncompleta"
      from ordenes o
      cross join lateral (select ${estadoDelCostoDe('o')} as estado) e
     where o.organizacion_id = ${organizacionId}
       and o.sesion_caja_id = ${sesionCajaId}
       and ${ORDEN_VENDIDA}
  `.execute(tx);
  return (
    rows[0] ?? {
      tickets: 0,
      totalCentavos: '0',
      descuentoCentavos: '0',
      impuestosCentavos: '0',
      costoCentavos: '0',
      ventaConCostoCentavos: '0',
      costoConocidoCentavos: '0',
      ventasSinReceta: 0,
      ventasRecetaIncompleta: 0,
    }
  );
}

export interface VentaDelDetalle {
  readonly folio: string | null;
  readonly cobradaEn: Date | null;
  readonly mesa: string | null;
  readonly nombrePedido: string | null;
  readonly cliente: string | null;
  readonly canal: string;
  readonly productos: string | null;
  /** DP-15 · Las líneas con su peso vendido, para que el documento las diga como el visor. */
  readonly lineas: readonly LineaDelDetalle[] | null;
  readonly totalCentavos: string;
  readonly pago: string | null;
  readonly atendio: string | null;
}

export interface LineaDelDetalle {
  readonly nombre: string;
  readonly cantidad: string;
  readonly unidad: string | null;
  readonly tipoVenta: string | null;
  readonly cantidadVariable: string | null;
  readonly unidadVariable: string | null;
}

/**
 * El detalle de ventas. La referencia que se RECUERDA —la mesa, el nombre del pedido, la
 * clienta— va con el folio, y los productos con su cantidad real («0.5 kg × Arrachera»).
 *
 * DP-15 · Las cantidades salen con trim_scale, no con to_char('FM999999990.###'): en to_char el «#»
 * no es un dígito, así que ese patrón REDONDEABA a entero (½ kg salía «1 kg», ¼ kg «0») en el detalle,
 * en «Productos vendidos» y en las existencias del inventario bajo.
 */
export async function detalleDeVentas(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly VentaDelDetalle[]> {
  const { rows } = await sql<VentaDelDetalle>`
    select o.serie || '-' || o.folio::text                   as "folio",
           coalesce(o.cobrada_en, o.cerrada_en, o.updated_at) as "cobradaEn",
           case when m.id is null then null
                else coalesce(m.nombre, 'Mesa ' || m.numero::text) end as "mesa",
           o.nombre_pedido                                    as "nombrePedido",
           coalesce(c.nombre, o.cliente_nombre)               as "cliente",
           o.canal                                            as "canal",
           (select string_agg(
                     trim_scale(l.cantidad::numeric)::text || ' ' || l.unidad
                       || ' × ' || l.producto_nombre, ', ' order by l.orden_visual)
              from orden_lineas l
             where l.orden_id = o.id and l.organizacion_id = o.organizacion_id
               and l.anulada_en is null)                      as "productos",
           (select json_agg(json_build_object(
                     'nombre', l.producto_nombre,
                     'cantidad', trim_scale(l.cantidad::numeric)::text,
                     'unidad', l.unidad,
                     'tipoVenta', l.tipo_venta,
                     'cantidadVariable', trim_scale(l.cantidad_variable::numeric)::text,
                     'unidadVariable', l.unidad_variable) order by l.orden_visual)
              from orden_lineas l
             where l.orden_id = o.id and l.organizacion_id = o.organizacion_id
               and l.anulada_en is null)                      as "lineas",
           o.total_centavos::text                             as "totalCentavos",
           (select string_agg(distinct p.metodo, ' + ')
              from pagos p
             where p.orden_id = o.id and p.organizacion_id = o.organizacion_id
               and p.estado = 'confirmado')                   as "pago",
           ev.nombre                                          as "atendio"
      from ordenes o
      left join mesas m on m.id = o.mesa_id and m.organizacion_id = o.organizacion_id
      left join clientes c on c.id = o.cliente_id and c.organizacion_id = o.organizacion_id
      left join empleados_visibles ev
             on ev.id = coalesce(o.mostradorista_id, o.empleado_atiende_id, o.empleado_cobra_id)
     where o.organizacion_id = ${organizacionId}
       and o.sesion_caja_id = ${sesionCajaId}
       and ${ORDEN_VENDIDA}
     order by coalesce(o.cobrada_en, o.cerrada_en, o.updated_at)
     limit ${TOPE_DE_FILAS}
  `.execute(tx);
  return rows;
}

export interface ProductoVendido {
  readonly nombre: string;
  readonly categoria: string | null;
  readonly lineas: number;
  readonly cantidad: string;
  readonly unidad: string;
  readonly totalCentavos: string;
  readonly costoCentavos: string;
  /**
   * DP-13.2 / DP-14.6-2 · Cuántas de sus líneas NO tienen el costo completo (`costo-conocido.ts`):
   * sin receta, o con un insumo en cero.
   */
  readonly lineasSinCosto: number;
  /** De ésas, las que no tienen receta del todo (el resto es «receta incompleta»). */
  readonly lineasSinReceta: number;
  /** Es un SERVICIO del salón (tiene fila en `servicios`), no producto de anaquel. */
  readonly esServicio: boolean;
  /** `bebida`, `alimento`, `grano` u `otro`: lo que la cafetería cuenta como bebidas. */
  readonly familia: string | null;
  /** La línea de la ferretería, que es como se lee su margen. */
  readonly linea: string | null;
  /** El margen objetivo de sus productos, en puntos base, promediado. */
  readonly margenObjetivoBp: number | null;
  /** Quién lo vendió: la profesional de la línea, en el salón. */
  readonly vendio: string | null;
}

/** Productos vendidos: líneas y CANTIDAD REAL son dos columnas (40 líneas ≠ 12 kg). */
export async function productosVendidos(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly ProductoVendido[]> {
  const { rows } = await sql<ProductoVendido>`
    select l.producto_nombre                                   as "nombre",
           max(cat.nombre)                                     as "categoria",
           count(*)::int                                       as "lineas",
           -- DP-15 · Lo que se vende por peso cuenta su PESO (cantidad_variable), no la pieza de la línea.
           trim_scale((sum(case when l.tipo_venta = 'variable_medida'
                                  then coalesce(l.cantidad_variable, l.cantidad)
                                  else l.cantidad end::numeric))::numeric)::text as "cantidad",
           max(case when l.tipo_venta = 'variable_medida'
                    then coalesce(l.unidad_variable, l.unidad)
                    else l.unidad end)                         as "unidad",
           sum(l.total_centavos)::text                         as "totalCentavos",
           sum(l.total_centavos - l.utilidad_centavos)::text   as "costoCentavos",
           (count(*) filter (where ${lineaSinCostoCompleto('l')}))::int as "lineasSinCosto",
           (count(*) filter (where ${lineaSinCosto('l')}))::int as "lineasSinReceta",
           bool_or(sv.producto_id is not null)                 as "esServicio",
           max(pr.familia)                                     as "familia",
           max(li.nombre)                                      as "linea",
           round(avg(pr.margen_bp))::int                       as "margenObjetivoBp",
           string_agg(distinct pf.nombre_corto, ', ')          as "vendio"
      from orden_lineas l
      join ordenes o on o.id = l.orden_id and o.organizacion_id = l.organizacion_id
      left join productos pr on pr.id = l.producto_id and pr.organizacion_id = l.organizacion_id
      left join servicios sv on sv.producto_id = l.producto_id and sv.organizacion_id = l.organizacion_id
      left join lineas li on li.id = pr.linea_id and li.organizacion_id = l.organizacion_id
      left join profesionales pf on pf.id = l.profesional_id and pf.organizacion_id = l.organizacion_id
      left join categorias cat on cat.id = pr.categoria_id and cat.organizacion_id = l.organizacion_id
     where l.organizacion_id = ${organizacionId}
       and o.sesion_caja_id = ${sesionCajaId}
       and ${ORDEN_VENDIDA}
       and l.anulada_en is null
     group by l.producto_nombre, l.producto_id
     order by sum(l.utilidad_centavos) desc, sum(l.total_centavos) desc
     limit ${TOPE_DE_FILAS}
  `.execute(tx);
  return rows;
}

export interface VentasDePersona {
  readonly nombre: string | null;
  readonly ventas: number;
  readonly importeCentavos: string;
  readonly lineas: number;
  readonly descuentoCentavos: string;
}

/** Quién vendió: mostradorista, mesero o quien cobró, en ese orden. */
export async function ventasPorPersona(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly VentasDePersona[]> {
  const { rows } = await sql<VentasDePersona>`
    select ev.nombre                                  as "nombre",
           count(*)::int                              as "ventas",
           sum(o.total_centavos)::text                as "importeCentavos",
           coalesce(sum((select count(*) from orden_lineas l
                          where l.orden_id = o.id and l.anulada_en is null)), 0)::int as "lineas",
           sum(o.descuento_centavos)::text            as "descuentoCentavos"
      from ordenes o
      left join empleados_visibles ev
             on ev.id = coalesce(o.mostradorista_id, o.empleado_atiende_id, o.empleado_cobra_id)
     where o.organizacion_id = ${organizacionId}
       and o.sesion_caja_id = ${sesionCajaId}
       and ${ORDEN_VENDIDA}
     group by ev.nombre
     order by sum(o.total_centavos) desc
  `.execute(tx);
  return rows;
}

export interface GastoDelCorte {
  readonly categoria: string;
  readonly descripcion: string;
  readonly metodo: string;
  readonly montoCentavos: string;
}

export async function gastosDelCorte(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly GastoDelCorte[]> {
  const { rows } = await sql<GastoDelCorte>`
    select g.categoria                 as "categoria",
           g.descripcion               as "descripcion",
           g.metodo_pago               as "metodo",
           g.monto_centavos::text      as "montoCentavos"
      from gastos g
     where g.organizacion_id = ${organizacionId}
       and g.sesion_caja_id = ${sesionCajaId}
     order by g.created_at
     limit ${TOPE_DE_FILAS}
  `.execute(tx);
  return rows;
}

// Las cancelaciones salieron a su propio archivo (DP-12.4): las leen la hoja del corte, la lectura
// del corte heredado y Registros, y el archivo ya pasaba de 600 líneas.
export { cancelacionesDelCorte, type Cancelacion } from './cancelaciones.ts';
export { alcanceDelCorte, type AlcanceDelCorte } from './alcance-del-corte.ts';

export interface DescuentoDeUsuario {
  readonly usuario: string | null;
  readonly ventas: number;
  readonly montoCentavos: string;
}

export async function descuentosPorUsuario(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly DescuentoDeUsuario[]> {
  const { rows } = await sql<DescuentoDeUsuario>`
    select ev.nombre                       as "usuario",
           count(*)::int                   as "ventas",
           sum(o.descuento_centavos)::text as "montoCentavos"
      from ordenes o
      left join empleados_visibles ev on ev.id = o.empleado_cobra_id
     where o.organizacion_id = ${organizacionId}
       and o.sesion_caja_id = ${sesionCajaId}
       and ${ORDEN_VENDIDA}
       and o.descuento_centavos > 0
     group by ev.nombre
     order by sum(o.descuento_centavos) desc
  `.execute(tx);
  return rows;
}

export interface Alerta {
  readonly nombre: string;
  readonly existencia: string;
  readonly minimo: string;
  readonly critico: string;
  readonly unidad: string;
  readonly proveedor: string | null;
  /** 1 = lunes … 7 = domingo. Vacío: el proveedor no tiene ruta, se le llama. */
  readonly diaVisita: readonly number[] | null;
  /** Lo vendido en los últimos 14 días, en unidad base. */
  readonly ventaDeCatorceDias: string;
  /** Lo vendido en 90 días: el ritmo de la ferretería, que no se mide por semana. */
  readonly ventaDeNoventaDias: string;
  /** El costo de UNA unidad base: con él se dice cuánto dinero ya duerme en el anaquel. */
  readonly costoUnitarioCentavos: string | null;
  /**
   * El consumo de UN día como hoy: el promedio de los últimos siete días de la misma semana
   * (el martes no consume como el sábado). Es lo que dice cuántos días alcanza.
   */
  readonly consumoDelMismoDia: string;
  readonly unidadCompra: string | null;
  readonly factorCompra: string | null;
}

/**
 * Lo que hay que comprar: bajo su mínimo, con el crítico al frente, y con lo que cada giro
 * necesita para decidir —el proveedor y su visita, la venta de catorce días, cuánto alcanza—.
 */
export async function alertasDeInventario(
  tx: Transaccion,
  organizacionId: string,
  ahora: Date,
): Promise<readonly Alerta[]> {
  const { rows } = await sql<Alerta>`
    with saldo as (
      select e.insumo_id, sum(e.cantidad::numeric) as cantidad
        from existencias e
       where e.organizacion_id = ${organizacionId}
       group by e.insumo_id
    ),
    venta as (
      select m.insumo_id,
             sum(abs(m.cantidad::numeric)) filter (
               where m.created_at >= ${ahora}::timestamptz - interval '14 days') as catorce,
             sum(abs(m.cantidad::numeric)) as noventa
        from movimientos_stock m
       where m.organizacion_id = ${organizacionId}
         and m.tipo = 'salida_venta'
         and m.created_at >= ${ahora}::timestamptz - interval '90 days'
       group by m.insumo_id
    ),
    mismo_dia as (
      select m.insumo_id, sum(abs(m.cantidad::numeric)) / 7.0 as diario
        from movimientos_stock m
        join organizaciones o on o.id = m.organizacion_id
       where m.organizacion_id = ${organizacionId}
         and m.tipo = 'salida_venta'
         and m.created_at >= ${ahora}::timestamptz - interval '49 days'
         and extract(isodow from m.created_at at time zone o.zona_horaria)
             = extract(isodow from ${ahora}::timestamptz at time zone o.zona_horaria)
       group by m.insumo_id
    )
    select i.nombre                                                             as "nombre",
           trim_scale(coalesce(s.cantidad, 0)::numeric)::text      as "existencia",
           trim_scale(i.stock_minimo::numeric)::text      as "minimo",
           trim_scale(i.stock_critico::numeric)::text     as "critico",
           i.unidad_base                                                        as "unidad",
           p.nombre                                                             as "proveedor",
           p.dia_visita                                                         as "diaVisita",
           trim_scale(coalesce(v.catorce, 0)::numeric)::text       as "ventaDeCatorceDias",
           trim_scale(coalesce(v.noventa, 0)::numeric)::text       as "ventaDeNoventaDias",
           i.costo_unitario_centavos::text                                      as "costoUnitarioCentavos",
           trim_scale(coalesce(d.diario, 0)::numeric)::text        as "consumoDelMismoDia",
           i.unidad_compra_default                                              as "unidadCompra",
           i.cantidad_por_compra_default::text                                  as "factorCompra"
      from insumos i
      left join saldo s on s.insumo_id = i.id
      left join venta v on v.insumo_id = i.id
      left join mismo_dia d on d.insumo_id = i.id
      left join proveedores p on p.id = i.proveedor_id and p.organizacion_id = i.organizacion_id
     where i.organizacion_id = ${organizacionId}
       and i.activo
       and i.stock_minimo::numeric > 0
       and coalesce(s.cantidad, 0) <= i.stock_minimo::numeric
     order by p.nombre nulls last,
              coalesce(s.cantidad, 0) / nullif(i.stock_minimo::numeric, 0),
              i.nombre
     limit 60
  `.execute(tx);
  return rows;
}

export interface InsumoConsumido {
  readonly nombre: string;
  readonly cantidad: string;
  readonly unidad: string;
  readonly costoUnitarioCentavos: string;
  readonly costoCentavos: string;
  readonly tipoInsumo: string;
}

/**
 * Lo que DEBIÓ salir del almacén por lo que se cobró: las salidas por venta de las órdenes
 * de la sesión. Contra el conteo físico, la diferencia es el robo hormiga y la porción
 * descontrolada. Es consumo teórico, y el documento lo rotula así.
 */
export async function insumosConsumidos(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly InsumoConsumido[]> {
  const { rows } = await sql<InsumoConsumido>`
    select i.nombre                                                             as "nombre",
           trim_scale(sum(-m.cantidad::numeric))::text          as "cantidad",
           max(m.unidad)                                                        as "unidad",
           round(sum(-m.cantidad::numeric * m.costo_unitario_centavos)
                 / nullif(sum(-m.cantidad::numeric), 0))::bigint::text         as "costoUnitarioCentavos",
           round(sum(-m.cantidad::numeric * m.costo_unitario_centavos))::bigint::text as "costoCentavos",
           max(i.tipo_insumo)                                                   as "tipoInsumo"
      from movimientos_stock m
      join ordenes o on o.id = m.referencia_id and o.organizacion_id = m.organizacion_id
      join insumos i on i.id = m.insumo_id and i.organizacion_id = m.organizacion_id
     where m.organizacion_id = ${organizacionId}
       and m.tipo = 'salida_venta'
       and m.referencia_tipo = 'orden'
       and o.sesion_caja_id = ${sesionCajaId}
     group by i.id, i.nombre
     order by sum(-m.cantidad::numeric * m.costo_unitario_centavos) desc
     limit ${TOPE_DE_FILAS}
  `.execute(tx);
  return rows;
}

export interface SalidaSinVenta {
  readonly tipo: string;
  readonly motivo: string | null;
  readonly nombre: string;
  readonly cantidad: string;
  readonly unidad: string;
  readonly costoCentavos: string;
  readonly quien: string | null;
}

/**
 * DP-13.3 · La merma de lo cancelado ya hecho (`restaurante/merma-por-cancelacion.ts`) se guarda
 * con una clave del catálogo global y se reconoce por su referencia: el corte la dice así.
 */
const motivoDeLaSalida = sql`case when m.tipo = 'merma' and m.referencia_tipo in ('orden', 'anulacion')
                                  then 'Por cancelación' else m.motivo end`;

/**
 * Merma y consumo de la casa: el dinero que salió sin venta.
 *
 * Con el MISMO alcance que las cancelaciones (DP-D50; QA2-004 de DP-13.5): el corte de una caja
 * trae lo que sacó del almacén quien la abrió mientras estaba abierta, y el Cierre del día todo lo
 * de la sucursal desde el Cierre anterior. Antes se leía por la ventana de cada caja y de toda la
 * organización: con dos cajas abiertas las dos hojas traían la misma merma, y el Cierre del día no
 * veía lo de antes de que abriera la última.
 */
export async function salidasSinVenta(
  tx: Transaccion,
  organizacionId: string,
  alcance: AlcanceDelCorte,
): Promise<readonly SalidaSinVenta[]> {
  const { sucursalId, abreId, cierraElDia, desde, hasta } = alcance;
  const { rows } = await sql<SalidaSinVenta>`
    select m.tipo                                                            as "tipo",
           ${motivoDeLaSalida}                                               as "motivo",
           i.nombre                                                          as "nombre",
           trim_scale(sum(-m.cantidad::numeric))::text       as "cantidad",
           max(m.unidad)                                                     as "unidad",
           round(sum(-m.cantidad::numeric * m.costo_unitario_centavos))::bigint::text as "costoCentavos",
           max(ev.nombre)                                                    as "quien"
      from movimientos_stock m
      join almacenes a on a.id = m.almacen_id and a.organizacion_id = m.organizacion_id
      join insumos i on i.id = m.insumo_id and i.organizacion_id = m.organizacion_id
      left join empleados_visibles ev on ev.id = m.empleado_id
     where m.organizacion_id = ${organizacionId}
       and a.sucursal_id = ${sucursalId}
       and m.tipo in ('merma', 'salida_consumo_interno')
       and m.created_at > ${desde}
       and m.created_at <= ${hasta}
       and (${cierraElDia}::boolean or m.empleado_id = ${abreId})
     group by m.tipo, ${motivoDeLaSalida}, i.id, i.nombre
     order by m.tipo, sum(-m.cantidad::numeric * m.costo_unitario_centavos) desc
     limit ${TOPE_DE_FILAS}
  `.execute(tx);
  return rows;
}
