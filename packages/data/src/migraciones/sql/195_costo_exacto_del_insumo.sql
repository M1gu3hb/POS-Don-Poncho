-- ─────────────────────────────────────────────────────────────────────────────
-- 195 · EL COSTO EXACTO DE UN INSUMO (DP-22, DP-D165, hallazgo 14 de la auditoría; base propia de Don Poncho).
--
-- El costo de un insumo por UNIDAD BASE (el gramo, el mililitro, la pieza) se guardaba en centavos ENTEROS
-- (`insumos.costo_unitario_centavos`, y copiado en cada movimiento del kardex). En un restaurante un centavo por
-- gramo es demasiado grueso: la leche a $480.00 los 20 litros son 2.4 ¢/ml y quedaba en 2 (−16.7 %); el maíz a
-- $540.00 los 12 kilos son 4.5 ¢/g y quedaba en 5 (+11 %). Todo lo que MULTIPLICA cantidad por costo —el valor del
-- inventario, el costo de cada receta, la merma, el consumo, el kardex— heredaba el error.
--
-- ── Lo que añade ───────────────────────────────────────────────────────────────────────────────────────────
-- Una columna hermana, `costo_exacto_dmc`: el costo por unidad base en DIEZMILÉSIMAS DE CENTAVO (dmc), `bigint` ≥ 0.
-- 2.4 ¢/ml = 24 000 dmc; 4.5 ¢/g = 45 000 dmc. Es la misma escala de cuatro decimales que ya usan las cantidades.
--   · `insumos`           el costo VIGENTE (el promedio ponderado).
--   · `movimientos_stock` el costo que tenía el insumo al moverse (lo copian el cobro, la merma, el ajuste…).
--   · `valuacion_lineas`  el costo con el que se valuó cada renglón de una valuación guardada.
-- `costo_unitario_centavos` SE QUEDA, en las tres, y sigue llenándose: es el exacto redondeado al centavo, para que lo
-- que sólo lo muestra o lo copia siga funcionando sin tocarse. Lo impone un `check` (ver abajo).
--
-- ── La regla, que ahora vive también en la base ────────────────────────────────────────────────────────────
-- `costo_unitario_centavos = (costo_exacto_dmc + 5000) / 10000` (medio centavo hacia arriba). Un `check` por tabla lo
-- exige, y un disparador completa la columna que NO se escribió: quien sólo conoce los centavos (una semilla, un
-- `psql`, una prueba, un camino que nadie migró) deja el exacto en centavos × 10 000, que es lo que había; quien sólo
-- conoce el exacto deja los centavos redondeados. Dos columnas que se contradicen no se pueden guardar.
--
-- ── Las cuatro vistas que multiplican, vueltas a definir con las MISMAS columnas ──────────────────────────────────
--   · `existencias_por_insumo`        `valor_centavos` = suma, por almacén, de existencia × exacto, redondeado al centavo.
--                                     Una existencia en NEGATIVO vale cero (DP-D116, DP-D146): es lo que falta por
--                                     contar, no una deuda, y es lo que ya hacen la valuación guardada y la tarjeta.
--   · `kardex`                        `importe_centavos` = cantidad firmada × exacto, redondeado.
--   · `descuentos_inventario_venta`   `costo_total_descontado` = cantidad × exacto, redondeado.
--   · `merma_barra_turno`             `costo_centavos` = suma de cantidad × exacto, redondeada UNA vez.
-- Se redefinen con `create or replace view`: mismas columnas, mismos tipos, mismos permisos y opciones.
--
-- ── Con datos ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Aditiva: no borra ni renombra nada. El relleno de las filas que ya existen es `costo_exacto_dmc = centavos × 10 000`
-- (lo que esas filas SIEMPRE valieron: el exacto de algo que se guardó entero), y va ANTES del `check` y del
-- disparador. Producción no tiene insumos todavía; una base con ellos queda correcta, y los números sólo se afinan a
-- partir de la siguiente compra (que ya promedia sobre el exacto).
--
-- RLS y permisos no cambian: son de las tablas y de las vistas. Los índices tampoco.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  tabla text;
begin
  foreach tabla in array array['insumos', 'movimientos_stock', 'valuacion_lineas']
  loop
    if to_regclass('public.' || tabla) is null then
      raise exception '195: no existe la tabla %', tabla;
    end if;
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = tabla and column_name = 'costo_exacto_dmc'
    ) then
      raise exception '195: %.costo_exacto_dmc ya existe; la base no está como se esperaba', tabla;
    end if;
  end loop;
  foreach tabla in array array['existencias_por_insumo', 'kardex', 'descuentos_inventario_venta', 'merma_barra_turno']
  loop
    if to_regclass('public.' || tabla) is null then
      raise exception '195: no existe la vista %', tabla;
    end if;
  end loop;
