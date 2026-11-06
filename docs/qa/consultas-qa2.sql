-- ============================================================================
-- consultas-qa2.sql · QA-2 de POS Don Poncho · SÓLO LECTURA
-- ----------------------------------------------------------------------------
-- Para la COPIA DESECHABLE (morphiqpos_qa, :5442). La base es COMPARTIDA con tres negocios de
-- demostración: TODA consulta va acotada a `:org`. Nada aquí escribe (la sesión entera es
-- `begin read only`). No crea tablas, ni siquiera temporales.
--
--   psql -h localhost -p 5442 -U morphiqpos -d morphiqpos_qa -X -f docs/qa/consultas-qa2.sql
--
-- Convención: una consulta de «VIOLACIÓN» no debe devolver filas (si devuelve, es un hallazgo);
-- una de «CUADRE» devuelve una tabla para comparar contra lo que dice la aplicación.
-- `:aud0` es el último id de `auditoria` ANTES de la jornada (lo anterior es historia de la
-- carga de la copia y de la purga del 1-nov); súbelo si repites sobre otra copia.
-- ============================================================================

\set org '617ec3ad-cdc5-46d4-8d71-a1ed479c496b'
\set suc '97010266-5e88-4597-a76e-19091bc37b0c'
\set aud0 4552
\pset null '∅'
\pset pager off

begin read only;

-- ############################################################################
-- 0 · FOTO DEL DÍA (para saber qué hay)
-- ############################################################################
\echo '== 0.1 Foto: conteos de la jornada'
select (select count(*) from ordenes where organizacion_id = :'org')                         as ordenes,
       (select count(*) from ordenes where organizacion_id = :'org' and estado = 'pagada')    as pagadas,
       (select count(*) from ordenes where organizacion_id = :'org' and estado = 'cancelada') as canceladas,
       (select count(*) from pagos where organizacion_id = :'org')                            as pagos,
       (select count(*) from sesiones_caja where organizacion_id = :'org')                    as cajas,
       (select count(*) from comandas where organizacion_id = :'org')                         as comandas,
       (select count(*) from movimientos_stock where organizacion_id = :'org')                as mov_stock,
       (select count(*) from auditoria where organizacion_id = :'org' and id > :aud0)         as auditoria_del_dia;

\echo '== 0.2 Foto: órdenes por estado y canal'
select estado, canal, count(*) as n, coalesce(sum(total_centavos), 0) as total_centavos
  from ordenes where organizacion_id = :'org' group by 1, 2 order by 1, 2;

-- ############################################################################
-- 1 · CUENTAS (ordenes, orden_lineas, pagos)
-- ############################################################################
\echo '== C01 VIOLACIÓN · cuenta cobrada sin pago confirmado, o pagos que no suman el total'
select o.id, o.serie || '-' || o.folio as folio, o.estado, o.total_centavos,
       coalesce(sum(p.monto_centavos) filter (where p.estado = 'confirmado'), 0) as pagado
  from ordenes o
  left join pagos p on p.orden_id = o.id and p.organizacion_id = o.organizacion_id
 where o.organizacion_id = :'org' and o.estado = 'pagada'
 group by o.id
having coalesce(sum(p.monto_centavos) filter (where p.estado = 'confirmado'), 0) <> o.total_centavos;

\echo '== C02 VIOLACIÓN · total ≠ subtotal − descuento; impuestos ≠ IVA incluido 16 %; utilidad ≠ total − costo'
-- La regla de impuesto sale de la configuración del negocio (`valores.impuesto`); sin ella rige el
-- predeterminado del sistema: 1600 pb (16 %) incluido en el precio (`venta/cotizar.ts`).
with regla as (
  select coalesce((c.valores -> 'impuesto' ->> 'puntosBase')::int, 1600)              as tasa,
         coalesce((c.valores -> 'impuesto' ->> 'incluidoEnPrecio')::boolean, true)     as incluido
    from (select 1) x left join configuracion c on c.organizacion_id = :'org')
select o.id, o.serie || '-' || o.folio as folio, o.subtotal_centavos, o.descuento_centavos,
       o.impuestos_centavos, o.total_centavos, o.costo_total_centavos, o.utilidad_centavos, o.margen_bp,
       r.tasa, r.incluido
  from ordenes o cross join regla r
 where o.organizacion_id = :'org' and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada')
   and ( o.total_centavos <> case when r.incluido then o.subtotal_centavos - o.descuento_centavos
                                  else o.subtotal_centavos - o.descuento_centavos + o.impuestos_centavos end
      or o.impuestos_centavos <> case when r.incluido
                                      then (o.total_centavos * r.tasa * 2 + (10000 + r.tasa)) / ((10000 + r.tasa) * 2)
                                      else ((o.subtotal_centavos - o.descuento_centavos) * r.tasa * 2 + 10000) / 20000 end
      or o.utilidad_centavos <> o.total_centavos - o.costo_total_centavos
      or o.margen_bp <> case when o.total_centavos = 0 then 0
                             else (o.utilidad_centavos * 10000 / o.total_centavos) end );

\echo '== C03 VIOLACIÓN · el encabezado no es la suma de sus platillos vivos (cuentas cobradas)'
select o.id, o.serie || '-' || o.folio as folio,
       o.subtotal_centavos, l.subtotal as suma_lineas, o.descuento_centavos, l.descuento as desc_lineas,
       o.costo_total_centavos, l.costo as costo_lineas
  from ordenes o
  join lateral (
         select coalesce(sum(x.subtotal_centavos), 0) as subtotal,
                coalesce(sum(x.descuento_centavos), 0) as descuento,
                coalesce(sum(round(x.cantidad * x.costo_unitario_centavos)), 0)::bigint as costo
           from orden_lineas x
          where x.orden_id = o.id and x.organizacion_id = o.organizacion_id and x.anulada_en is null) l on true
 where o.organizacion_id = :'org' and o.estado = 'pagada'
   and (o.subtotal_centavos <> l.subtotal
     or o.descuento_centavos <> least(l.descuento, l.subtotal)
     or abs(o.costo_total_centavos - l.costo) > 1);

\echo '== C04 VIOLACIÓN · cada platillo: total = subtotal − descuento; utilidad = total − costo'
select l.id, o.serie || '-' || o.folio as folio, l.producto_nombre, l.cantidad, l.precio_unitario_centavos,
       l.subtotal_centavos, l.descuento_centavos, l.total_centavos, l.costo_unitario_centavos, l.utilidad_centavos
  from orden_lineas l join ordenes o on o.id = l.orden_id and o.organizacion_id = l.organizacion_id
 where l.organizacion_id = :'org' and o.estado = 'pagada' and l.anulada_en is null
   and ( l.total_centavos <> l.subtotal_centavos - l.descuento_centavos
      or abs(l.subtotal_centavos - round(l.cantidad * l.precio_unitario_centavos)) > 1 );

