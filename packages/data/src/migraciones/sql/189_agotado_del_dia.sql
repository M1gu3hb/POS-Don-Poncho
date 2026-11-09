-- ─────────────────────────────────────────────────────────────────────────────
-- 189 · EL PLATILLO AGOTADO DEL DÍA (DP-15, base propia de Don Poncho).
--
-- En una barbacoa se acaba la carne. Hasta hoy la única manera de que el mesero y el comensal
-- dejaran de pedir un platillo era ocultarlo en el POS: varios toques, sólo desde Productos, y nadie
-- se acordaba de volver a mostrarlo al día siguiente.
--
-- `agotado_hasta` es el fin del día del negocio en que alguien lo marcó agotado (lo calcula el
-- comando `catalogo.marcar_agotado` con `diaDelNegocio`). Un producto está agotado mientras
-- `agotado_hasta > now()`; al empezar el día siguiente deja de estarlo solo, sin que nadie lo
-- desmarque. Nula = disponible (lo de siempre).
--
-- Aditiva y sin datos: no cambia ningún producto existente. RLS y permisos no cambian (son de la
-- tabla; `morphiqpos_app` ya la lee y la escribe).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.productos') is null then
    raise exception '189: no existe la tabla productos';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'productos' and column_name = 'agotado_hasta'
  ) then
    raise exception '189: productos.agotado_hasta ya existe; la base no está como se esperaba';
  end if;
end $$;

alter table productos add column agotado_hasta timestamptz;

comment on column productos.agotado_hasta is
  'Fin del día del negocio en que se marcó agotado. Agotado mientras agotado_hasta > now(); nula = disponible (DP-15).';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'productos' and column_name = 'agotado_hasta'
       and data_type = 'timestamp with time zone' and is_nullable = 'YES'
  ) then
    raise exception '189: productos.agotado_hasta no quedó como timestamptz nula';
  end if;
  if exists (select 1 from productos where agotado_hasta is not null) then
    raise exception '189: ningún producto debía quedar agotado al migrar';
  end if;
end $$;