end $$;

-- ── Las columnas ───────────────────────────────────────────────────────────────────────────────────────────
alter table insumos
  add column costo_exacto_dmc bigint not null default 0 constraint insumos_costo_exacto_no_negativo check (costo_exacto_dmc >= 0);
alter table movimientos_stock
  add column costo_exacto_dmc bigint not null default 0 constraint movimientos_stock_costo_exacto_no_negativo check (costo_exacto_dmc >= 0);
alter table valuacion_lineas
  add column costo_exacto_dmc bigint not null default 0 constraint valuacion_lineas_costo_exacto_no_negativo check (costo_exacto_dmc >= 0);

comment on column insumos.costo_exacto_dmc is
  'DP-D165 · El costo vigente por unidad base (g, ml, pieza) en DIEZMILÉSIMAS DE CENTAVO: 2.4 ¢/ml = 24000. Es el que MULTIPLICA; costo_unitario_centavos es este mismo costo redondeado al centavo, para mostrar.';
comment on column movimientos_stock.costo_exacto_dmc is
  'DP-D165 · El costo por unidad base que tenía el insumo al moverse, en diezmilésimas de centavo. El valor del movimiento es cantidad × este costo, redondeado UNA vez a centavos.';
comment on column valuacion_lineas.costo_exacto_dmc is
  'DP-D165 · El costo por unidad base con el que se valuó el renglón, en diezmilésimas de centavo. valor_centavos = cantidad × este costo, redondeado una vez.';

-- ── El relleno de lo que ya existe ─────────────────────────────────────────────────────────────────────────
-- ▼ RELLENO ▼  (la prueba de la migración extrae y corre este tramo; que nadie lo mueva de lugar)
update insumos
   set costo_exacto_dmc = costo_unitario_centavos * 10000
 where costo_unitario_centavos > 0;
update movimientos_stock
   set costo_exacto_dmc = costo_unitario_centavos * 10000
 where costo_unitario_centavos > 0;
update valuacion_lineas
   set costo_exacto_dmc = costo_unitario_centavos * 10000
 where costo_unitario_centavos > 0;
-- ▲ RELLENO ▲

-- ── La regla en la base: el redondeado ES el exacto redondeado ─────────────────────────────────────────────
alter table insumos
  add constraint insumos_costo_exacto_coherente
  check (costo_unitario_centavos = (costo_exacto_dmc + 5000) / 10000);
alter table movimientos_stock
  add constraint movimientos_stock_costo_exacto_coherente
  check (costo_unitario_centavos = (costo_exacto_dmc + 5000) / 10000);
alter table valuacion_lineas
  add constraint valuacion_lineas_costo_exacto_coherente
  check (costo_unitario_centavos = (costo_exacto_dmc + 5000) / 10000);