\echo '== C05 VIOLACIÓN · folio de ticket repetido, cobrada sin folio, o hueco en la numeración (por serie)'
select 'repetido' as caso, o.serie, o.folio::text as folio, count(*)::text as n
  from ordenes o where o.organizacion_id = :'org' and o.folio is not null
 group by o.sucursal_id, o.serie, o.folio having count(*) > 1
union all
select 'sin_folio', o.serie, o.id::text, o.estado
  from ordenes o where o.organizacion_id = :'org' and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada') and o.folio is null
union all
select 'hueco', serie, 'faltan ' || (maximo - minimo + 1 - cuantos)::text, 'de ' || minimo::text || ' a ' || maximo::text
  from (select o.sucursal_id, o.serie, min(o.folio) as minimo, max(o.folio) as maximo, count(distinct o.folio) as cuantos
          from ordenes o where o.organizacion_id = :'org' and o.folio is not null group by 1, 2) f
 where maximo - minimo + 1 <> cuantos;

\echo '== C06 CUADRE · contador de folios (folios.siguiente − 1) contra el último folio emitido'
select f.serie, f.siguiente - 1 as contador,
       (select max(o.folio) from ordenes o where o.organizacion_id = f.organizacion_id and o.sucursal_id = f.sucursal_id and o.serie = f.serie) as max_ticket,
       (select max(s.folio) from sesiones_caja s where s.organizacion_id = f.organizacion_id and s.sucursal_id = f.sucursal_id and s.serie = f.serie) as max_corte
  from folios f where f.organizacion_id = :'org';

\echo '== C07 VIOLACIÓN · cobrada sin caja, o con una caja de otra sucursal / ya cerrada antes de cobrarse'
select o.id, o.serie || '-' || o.folio as folio, o.sesion_caja_id, s.sucursal_id as suc_caja, o.sucursal_id as suc_orden,
       o.cobrada_en, o.cerrada_en, s.abierta_en, s.cerrada_en as caja_cerro
  from ordenes o left join sesiones_caja s on s.id = o.sesion_caja_id
 where o.organizacion_id = :'org' and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada')
   and ( o.sesion_caja_id is null or s.sucursal_id <> o.sucursal_id
      or o.cerrada_en < s.abierta_en
      or (s.cerrada_en is not null and o.cerrada_en > s.cerrada_en) );

\echo '== C08 VIOLACIÓN · pagos: sin orden, de otra caja que la de su orden, con cambio/recibido que no cuadra, cobrados tras el cierre'
select p.id, o.serie || '-' || o.folio as folio, p.metodo, p.monto_centavos, p.propina_centavos, p.recibido_centavos,
       p.cambio_centavos, p.sesion_caja_id, o.sesion_caja_id as caja_orden, 'detalle' as nota
  from pagos p left join ordenes o on o.id = p.orden_id and o.organizacion_id = p.organizacion_id
 where p.organizacion_id = :'org'
   and ( o.id is null
      or p.sesion_caja_id is distinct from o.sesion_caja_id
      or (p.metodo = 'efectivo' and p.recibido_centavos is not null
          and p.recibido_centavos - p.cambio_centavos <> p.monto_centavos + p.propina_centavos)
      or exists (select 1 from sesiones_caja s where s.id = p.sesion_caja_id and s.cerrada_en is not null and p.created_at > s.cerrada_en) );

\echo '== C09 VIOLACIÓN · efectivo: movimiento de caja «venta» ≠ pagos en efectivo; «propina» ≠ propina en efectivo (por cuenta)'
select o.id, o.serie || '-' || o.folio as folio,
       coalesce(pg.efectivo, 0) as pagos_efectivo, coalesce(mv.venta, 0) as mov_venta,
       coalesce(pg.propina_efectivo, 0) as propina_efectivo, coalesce(mv.propina, 0) as mov_propina
  from ordenes o
  left join lateral (select sum(p.monto_centavos) filter (where p.metodo = 'efectivo' and p.estado = 'confirmado') as efectivo,
                            sum(p.propina_centavos) filter (where p.metodo = 'efectivo' and p.estado = 'confirmado') as propina_efectivo
                       from pagos p where p.orden_id = o.id and p.organizacion_id = o.organizacion_id) pg on true
  left join lateral (select sum(m.monto_centavos) filter (where m.tipo = 'venta') as venta,
                            sum(m.monto_centavos) filter (where m.tipo = 'propina') as propina
                       from movimientos_caja m where m.referencia_tipo = 'orden' and m.referencia_id = o.id and m.organizacion_id = o.organizacion_id) mv on true
 where o.organizacion_id = :'org' and o.estado = 'pagada'
   and ( coalesce(pg.efectivo, 0) <> coalesce(mv.venta, 0)
      or coalesce(pg.propina_efectivo, 0) <> coalesce(mv.propina, 0) );

\echo '== C10 VIOLACIÓN · movimientos de caja sin cuenta (referencia a orden que no existe / de otra org) o de una caja inexistente'
select m.id, m.tipo, m.monto_centavos, m.referencia_tipo, m.referencia_id, m.sesion_caja_id
  from movimientos_caja m
 where m.organizacion_id = :'org'
   and ( (m.referencia_tipo = 'orden' and not exists (select 1 from ordenes o where o.id = m.referencia_id and o.organizacion_id = m.organizacion_id))
      or not exists (select 1 from sesiones_caja s where s.id = m.sesion_caja_id and s.organizacion_id = m.organizacion_id) );

\echo '== C11 VIOLACIÓN · cuenta dividida: la madre no suma sus hijas, o una hija sin madre'
select p.id as madre, p.estado, p.total_centavos as total_madre,
       (select coalesce(sum(h.total_centavos), 0) from ordenes h where h.orden_padre_id = p.id and h.estado <> 'cancelada') as suma_hijas_vivas,
       (select count(*) from ordenes h where h.orden_padre_id = p.id) as hijas,
       (select count(*) from ordenes h where h.orden_padre_id = p.id and h.estado = 'cancelada') as hijas_canceladas
  from ordenes p
 where p.organizacion_id = :'org' and p.estado = 'dividida'
   and ( not exists (select 1 from ordenes h where h.orden_padre_id = p.id)
      -- sin hijas canceladas, las partes tienen que sumar la madre al centavo
      or ( not exists (select 1 from ordenes h where h.orden_padre_id = p.id and h.estado = 'cancelada')
           and p.total_centavos <> (select sum(h.total_centavos) from ordenes h where h.orden_padre_id = p.id) ) );
