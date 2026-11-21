-- ─────────────────────────────────────────────────────────────────────────────
-- 196 · EL ORDEN DE LOS PRODUCTOS DENTRO DE SU CATEGORÍA (DP-24, parte 3).
--
-- Hasta hoy el portal ordenaba los productos por nombre y la rejilla del mesero y la de la Caja
-- por lo que devolviera la lectura (también por nombre): `productos` no tenía de dónde sacar un
-- orden propio. Ahora cada producto puede llevar su lugar dentro de la categoría y un solo orden
-- manda en el portal QR, la rejilla del mesero, la de la Caja y el buscador.
--
-- ── El valor por omisión conserva el orden de hoy ────────────────────────────────────────────
-- La columna es NULA para todos los productos existentes. «Nulo» significa «nadie lo ordenó»: va
-- al final de su categoría y, entre los que no tienen orden, por nombre. Mientras nadie ordene,
-- el menú se ve exactamente igual que antes (por nombre). Los que se ordenan (1, 2, 3…) van antes.
--
-- ── El color de la categoría ──────────────────────────────────────────────────────────────────
-- `categorias.color` sólo aceptaba un hex (`#RRGGBB`) y nadie lo escribía ni lo leía. El menú
-- ahora guarda ahí la CLAVE de un color de una paleta fija (`cat-1` … `cat-16`, DP-24 · 3.4), cuyos
-- valores en claro y en oscuro viven como tokens de la interfaz. El `check` se AMPLÍA para aceptar
-- las dos formas: ninguna fila existente cambia ni deja de cumplirlo.
--
-- ── Qué NO cambia ─────────────────────────────────────────────────────────────────────────────
-- Ninguna fila existente cambia de valor; RLS y permisos son de la tabla (`morphiqpos_app` ya la
-- lee y la escribe). El orden de las categorías ya existe (`categorias.orden`).
--
-- Aditiva: una columna nula, un `check` nuevo, un `check` ampliado, un índice y un disparador.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.productos') is null then
    raise exception '196: no existe la tabla productos';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'productos'
       and column_name = 'orden_en_categoria'
  ) then
    raise exception '196: productos.orden_en_categoria ya existe; la base no está como se esperaba';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.categorias'::regclass and conname = 'categorias_color_check'
  ) then
    raise exception '196: no existe el check categorias_color_check que se iba a ampliar';
  end if;
end $$;

alter table productos
  add column orden_en_categoria integer;

alter table productos
  add constraint productos_orden_en_categoria_valido check (
    orden_en_categoria is null or orden_en_categoria >= 0
  );

create index productos_por_orden_en_categoria
  on productos (organizacion_id, categoria_id, orden_en_categoria);

-- Un producto que CAMBIA de categoría (se edita en Productos, o lo mueve un comando) pierde su lugar: el
-- número era de la otra categoría y en la nueva no significa nada. Vuelve a «nadie lo ordenó» (nulo: al
-- final, por nombre). Si la misma sentencia fija un lugar nuevo, ése se respeta.
create function public.productos_orden_al_cambiar_de_categoria()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $fn$
begin
  if new.categoria_id is distinct from old.categoria_id
     and new.orden_en_categoria is not distinct from old.orden_en_categoria then
    new.orden_en_categoria := null;
  end if;
  return new;
end
$fn$;

create trigger productos_orden_al_cambiar_de_categoria
  before update of categoria_id on productos
  for each row execute function public.productos_orden_al_cambiar_de_categoria();

alter table categorias drop constraint categorias_color_check;
alter table categorias
  add constraint categorias_color_check check (
    color is null
    or color ~ '^#[0-9a-fA-F]{6}$'
    or color ~ '^cat-([1-9]|1[0-6])$'
  );

comment on column productos.orden_en_categoria is
  'DP-24 · El lugar del producto dentro de su categoría (1, 2, 3…). Nulo = nadie lo ordenó: va al final de su categoría, por nombre. Un solo orden para el portal QR, la rejilla del mesero y la de la Caja.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'productos'
       and column_name = 'orden_en_categoria' and data_type = 'integer' and is_nullable = 'YES'
  ) then
    raise exception '196: productos.orden_en_categoria no quedó como se esperaba';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.productos'::regclass
       and conname = 'productos_orden_en_categoria_valido'
  ) then
    raise exception '196: no quedó el check productos_orden_en_categoria_valido';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.categorias'::regclass and conname = 'categorias_color_check'
       and pg_get_constraintdef(oid) like '%cat-%'
  ) then
    raise exception '196: el check del color de la categoría no quedó ampliado';
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.productos'::regclass
       and tgname = 'productos_orden_al_cambiar_de_categoria' and not tgisinternal
  ) then
    raise exception '196: no quedó el disparador productos_orden_al_cambiar_de_categoria';
  end if;
  if exists (select 1 from productos where orden_en_categoria is not null) then
    raise exception '196: ningún producto existente debía quedar con orden';
  end if;
end $$;