-- La columna que no se escribió se completa desde la que sí. Una sola función para las tres tablas: las dos columnas
-- se llaman igual en todas. `before insert or update of …` sólo se dispara cuando se toca una de las dos.
create or replace function costo_exacto_coherente() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.costo_exacto_dmc = 0 and new.costo_unitario_centavos > 0 then
      new.costo_exacto_dmc := new.costo_unitario_centavos * 10000;
    elsif new.costo_unitario_centavos = 0 and new.costo_exacto_dmc > 0 then
      new.costo_unitario_centavos := (new.costo_exacto_dmc + 5000) / 10000;
    end if;
  else
    if new.costo_exacto_dmc = old.costo_exacto_dmc
       and new.costo_unitario_centavos <> old.costo_unitario_centavos then
      new.costo_exacto_dmc := new.costo_unitario_centavos * 10000;
    elsif new.costo_unitario_centavos = old.costo_unitario_centavos
       and new.costo_exacto_dmc <> old.costo_exacto_dmc then
      new.costo_unitario_centavos := (new.costo_exacto_dmc + 5000) / 10000;
    end if;
  end if;
  return new;
end;
$$;

create trigger insumos_costo_exacto_coherente
  before insert or update of costo_unitario_centavos, costo_exacto_dmc on insumos
  for each row execute function costo_exacto_coherente();
create trigger movimientos_stock_costo_exacto_coherente
  before insert or update of costo_unitario_centavos, costo_exacto_dmc on movimientos_stock
  for each row execute function costo_exacto_coherente();
create trigger valuacion_lineas_costo_exacto_coherente
  before insert or update of costo_unitario_centavos, costo_exacto_dmc on valuacion_lineas
  for each row execute function costo_exacto_coherente();

-- ── Las vistas que multiplican, con las mismas columnas ────────────────────────────────────────────────────
create or replace view existencias_por_insumo as
select
  e.insumo_id,
  e.organizacion_id,
  sum(e.cantidad)                                          as cantidad,
  -- El valor del inventario a costo actual, en centavos: cada almacén, existencia × costo EXACTO, redondeado al
  -- centavo UNA vez. Lo negativo cuenta como cero (DP-D116/DP-D146). Se calcula aquí y no en el navegador para que la
  -- tarjeta no dependa de que la pantalla haya descargado la lista entera de insumos.
  sum(round(greatest(e.cantidad, 0) * i.costo_exacto_dmc / 10000))::bigint as valor_centavos
from existencias e
join insumos i on i.id = e.insumo_id and i.organizacion_id = e.organizacion_id
group by e.insumo_id, e.organizacion_id;

create or replace view kardex as
select
  m.organizacion_id,
  m.almacen_id,
  m.insumo_id,
  m.id                                                as movimiento_id,
  m.created_at,
  m.tipo,
  m.motivo,
  m.cantidad,
  m.unidad,
  m.costo_unitario_centavos,
  -- El costo del renglón en pesos-centavos: cantidad (firmada) × costo EXACTO, redondeado una vez. Una salida da un
  -- costo negativo y la suma corrida funciona sola.
  round(m.cantidad * m.costo_exacto_dmc / 10000)::bigint as importe_centavos,
  m.referencia_tipo,
  m.referencia_id,
  m.empleado_id,
  sum(m.cantidad) over (
    partition by m.organizacion_id, m.almacen_id, m.insumo_id
    order by m.created_at, m.id
    rows between unbounded preceding and current row
  ) as saldo
from movimientos_stock m;

create or replace view descuentos_inventario_venta as
select
  m.id,
  m.organizacion_id,
  m.referencia_id                         as venta_id,
  null::uuid                              as detalle_venta_id,
  null::uuid                              as producto_id,
  m.insumo_id                             as ingrediente_id,
  i.nombre                                as ingrediente_nombre,
  null::numeric                           as cantidad_producto,
  null::numeric                           as cantidad_ingrediente_por_producto,
  abs(m.cantidad)                         as cantidad_total_descontada,
  m.unidad                                as unidad_base,
  m.costo_unitario_centavos               as costo_unitario_snapshot,
  round(abs(m.cantidad) * m.costo_exacto_dmc / 10000)::bigint as costo_total_descontado,
  m.created_at                            as fecha