-- hijas sin madre dividida (las hijas NACEN sin mesa a propósito: su mesa es la de la madre, `mesas-escrituras.ts`)
select h.id as hija, h.orden_padre_id, p.estado as estado_madre, h.mesa_id, p.mesa_id as mesa_madre
  from ordenes h left join ordenes p on p.id = h.orden_padre_id
 where h.organizacion_id = :'org' and h.orden_padre_id is not null
   and ( p.id is null or p.estado <> 'dividida' or h.mesa_id is not null );

\echo '== C12 VIOLACIÓN · cuenta cancelada: con pagos, sin quién/motivo, o todavía con mesa que la apunta'
select o.id, o.serie || '-' || coalesce(o.folio::text, '∅') as folio, o.estado, o.cancelada_por, o.motivo_cancelacion, o.cancelada_en,
       (select count(*) from pagos p where p.orden_id = o.id) as pagos,
       (select count(*) from mesas m where m.orden_activa_id = o.id) as mesas_que_la_apuntan
  from ordenes o
 where o.organizacion_id = :'org' and o.estado = 'cancelada'
   and ( o.cancelada_por is null or length(btrim(coalesce(o.motivo_cancelacion, ''))) < 3
      or exists (select 1 from pagos p where p.orden_id = o.id)
      or exists (select 1 from mesas m where m.orden_activa_id = o.id) );

-- ############################################################################
-- 2 · CAJAS Y CORTES
-- ############################################################################
\echo '== K01 CUADRE · efectivo de cada caja: Σ movimientos_caja contra lo que guardó el cierre'
select s.serie || '-' || coalesce(s.folio::text, '∅') as corte, s.estado, s.abierta_en, s.cerrada_en,
       s.fondo_inicial_centavos as fondo,
       coalesce(m.suma, 0) as suma_movimientos,
       s.efectivo_esperado_centavos as esperado_guardado,
       s.efectivo_contado_centavos as contado,
       s.diferencia_centavos as diferencia_guardada,
       s.efectivo_contado_centavos - coalesce(m.suma, 0) as diferencia_recalculada,
       case when s.estado = 'cerrada'
             and ( s.efectivo_esperado_centavos is distinct from coalesce(m.suma, 0)
                or s.diferencia_centavos is distinct from s.efectivo_contado_centavos - s.efectivo_esperado_centavos )
            then 'DESCUADRA' else 'ok' end as veredicto
  from sesiones_caja s
  left join lateral (select sum(x.monto_centavos) as suma from movimientos_caja x
                      where x.sesion_caja_id = s.id and x.organizacion_id = s.organizacion_id) m on true
 where s.organizacion_id = :'org' order by s.abierta_en;

\echo '== K02 CUADRE · el esperado desglosado por tipo de movimiento (qué lo forma)'
select s.serie || '-' || coalesce(s.folio::text, '∅') as corte, m.tipo, count(*) as n, sum(m.monto_centavos) as monto
  from sesiones_caja s join movimientos_caja m on m.sesion_caja_id = s.id
 where s.organizacion_id = :'org' group by s.id, m.tipo order by s.abierta_en, m.tipo;

\echo '== K03 VIOLACIÓN · más cajas abiertas a la vez que las que permite la sucursal, o apertura sin movimiento de fondo'
select su.nombre, su.cajas_simultaneas, count(*) as abiertas
  from sesiones_caja s join sucursales su on su.id = s.sucursal_id
 where s.organizacion_id = :'org' and s.estado = 'abierta' group by su.id having count(*) > su.cajas_simultaneas;
select s.id, s.fondo_inicial_centavos, (select coalesce(sum(m.monto_centavos), 0) from movimientos_caja m where m.sesion_caja_id = s.id and m.tipo = 'apertura') as mov_apertura
  from sesiones_caja s
 where s.organizacion_id = :'org'
   and s.fondo_inicial_centavos <> (select coalesce(sum(m.monto_centavos), 0) from movimientos_caja m where m.sesion_caja_id = s.id and m.tipo = 'apertura');

\echo '== K04 VIOLACIÓN · caja cerrada con folio de corte repetido o con hueco; caja cerrada con cuentas vivas atadas'
select s.serie, s.folio::text, count(*)::text as n from sesiones_caja s
 where s.organizacion_id = :'org' and s.folio is not null group by s.sucursal_id, s.serie, s.folio having count(*) > 1;
select s.id, s.serie || '-' || s.folio as corte, o.id as orden, o.estado, o.mesa_id
  from sesiones_caja s join ordenes o on o.sesion_caja_id = s.id and o.organizacion_id = s.organizacion_id
 where s.organizacion_id = :'org' and s.estado = 'cerrada'
   and o.estado in ('borrador', 'confirmada', 'en_preparacion', 'lista', 'cuenta_solicitada', 'parcialmente_pagada');

\echo '== K05 CUADRE · RESUMEN DE VENTAS DE CADA CAJA (lo que dice el corte: tickets, venta, descuento, IVA, costo)'
select s.serie || '-' || coalesce(s.folio::text, '∅') as corte, s.estado,
       count(o.*) as tickets, coalesce(sum(o.total_centavos), 0) as venta,
       coalesce(sum(o.descuento_centavos), 0) as descuento, coalesce(sum(o.impuestos_centavos), 0) as iva,
       coalesce(sum(o.costo_total_centavos), 0) as costo, coalesce(sum(o.utilidad_centavos), 0) as utilidad
  from sesiones_caja s
  left join ordenes o on o.sesion_caja_id = s.id and o.organizacion_id = s.organizacion_id
        and (o.estado in ('pagada', 'parcialmente_reembolsada')
             or (o.estado = 'reembolsada' and exists (select 1 from devoluciones dv where dv.orden_id = o.id)))
 where s.organizacion_id = :'org' group by s.id order by s.abierta_en;

\echo '== K06 CUADRE · VENTAS POR MÉTODO de cada caja (pagos confirmados) y PROPINA por método'
select s.serie || '-' || coalesce(s.folio::text, '∅') as corte, p.metodo, count(*) as pagos,
       sum(p.monto_centavos) as ventas, sum(p.propina_centavos) as propinas
  from sesiones_caja s join pagos p on p.sesion_caja_id = s.id
 where s.organizacion_id = :'org' and p.estado = 'confirmado' group by s.id, p.metodo order by s.abierta_en, p.metodo;

\echo '== K07 VIOLACIÓN · Σ por método ≠ venta del corte (sin reembolsos)'
select s.id, s.serie || '-' || coalesce(s.folio::text, '∅') as corte,
       (select coalesce(sum(p.monto_centavos), 0) from pagos p where p.sesion_caja_id = s.id and p.estado = 'confirmado') as pagos_confirmados,
       (select coalesce(sum(o.total_centavos), 0) from ordenes o where o.sesion_caja_id = s.id and o.estado in ('pagada', 'parcialmente_reembolsada')) as venta_tickets
  from sesiones_caja s
 where s.organizacion_id = :'org'
   and (select coalesce(sum(p.monto_centavos), 0) from pagos p where p.sesion_caja_id = s.id and p.estado = 'confirmado')
    <> (select coalesce(sum(o.total_centavos), 0) from ordenes o where o.sesion_caja_id = s.id and o.estado in ('pagada', 'parcialmente_reembolsada'));

