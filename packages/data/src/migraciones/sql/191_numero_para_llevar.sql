-- ─────────────────────────────────────────────────────────────────────────────
-- 191 · EL NÚMERO DEL PEDIDO PARA LLEVAR (DP-16, base propia de Don Poncho).
--
-- La cajera toma un pedido para llevar en la Caja y lo cobra ahí mismo. La cocina y la caja lo
-- llaman «Pedido para llevar N»: un número que empieza en 1 cada día del negocio (CDMX). Lo asigna
-- `venta.cobrar` DENTRO de la transacción del cobro, con un candado por negocio: dos cajas que
-- cobran a la vez no pueden darle el mismo número a dos pedidos. Un cobro que se cancela no toma
-- número (la transacción se revierte con él).
--
-- `dia_del_pedido` es la fecha del día del negocio en que se cobró (`diaDelNegocio`), no la del
-- servidor en UTC: a las 23:30 de CDMX sigue siendo el mismo día. El índice único por negocio y
-- día es la red que respalda al candado.
--
-- Las dos columnas van juntas o ninguna (las órdenes de mesa y las históricas, nulas). Aditiva y
-- sin datos: no cambia ninguna orden existente. RLS y permisos no cambian (son de la tabla;
-- `morphiqpos_app` ya la lee y la escribe).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ordenes') is null then
    raise exception '191: no existe la tabla ordenes';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ordenes'
       and column_name in ('numero_pedido', 'dia_del_pedido')
  ) then
    raise exception '191: ordenes.numero_pedido o dia_del_pedido ya existen; la base no está como se esperaba';
  end if;
end $$;

alter table ordenes
  add column numero_pedido  integer,
  add column dia_del_pedido date;

alter table ordenes
  add constraint ordenes_numero_pedido_positivo check (numero_pedido is null or numero_pedido > 0),
  add constraint ordenes_numero_pedido_con_su_dia check ((numero_pedido is null) = (dia_del_pedido is null));

create unique index ordenes_numero_pedido_del_dia
  on ordenes (organizacion_id, dia_del_pedido, numero_pedido)
  where numero_pedido is not null;

comment on column ordenes.numero_pedido is
  'DP-16 · «Pedido para llevar N»: empieza en 1 cada día del negocio. Lo asigna venta.cobrar con candado. Nula en mesas.';
comment on column ordenes.dia_del_pedido is
  'DP-16 · El día del negocio (zona del negocio) en que se cobró el pedido para llevar. Va con numero_pedido.';

do $$
begin
  if (
    select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'ordenes'
       and ((column_name = 'numero_pedido' and data_type = 'integer' and is_nullable = 'YES')
         or (column_name = 'dia_del_pedido' and data_type = 'date' and is_nullable = 'YES'))
  ) <> 2 then
    raise exception '191: las columnas del número para llevar no quedaron como se esperaba';
  end if;
end $$;