from movimientos_stock m
join insumos i on i.id = m.insumo_id and i.organizacion_id = m.organizacion_id
where m.referencia_tipo = 'orden'
  and m.tipo = 'salida_venta';

create or replace view merma_barra_turno as
select m.organizacion_id,
       m.sesion_caja_id,
       m.motivo,
       max(mm.etiqueta)                              as etiqueta,
       m.insumo_id,
       max(i.nombre)                                 as insumo_nombre,
       max(m.unidad)                                 as unidad,
       sum(abs(m.cantidad))                          as cantidad,
       round(sum(abs(m.cantidad) * m.costo_exacto_dmc) / 10000)::bigint as costo_centavos,
       count(*)::int                                 as eventos
  from movimientos_stock m
  join insumos i on i.id = m.insumo_id
  left join motivos_merma mm on mm.clave = m.motivo
 where m.referencia_tipo = 'merma_barra'
 group by m.organizacion_id, m.sesion_caja_id, m.motivo, m.insumo_id;

-- `create or replace view` suelta las opciones de la vista: se vuelven a poner. Sin `security_invoker` la vista correría con
-- los permisos de quien la creó y sería una puerta trasera al ledger de todas las organizaciones (060, 085).
alter view kardex set (security_invoker = on);
alter view merma_barra_turno set (security_invoker = on);

-- ── Lo que tiene que haber quedado ─────────────────────────────────────────────────────────────────────────
do $$
declare
  tabla text;
begin
  foreach tabla in array array['insumos', 'movimientos_stock', 'valuacion_lineas']
  loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = tabla and column_name = 'costo_exacto_dmc'
         and data_type = 'bigint' and is_nullable = 'NO'
    ) then
      raise exception '195: %.costo_exacto_dmc no quedó como se esperaba', tabla;
    end if;
    if not exists (
      select 1 from pg_constraint
       where conrelid = ('public.' || tabla)::regclass and conname = tabla || '_costo_exacto_coherente'
    ) then
      raise exception '195: no quedó el check %_costo_exacto_coherente', tabla;
    end if;
    if not exists (
      select 1 from pg_trigger
       where tgrelid = ('public.' || tabla)::regclass and tgname = tabla || '_costo_exacto_coherente'
    ) then
      raise exception '195: no quedó el disparador %_costo_exacto_coherente', tabla;
    end if;
  end loop;

  -- El relleno: ninguna fila con costo en centavos se quedó sin su exacto.
  if exists (select 1 from insumos where costo_unitario_centavos > 0 and costo_exacto_dmc = 0)
     or exists (select 1 from movimientos_stock where costo_unitario_centavos > 0 and costo_exacto_dmc = 0)
     or exists (select 1 from valuacion_lineas where costo_unitario_centavos > 0 and costo_exacto_dmc = 0) then
    raise exception '195: quedaron filas con costo en centavos y sin costo exacto';
  end if;

  -- Las vistas conservaron sus columnas (create or replace ya lo exige) y sus opciones.
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'existencias_por_insumo') <> 4 then
    raise exception '195: existencias_por_insumo cambió de columnas';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'kardex') <> 15 then
    raise exception '195: kardex cambió de columnas';
  end if;
  if not exists (
    select 1 from pg_class c
     where c.oid = 'public.kardex'::regclass and 'security_invoker=on' = any (coalesce(c.reloptions, '{}'))
  ) then
    raise exception '195: kardex perdió security_invoker';
  end if;
  if not exists (
    select 1 from pg_class c
     where c.oid = 'public.merma_barra_turno'::regclass and 'security_invoker=on' = any (coalesce(c.reloptions, '{}'))
  ) then
    raise exception '195: merma_barra_turno perdió security_invoker';
  end if;
end $$;