-- ############################################################################
-- 3 · PROPINAS
-- ############################################################################
\echo '== P01 CUADRE · propina por mesero de cada caja (lo que dice «propinas por mesero» del corte)'
select s.serie || '-' || coalesce(s.folio::text, '∅') as corte, coalesce(ev.nombre, '∅') as mesero,
       sum(p.propina_centavos) as propina, count(distinct o.id) as cuentas
  from sesiones_caja s join pagos p on p.sesion_caja_id = s.id
  join ordenes o on o.id = p.orden_id
  left join empleados_visibles ev on ev.id = o.empleado_atiende_id
 where s.organizacion_id = :'org' and p.estado = 'confirmado' and p.propina_centavos > 0
 group by s.id, ev.nombre order by s.abierta_en, 3 desc;

\echo '== P02 VIOLACIÓN · propina sin cuenta pagada, propina de una orden cancelada, o liquidación que no suma lo que dice'
select p.id, p.orden_id, o.estado, p.propina_centavos from pagos p join ordenes o on o.id = p.orden_id
 where p.organizacion_id = :'org' and p.propina_centavos > 0 and o.estado not in ('pagada', 'parcialmente_reembolsada', 'reembolsada');
select l.id, l.serie || '-' || l.folio as liq, l.total_centavos,
       (select coalesce(sum(b.monto_centavos), 0) from liquidacion_propina_beneficiarios b where b.liquidacion_id = l.id) as suma_beneficiarios
  from liquidaciones_propina l
 where l.organizacion_id = :'org'
   and l.total_centavos <> (select coalesce(sum(b.monto_centavos), 0) from liquidacion_propina_beneficiarios b where b.liquidacion_id = l.id);

\echo '== P03 VIOLACIÓN · propina cobrada que el panel de «propinas pendientes» ya no ve (venta devuelta en parte o entera)'
-- `propinas/repositorio.ts` exige `o.estado = 'pagada'`; la devolución no devuelve la propina («no es venta»).
select o.id, o.serie || '-' || o.folio as folio, o.estado, sum(p.propina_centavos) as propina_sin_liquidar
  from ordenes o join pagos p on p.orden_id = o.id and p.estado in ('confirmado', 'reembolsado')
 where o.organizacion_id = :'org' and o.estado in ('parcialmente_reembolsada', 'reembolsada') and o.propina_liquidacion_id is null
 group by o.id having sum(p.propina_centavos) > 0;

-- ############################################################################
-- 4 · CANCELACIONES, ANULACIONES Y PÉRDIDAS
-- ############################################################################
\echo '== X01 CUADRE · cuentas canceladas y platillos anulados del día'
select 'cuenta' as tipo, o.serie || '-' || coalesce(o.folio::text, '∅') as folio, o.id::text as id, o.cancelada_en as cuando,
       o.total_centavos as monto, ev.nombre as quien, o.motivo_cancelacion as motivo, o.sesion_caja_id
  from ordenes o left join empleados_visibles ev on ev.id = o.cancelada_por
 where o.organizacion_id = :'org' and o.estado = 'cancelada'
union all
select 'platillo', o.serie || '-' || coalesce(o.folio::text, '∅'), l.id::text, l.anulada_en, l.total_centavos, ev.nombre,
       l.motivo_anulacion || ' · ' || l.producto_nombre, o.sesion_caja_id
  from orden_lineas l join ordenes o on o.id = l.orden_id
  left join empleados_visibles ev on ev.id = l.empleado_anula_id
 where l.organizacion_id = :'org' and l.anulada_en is not null
 order by 4;

\echo '== X02 VIOLACIÓN · comanda viva, platillo vivo o solicitud pendiente de una cuenta cancelada o cobrada'
select 'comanda_viva' as caso, c.id::text as id, c.estado, o.estado as orden_estado, o.id::text as orden
  from comandas c join ordenes o on o.id = c.orden_id
 -- (una cuenta de mesa cobrada ANTES de que cocina termine deja su comanda viva: legítimo; sólo la cancelada no)
 where c.organizacion_id = :'org' and o.estado = 'cancelada' and c.estado in ('nuevo', 'en_preparacion')
union all
select 'item_vivo', ci.id::text, ci.estado, o.estado, o.id::text
  from comanda_items ci join comandas c on c.id = ci.comanda_id join ordenes o on o.id = c.orden_id
 -- un platillo `entregado` de una cuenta que luego se canceló SE QUEDA entregado a propósito: es la evidencia de la pérdida
 where ci.organizacion_id = :'org' and o.estado = 'cancelada' and ci.estado in ('pendiente', 'en_preparacion', 'listo')
union all
select 'linea_no_cancelada', l.id::text, l.estado_preparacion, o.estado, o.id::text
  from orden_lineas l join ordenes o on o.id = l.orden_id
 -- un platillo ANULADO antes de cancelar la cuenta conserva el estado de cocina que tenía (es la evidencia de su pérdida)
 where l.organizacion_id = :'org' and o.estado = 'cancelada' and l.estado_preparacion <> 'cancelado' and l.anulada_en is null
union all
select 'solicitud_viva', s.id::text, s.estado, o.estado, o.id::text
  from solicitudes_qr s join ordenes o on o.id = s.orden_id
 where s.organizacion_id = :'org' and s.estado in ('pendiente', 'atendida') and o.estado in ('cancelada', 'pagada');

\echo '== X03 CUADRE · PÉRDIDA por cuenta cancelada: lo hecho (listo/entregado) a precio de cuenta, platillo por platillo'
-- ojo: `least(1, NULL)` es 1 en Postgres (ignora los nulos); por eso es `join lateral … on cant is not null`
-- (las líneas sin nada hecho NO entran) y no un left join.
select o.serie || '-' || coalesce(o.folio::text, '∅') as folio, o.id as orden, o.total_centavos as cancelado,
       coalesce((select sum(round(l.total_centavos * least(1, h.cant / nullif(l.cantidad, 0))))
                   from orden_lineas l
                   join lateral (select sum(ci.cantidad) as cant
                                   from comanda_items ci join comandas c on c.id = ci.comanda_id
                                  where ci.orden_linea_id = l.id
                                    and (ci.listo_en is not null or ci.estado = 'entregado'
                                         or c.lista_en is not null or c.entregada_en is not null)) h on h.cant is not null
                  where l.orden_id = o.id and l.anulada_en is null), 0)::bigint as perdida_recalculada
  from ordenes o
 where o.organizacion_id = :'org' and o.estado = 'cancelada'
 order by o.cancelada_en;

