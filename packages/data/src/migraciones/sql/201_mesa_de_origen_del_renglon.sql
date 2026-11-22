-- ─────────────────────────────────────────────────────────────────────────────
-- 201 · LA MESA DE DONDE VINO CADA RENGLÓN (DP-D226, DP-25 · parte 6).
--
-- Al unir mesas, el consumo de las que entran SE MUEVE a la cuenta de la mesa principal: los
-- renglones cambian de `orden_id` y la cuenta de la mesa que entró queda «absorbida», sin
-- renglones. Hasta hoy eso borraba el rastro de quién pidió qué: en la cuenta del grupo, el mesero
-- no podía decir «la cerveza de la 7» y la precuenta salía sin esa referencia.
--
-- ── Qué se guarda ────────────────────────────────────────────────────────────────────────────
-- El NÚMERO de la mesa de la que vino el renglón (`mesa_origen_numero`), como instantánea, igual
-- que `producto_nombre` o `area_preparacion_snapshot`: lo que la cuenta dijo en ese momento. Nulo
-- es «es de la propia mesa de la cuenta» (todo renglón que nunca viajó). Lo escribe
-- `restaurante.unir_mesas` / `restaurante.agregar_a_la_union` al absorber una cuenta, y sólo si el
-- renglón no traía ya un origen (al absorber un grupo entero, lo que ya venía de la 7 sigue
-- diciendo «7»).
--
-- ── Qué NO cambia ────────────────────────────────────────────────────────────────────────────
-- Ninguna fila existente cambia de valor (todas quedan en nulo), ni el total, ni el cobro, ni
-- RLS ni permisos (son de la tabla; `morphiqpos_app` ya la lee y la escribe). No hay índice: no
-- se busca por esta columna, sólo se enseña junto al renglón. Es un entero positivo o nulo.
--
-- Aditiva: una columna nula y un `check`.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.orden_lineas') is null then
    raise exception '201: no existe la tabla orden_lineas';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'orden_lineas'
       and column_name = 'mesa_origen_numero'
  ) then
    raise exception '201: orden_lineas.mesa_origen_numero ya existe; la base no está como se esperaba';
  end if;
end $$;

alter table orden_lineas
  add column mesa_origen_numero integer;

alter table orden_lineas
  add constraint orden_lineas_mesa_origen_valida check (
    mesa_origen_numero is null or mesa_origen_numero > 0
  );

comment on column orden_lineas.mesa_origen_numero is
  'DP-D226 · El número de la mesa de la que vino este renglón al unir mesas (instantánea). Nulo: es de la propia mesa de la cuenta. No afecta importes.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'orden_lineas'
       and column_name = 'mesa_origen_numero' and data_type = 'integer' and is_nullable = 'YES'
  ) then
    raise exception '201: orden_lineas.mesa_origen_numero no quedó como se esperaba';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.orden_lineas'::regclass
       and conname = 'orden_lineas_mesa_origen_valida'
  ) then
    raise exception '201: no quedó el check orden_lineas_mesa_origen_valida';
  end if;
end $$;