\echo '== X04 VIOLACIÓN · platillo anulado: sin quién/motivo, con comanda viva, o aún sumado en una cuenta ya cobrada'
select l.id, o.serie || '-' || coalesce(o.folio::text, '∅') as folio, l.producto_nombre, l.anulada_en, l.motivo_anulacion, l.empleado_anula_id,
       o.estado, (select count(*) from comanda_items ci where ci.orden_linea_id = l.id and ci.estado not in ('cancelado')) as items_vivos
  from orden_lineas l join ordenes o on o.id = l.orden_id
 where l.organizacion_id = :'org' and l.anulada_en is not null
   and ( l.empleado_anula_id is null or l.motivo_anulacion is null
      or exists (select 1 from comanda_items ci where ci.orden_linea_id = l.id and ci.estado in ('pendiente', 'en_preparacion')) );

-- ############################################################################
-- 5 · MESAS, UNIONES, CARRITOS, AVISOS, COMANDAS
-- ############################################################################
\echo '== M01 VIOLACIÓN · estado de la mesa incoherente con su cuenta'
-- Reglas del código: cobrar deja la mesa en `limpieza` CON `orden_activa_id` (a propósito, `mesas-escrituras.ts`);
-- cancelar/liberar la deja `libre` y sin cuenta; una cuenta dividida es la `orden_activa_id` de la mesa mientras
-- alguna de sus partes siga viva (las hijas nacen sin mesa); la absorbida de una unión no tiene cuenta propia.
select m.numero, m.estado, m.orden_activa_id, o.estado as orden_estado, m.unida_a_mesa_id,
       case
         when m.orden_activa_id is null or o.estado in ('pagada', 'cancelada', 'absorbida') then 'ocupada_sin_cuenta_viva'
         when o.estado = 'dividida' then 'ocupada_por_dividida_ya_saldada'
         when m.estado in ('libre', 'limpieza') then 'libre_o_limpieza_con_cuenta_viva'
         else 'cuenta_solicitada_con_cuenta_que_no_lo_es'
       end as caso
  from mesas m left join ordenes o on o.id = m.orden_activa_id
 where m.organizacion_id = :'org' and m.activa
   and ( ( m.estado in ('esperando_orden', 'pedido_enviado', 'en_preparacion', 'en_espera_entrega', 'ocupada', 'cuenta_solicitada')
           and m.unida_a_mesa_id is null
           and ( m.orden_activa_id is null or o.estado in ('pagada', 'cancelada', 'absorbida')
              or ( o.estado = 'dividida'
                   and not exists (select 1 from ordenes h where h.orden_padre_id = o.id
                                    and h.estado in ('borrador', 'confirmada', 'en_preparacion', 'lista', 'cuenta_solicitada', 'parcialmente_pagada')) ) ) )
      or ( m.estado in ('libre', 'limpieza') and o.id is not null
           and o.estado in ('borrador', 'confirmada', 'en_preparacion', 'lista', 'cuenta_solicitada', 'parcialmente_pagada') )
      or ( m.estado = 'cuenta_solicitada' and o.id is not null and o.estado not in ('cuenta_solicitada', 'parcialmente_pagada', 'dividida') ) );

\echo '== M02 VIOLACIÓN · cuenta viva con mesa que no la tiene (la mesa libre o apuntando a otra cuenta)'
select o.id, o.serie, o.estado, m.numero, m.estado as mesa_estado, m.orden_activa_id
  from ordenes o join mesas m on m.id = o.mesa_id
 where o.organizacion_id = :'org' and o.estado in ('borrador', 'confirmada', 'en_preparacion', 'lista', 'cuenta_solicitada', 'parcialmente_pagada')
   and m.orden_activa_id is distinct from o.id
   and not exists (select 1 from ordenes h where h.orden_padre_id = o.orden_padre_id and o.orden_padre_id is not null and h.id = m.orden_activa_id);

\echo '== M03 VIOLACIÓN · UNIÓN VARADA: viva sin mesas, mesa absorbida de unión cerrada o inexistente, principal que no es la que dice'
select 'union_viva_sin_miembros' as caso, u.id::text, u.mesa_principal_id::text, null::text
  from uniones_mesa u
 where u.organizacion_id = :'org' and u.cerrada_en is null
   and not exists (select 1 from union_mesa_miembros x where x.union_id = u.id)
union all
select 'absorbida_sin_union_viva', m.id::text, m.numero::text, m.unida_a_mesa_id::text
  from mesas m
 where m.organizacion_id = :'org' and m.unida_a_mesa_id is not null
   and not exists (select 1 from uniones_mesa u join union_mesa_miembros x on x.union_id = u.id
                    where u.organizacion_id = m.organizacion_id and u.cerrada_en is null
                      and u.mesa_principal_id = m.unida_a_mesa_id and x.mesa_id = m.id)
union all
select 'miembro_abierto_de_union_cerrada', x.union_id::text, x.mesa_id::text, null
  from union_mesa_miembros x join uniones_mesa u on u.id = x.union_id
 where u.organizacion_id = :'org' and u.cerrada_en is not null and x.union_abierta
union all
select 'miembro_vivo_sin_marca_en_mesa', x.union_id::text, x.mesa_id::text, null
  from union_mesa_miembros x join uniones_mesa u on u.id = x.union_id join mesas m on m.id = x.mesa_id
 where u.organizacion_id = :'org' and u.cerrada_en is null and m.unida_a_mesa_id is distinct from u.mesa_principal_id
union all
select 'dos_uniones_vivas_misma_principal', u.mesa_principal_id::text, count(*)::text, null
  from uniones_mesa u where u.organizacion_id = :'org' and u.cerrada_en is null group by u.mesa_principal_id having count(*) > 1
union all
select 'absorbida_con_orden_viva', m.id::text, o.id::text, o.estado
  from mesas m join ordenes o on o.id = m.orden_activa_id
 where m.organizacion_id = :'org' and m.unida_a_mesa_id is not null and o.estado not in ('absorbida');

\echo '== M04 VIOLACIÓN · cuenta de unión: orden `absorbida` sin unión, o unión cuya cuenta no la apunta'
select o.id, o.estado, o.union_id, o.mesa_id from ordenes o
 where o.organizacion_id = :'org' and o.estado = 'absorbida'
   and not exists (select 1 from union_mesa_miembros x where x.orden_absorbida_id = o.id);
select u.id, u.mesa_principal_id, u.orden_id, o.union_id as union_de_la_orden, o.estado
  from uniones_mesa u join ordenes o on o.id = u.orden_id
 where u.organizacion_id = :'org' and u.cerrada_en is null and o.union_id is distinct from u.id;

\echo '== M05 VIOLACIÓN · CARRITO COLGADO: mesa libre con líneas sin actividad hace más de 3 h; líneas de mesa inexistente/inactiva'
select m.numero, m.estado, count(l.*) as lineas, max(l.created_at) as ultima_actividad, now() - max(l.created_at) as antiguedad
  from carrito_mesa_lineas l join mesas m on m.id = l.mesa_id
 where l.organizacion_id = :'org' and m.orden_activa_id is null
 group by m.id having max(l.created_at) < now() - interval '3 hours';
select l.id, l.mesa_id from carrito_mesa_lineas l left join mesas m on m.id = l.mesa_id
 where l.organizacion_id = :'org' and (m.id is null or not m.activa);

\echo '== M06 VIOLACIÓN · AVISO COLGADO: «Pedido listo para confirmar» vivo sin carrito; solicitud pendiente de cuenta ya cerrada; dos pendientes del mismo tipo en una mesa'
select s.id, m.numero, s.tipo, s.estado, s.notas, s.created_at,
       (select count(*) from carrito_mesa_lineas l where l.mesa_id = s.mesa_id) as lineas_en_carrito
  from solicitudes_qr s join mesas m on m.id = s.mesa_id
 where s.organizacion_id = :'org' and s.tipo = 'ordenar' and s.estado in ('pendiente', 'atendida')
   and s.notas ilike 'Pedido listo para confirmar%'
   and not exists (select 1 from carrito_mesa_lineas l where l.mesa_id = s.mesa_id);
select s.mesa_id, s.tipo, count(*) as pendientes from solicitudes_qr s
 where s.organizacion_id = :'org' and s.estado = 'pendiente' group by 1, 2 having count(*) > 1;
-- los avisos son del grupo sentado: al volver la mesa al servicio quedan `resuelta` (`avisos-de-la-mesa.ts`).
-- Una de `cuenta` viva en una mesa sin cuenta es un aviso de un grupo que ya se fue; `ordenar` y `ayuda` pueden
-- vivir en una mesa libre (el comensal llama al mesero antes de abrir), por eso sólo se reportan si son viejas.
select s.id, m.numero, s.tipo, s.estado, o.estado as orden_estado, s.created_at from solicitudes_qr s
  join mesas m on m.id = s.mesa_id left join ordenes o on o.id = s.orden_id
 where s.organizacion_id = :'org' and s.estado in ('pendiente', 'atendida') and m.estado = 'libre' and m.orden_activa_id is null
   and ( s.tipo = 'cuenta' or s.created_at < now() - interval '3 hours' );

\echo '== M07 VIOLACIÓN · comandas: estado vs sellos de tiempo, items vs comanda, items huérfanos, comandas de mesa distinta a la de su cuenta'
select c.id, c.estado, c.iniciada_en, c.lista_en, c.entregada_en, 'sellos' as nota from comandas c
 where c.organizacion_id = :'org'
   and ( (c.estado = 'entregado' and c.entregada_en is null) or (c.estado = 'listo' and c.lista_en is null)
      or (c.estado = 'cancelado' and exists (select 1 from comanda_items ci where ci.comanda_id = c.id and ci.estado in ('pendiente', 'en_preparacion', 'listo'))) );
select ci.id, ci.estado as item, c.estado as comanda, 'item_adelante_de_su_comanda' as nota
  from comanda_items ci join comandas c on c.id = ci.comanda_id
 where ci.organizacion_id = :'org' and c.estado = 'nuevo' and ci.estado in ('listo', 'entregado');
-- Al unir mesas la cuenta de la absorbida pasa a la principal y SUS comandas se quedan con la mesa donde se pidió
-- (observado el 3-nov: comanda de la mesa 4 en la cuenta de la 3): eso no es defecto. Se excluyen las mesas que son o
-- fueron miembros de una unión; lo que quede es una comanda de una mesa que nunca estuvo unida a la de su cuenta.
select c.id, c.mesa_id, o.mesa_id as mesa_de_la_cuenta, c.orden_id from comandas c join ordenes o on o.id = c.orden_id
 where c.organizacion_id = :'org' and c.mesa_id is distinct from o.mesa_id and o.canal = 'aqui' and o.mesa_id is not null
   and not exists (select 1 from union_mesa_miembros x where x.mesa_id = c.mesa_id)
   and not exists (select 1 from uniones_mesa u where u.mesa_principal_id = o.mesa_id and u.organizacion_id = c.organizacion_id);

\echo '== M08 CUADRE · cada mesa: estado, cuenta y qué dice la cuenta'
select m.numero, m.estado, m.unida_a_mesa_id is not null as absorbida, o.serie || '-' || coalesce(o.folio::text, '∅') as cuenta, o.estado as cuenta_estado,
       (select count(*) from carrito_mesa_lineas l where l.mesa_id = m.id) as carrito, m.personas_actuales
  from mesas m left join ordenes o on o.id = m.orden_activa_id
 where m.organizacion_id = :'org' and m.activa order by m.numero;

\echo '== M09 CUADRE (informativa) · el libro de transiciones de la mesa (eventos_mesa): su último estado ≠ el de la mesa'
select m.numero, m.estado as estado_mesa, u.estado_nuevo as ultimo_en_el_libro, u.ocurrido_en, m.updated_at
  from mesas m
  join lateral (select e.estado_nuevo, e.ocurrido_en from eventos_mesa e where e.mesa_id = m.id
                 order by e.ocurrido_en desc, e.id desc limit 1) u on true
 where m.organizacion_id = :'org' and m.activa and m.unida_a_mesa_id is null and u.estado_nuevo <> m.estado
   and u.ocurrido_en > '2026-11-02'::timestamptz;

-- ############################################################################
-- 6 · INVENTARIO
-- ############################################################################
\echo '== I01 VIOLACIÓN · existencia ≠ Σ movimientos (el kardex no cuadra con el saldo)'
select i.nombre, e.almacen_id, e.cantidad as existencia, coalesce(k.suma, 0) as suma_movimientos
  from existencias e join insumos i on i.id = e.insumo_id
  left join lateral (select sum(m.cantidad) as suma from movimientos_stock m
                      where m.insumo_id = e.insumo_id and m.almacen_id = e.almacen_id and m.organizacion_id = e.organizacion_id) k on true
 where e.organizacion_id = :'org' and e.cantidad <> coalesce(k.suma, 0);

\echo '== I02 CUADRE · lo vendido y la merma, por insumo (venta, merma «Por cancelación», otras mermas, ajustes) contra la existencia'
select i.nombre, i.unidad_base,
       coalesce(sum(m.cantidad) filter (where m.tipo = 'salida_venta'), 0) as venta,
       coalesce(sum(m.cantidad) filter (where m.tipo = 'merma' and m.referencia_tipo in ('orden', 'anulacion')), 0) as merma_por_cancelacion,
       coalesce(sum(m.cantidad) filter (where m.tipo = 'merma' and m.referencia_tipo not in ('orden', 'anulacion')), 0) as otras_mermas,
       coalesce(sum(m.cantidad) filter (where m.tipo not in ('salida_venta', 'merma')), 0) as entradas_y_otros,
       coalesce((select sum(e.cantidad) from existencias e where e.insumo_id = i.id), 0) as existencia
  from insumos i left join movimientos_stock m on m.insumo_id = i.id
 where i.organizacion_id = :'org' group by i.id order by i.nombre;

\echo '== I03 VIOLACIÓN · venta: lo descontado ≠ cantidad vendida × receta (cuentas cobradas con receta activa)'
-- cantidad esperada = Σ platillos vivos × receta.cantidad × (1 + merma_bp/10000); tolerancia 0.001
with esperado as (
  select o.id as orden_id, r.insumo_id, sum(l.cantidad * r.cantidad * (1 + r.merma_bp / 10000.0)) as cant
    from ordenes o join orden_lineas l on l.orden_id = o.id and l.anulada_en is null
    join recetas r on r.producto_id = l.producto_id and r.activa
         and (r.aplica_canal is null or r.aplica_canal = '{}' or o.canal = any (r.aplica_canal))
   where o.organizacion_id = :'org' and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada') group by 1, 2),
real as (
  select m.referencia_id as orden_id, m.insumo_id, -sum(m.cantidad) as cant
    from movimientos_stock m where m.organizacion_id = :'org' and m.tipo = 'salida_venta' and m.referencia_tipo = 'orden' group by 1, 2)
select coalesce(e.orden_id, r.orden_id) as orden, i.nombre, e.cant as esperado, r.cant as descontado
  from esperado e full join real r on r.orden_id = e.orden_id and r.insumo_id = e.insumo_id
  left join insumos i on i.id = coalesce(e.insumo_id, r.insumo_id)
 where abs(coalesce(e.cant, 0) - coalesce(r.cant, 0)) > 0.001
 order by 1;

\echo '== I04 VIOLACIÓN · merma «Por cancelación» sin cancelación/anulación detrás, o doble (misma referencia e insumo repetidos)'
select m.id, m.referencia_tipo, m.referencia_id, m.cantidad, m.nota
  from movimientos_stock m
 where m.organizacion_id = :'org' and m.tipo = 'merma' and m.referencia_tipo in ('orden', 'anulacion')
   and ( (m.referencia_tipo = 'orden' and not exists (select 1 from ordenes o where o.id = m.referencia_id and o.estado = 'cancelada'))
      -- anulación PARCIAL: la línea original sigue viva con lo restante y la porción anulada es una hermana
      -- nueva (`ordenes/anulacion.ts`); la merma apunta a la ORIGINAL, así que basta una hermana anulada
      -- del mismo producto en la misma cuenta.
      or (m.referencia_tipo = 'anulacion' and not exists (
            select 1 from orden_lineas l
             where l.id = m.referencia_id
               and ( l.anulada_en is not null
                  or exists (select 1 from orden_lineas h where h.orden_id = l.orden_id and h.anulada_en is not null
                                and h.producto_id is not distinct from l.producto_id))))
      or m.nota not like 'Por cancelación%' );
select m.referencia_tipo, m.referencia_id, m.insumo_id, count(*) as veces from movimientos_stock m
 where m.organizacion_id = :'org' and m.tipo = 'merma' and m.referencia_tipo in ('orden', 'anulacion')
 group by 1, 2, 3 having count(*) > 1;

\echo '== I05 CUADRE · cancelaciones con platillo ya hecho y con receta: ¿hay su merma? (lo hecho × receta contra la merma registrada)'
with hecho as (
  select o.id as orden_id, l.id as linea_id, least(l.cantidad, sum(ci.cantidad)) as cant
    from ordenes o join orden_lineas l on l.orden_id = o.id and l.anulada_en is null
    join comanda_items ci on ci.orden_linea_id = l.id join comandas c on c.id = ci.comanda_id
   where o.organizacion_id = :'org' and o.estado = 'cancelada'
     and (ci.listo_en is not null or ci.estado = 'entregado' or c.lista_en is not null or c.entregada_en is not null)
   group by o.id, l.id, l.cantidad),
esperado as (
  select h.orden_id, r.insumo_id, sum(h.cant * r.cantidad * (1 + r.merma_bp / 10000.0)) as cant
    from hecho h join orden_lineas l on l.id = h.linea_id join recetas r on r.producto_id = l.producto_id and r.activa group by 1, 2),
real as (
  select m.referencia_id as orden_id, m.insumo_id, -sum(m.cantidad) as cant
    from movimientos_stock m where m.organizacion_id = :'org' and m.tipo = 'merma' and m.referencia_tipo = 'orden' group by 1, 2)
select coalesce(e.orden_id, r.orden_id) as orden, i.nombre, e.cant as esperado, r.cant as merma_registrada
  from esperado e full join real r on r.orden_id = e.orden_id and r.insumo_id = e.insumo_id
  left join insumos i on i.id = coalesce(e.insumo_id, r.insumo_id)
 where abs(coalesce(e.cant, 0) - coalesce(r.cant, 0)) > 0.001;

\echo '== I06 VIOLACIÓN · existencia negativa (informativa: tras una cancelación puede ser legítima, DP-D57)'
select i.nombre, e.cantidad from existencias e join insumos i on i.id = e.insumo_id where e.organizacion_id = :'org' and e.cantidad < 0;

-- ############################################################################
-- 7 · AUDITORÍA
-- ############################################################################
\echo '== A01 VIOLACIÓN · comando que escribió sin fila de auditoría, o fila de auditoría de éxito sin comando'
select 'comando_sin_auditoria' as caso, c.comando, c.correlation_id::text, c.created_at
  from comandos_ejecutados c
 where c.organizacion_id = :'org' and c.completado_en is not null
   and not exists (select 1 from auditoria a where a.organizacion_id = c.organizacion_id and a.correlation_id = c.correlation_id and a.accion = c.comando)
union all
select 'auditoria_sin_comando', a.accion, a.correlation_id::text, a.created_at
  from auditoria a
 where a.organizacion_id = :'org' and a.id > :aud0 and a.accion <> 'negocio.alta' and coalesce(a.payload ->> 'resultado', '') = ''
   and not exists (select 1 from comandos_ejecutados c where c.organizacion_id = a.organizacion_id and c.correlation_id = a.correlation_id and c.comando = a.accion)
union all
select 'comando_sin_completar', c.comando, c.correlation_id::text, c.created_at
  from comandos_ejecutados c where c.organizacion_id = :'org' and c.completado_en is null;

\echo '== A02 VIOLACIÓN · hechos del día SIN su fila de auditoría (cobro, cancelación, anulación, caja abierta/cerrada, unión)'
select 'cobro' as hecho, o.id::text as id from ordenes o
 where o.organizacion_id = :'org' and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada')
   and not exists (select 1 from auditoria a where a.organizacion_id = o.organizacion_id and a.accion = 'venta.cobrar' and a.entidad_id = o.id)
union all
select 'cancelacion', o.id::text from ordenes o
 where o.organizacion_id = :'org' and o.estado = 'cancelada'
   and not exists (select 1 from auditoria a where a.organizacion_id = o.organizacion_id and a.accion in ('restaurante.cancelar_orden', 'restaurante.liberar_mesa', 'venta.vaciar_orden') and a.entidad_id = o.id)
union all
select 'anulacion', l.id::text from orden_lineas l
 where l.organizacion_id = :'org' and l.anulada_en is not null
   and not exists (select 1 from auditoria a where a.organizacion_id = l.organizacion_id and a.accion = 'restaurante.anular_linea' and (a.entidad_id = l.id or a.entidad_id = l.orden_id))
union all
select 'caja_abierta', s.id::text from sesiones_caja s
 where s.organizacion_id = :'org'
   and not exists (select 1 from auditoria a where a.organizacion_id = s.organizacion_id and a.accion = 'caja.abrir' and a.entidad_id = s.id)
union all
select 'caja_cerrada', s.id::text from sesiones_caja s
 where s.organizacion_id = :'org' and s.estado = 'cerrada'
   and not exists (select 1 from auditoria a where a.organizacion_id = s.organizacion_id and a.accion = 'caja.cerrar' and a.entidad_id = s.id)
union all
select 'union', u.id::text from uniones_mesa u
 where u.organizacion_id = :'org'
   and not exists (select 1 from auditoria a where a.organizacion_id = u.organizacion_id and a.accion = 'restaurante.unir_mesas' and a.created_at between u.abierta_en - interval '5 seconds' and u.abierta_en + interval '5 seconds')
union all
select 'separacion', u.id::text from uniones_mesa u
 where u.organizacion_id = :'org' and u.cerrada_en is not null and u.cerrada_en > '2026-11-02'::timestamptz
   -- una unión se cierra con «Separar mesas» o al liberar la principal con `grupo: 'separar'` (DP-9.6)
   and not exists (select 1 from auditoria a where a.organizacion_id = u.organizacion_id
                      and a.accion in ('restaurante.separar_mesas', 'restaurante.liberar_mesa')
                      and a.created_at between u.cerrada_en - interval '5 seconds' and u.cerrada_en + interval '5 seconds');

\echo '== A03 CUADRE · auditoría de la jornada por acción y resultado (los rechazos quedan como «denegado/conflicto/error»)'
select a.accion, coalesce(a.payload ->> 'resultado', 'ok') as resultado, coalesce(a.payload ->> 'codigo', '') as codigo, count(*) as n
  from auditoria a where a.organizacion_id = :'org' and a.id > :aud0 group by 1, 2, 3 order by 1, 2, 3;

\echo '== A04 VIOLACIÓN · secretos en la auditoría: PIN, token de mesa, id crudo de teléfono, cookies'
select a.id, a.accion, a.created_at from auditoria a
 where a.organizacion_id = :'org' and a.id > :aud0
   -- el valor redactado por el sistema es la cadena «[redactado]»: eso es lo correcto, cualquier otra cosa es fuga
   and ( a.payload::text ~* '"(pin|pin_hash|token|token_mesa|qr_token|dispositivo|cookie|password|secreto)"\s*:\s*"(?!\[redactado\])[^"]{4,}"' );

\echo '== A05 CUADRE · huella del actor: auditoría sin identidad (comandos públicos) y con identidad'
select (a.identidad_id is null) as sin_identidad, a.accion, count(*) from auditoria a
 where a.organizacion_id = :'org' and a.id > :aud0 group by 1, 2 order by 1, 2;

-- ############################################################################
-- 8 · INTEGRIDAD ENTRE ORGANIZACIONES Y SUCURSALES (fugas)
-- ############################################################################
\echo '== G01 VIOLACIÓN · hijas con organización distinta a la del padre (fuga entre negocios)'
select 'orden_linea' as tabla, l.id from orden_lineas l join ordenes o on o.id = l.orden_id where l.organizacion_id <> o.organizacion_id
union all select 'pago', p.id from pagos p join ordenes o on o.id = p.orden_id where p.organizacion_id <> o.organizacion_id
union all select 'comanda', c.id from comandas c join ordenes o on o.id = c.orden_id where c.organizacion_id <> o.organizacion_id
union all select 'comanda_item', ci.id from comanda_items ci join comandas c on c.id = ci.comanda_id where ci.organizacion_id <> c.organizacion_id
union all select 'mov_caja', m.id from movimientos_caja m join sesiones_caja s on s.id = m.sesion_caja_id where m.organizacion_id <> s.organizacion_id
union all select 'mov_stock', m.id from movimientos_stock m join insumos i on i.id = m.insumo_id where m.organizacion_id <> i.organizacion_id
union all select 'solicitud', s.id from solicitudes_qr s join mesas m on m.id = s.mesa_id where s.organizacion_id <> m.organizacion_id;

\echo '== G02 VIOLACIÓN · sucursal incoherente: cuenta de una sucursal en la mesa/caja de otra'
select o.id, o.sucursal_id as suc_orden, m.sucursal_id as suc_mesa, s.sucursal_id as suc_caja
  from ordenes o left join mesas m on m.id = o.mesa_id left join sesiones_caja s on s.id = o.sesion_caja_id
 where o.organizacion_id = :'org' and ( m.sucursal_id <> o.sucursal_id or s.sucursal_id <> o.sucursal_id );

\echo '== G03 CUADRE · jornadas de caja por persona (quién abrió/cerró)'
select s.serie || '-' || coalesce(s.folio::text, '∅') as corte, ea.nombre as abre, ec.nombre as cierra, s.abierta_en, s.cerrada_en
  from sesiones_caja s left join empleados_visibles ea on ea.id = s.empleado_abre_id left join empleados_visibles ec on ec.id = s.empleado_cierra_id
 where s.organizacion_id = :'org' order by s.abierta_en;

\echo '== L01 CUADRE · cubos de límite de tasa vivos (para no gastar la cuota de QA-1)'
select left(clave, 10) as cubo, ventana_en, intentos from limite_tasa order by ventana_en desc limit 20;

rollback;
