-- ─────────────────────────────────────────────────────────────────────────────
-- 197 · DE QUÉ CAJA SALIÓ LA PROPINA ENTREGADA (DP-25, parte 1).
--
-- DP-24 entregó las propinas desde el corte («lo entregado sale del cajón») y, para recordar de qué
-- caja salió cada liquidación, escribió la sesión en `liquidaciones_propina.sesion_caja_id`. Esa
-- columna no era suya: es la del REPARTO DEL TURNO (087, F-248), y el índice
-- `liquidaciones_un_reparto_por_turno` la hace única por turno. La primera entrega del turno pasaba;
-- la segunda chocaba con el índice y la cajera veía «Algo falló de nuestro lado».
--
-- ── Qué cambia ────────────────────────────────────────────────────────────────────────────────
-- La entrega tiene SU columna, `entregada_en_sesion_caja_id`: la caja de cuyo cajón salió el dinero
-- (el movimiento `propina_entregada` de esa caja la apunta con `referencia_id`). Varias entregas
-- pueden salir del mismo turno. Nula = se pagó fuera de cualquier caja.
--
-- ── Qué NO cambia ─────────────────────────────────────────────────────────────────────────────
-- `sesion_caja_id` y su índice único siguen como los dejó la 087: un turno se reparte una vez. Las
-- filas que ya existen no se tocan. RLS y permisos son de la tabla.
--
-- Aditiva: una columna nula con su llave foránea y un índice.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.liquidaciones_propina') is null then
    raise exception '197: no existe la tabla liquidaciones_propina';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'liquidaciones_propina'
       and column_name = 'entregada_en_sesion_caja_id'
  ) then
    raise exception '197: liquidaciones_propina.entregada_en_sesion_caja_id ya existe; la base no está como se esperaba';
  end if;
  if to_regclass('public.liquidaciones_un_reparto_por_turno') is null then
    raise exception '197: falta el índice liquidaciones_un_reparto_por_turno de la 087';
  end if;
end $$;

alter table liquidaciones_propina
  add column entregada_en_sesion_caja_id uuid references sesiones_caja (id);

create index liquidaciones_por_caja_que_entrega
  on liquidaciones_propina (entregada_en_sesion_caja_id)
  where entregada_en_sesion_caja_id is not null;

comment on column liquidaciones_propina.entregada_en_sesion_caja_id is
  'DP-25 · La caja de cuyo cajón salió el dinero de esta liquidación (su movimiento `propina_entregada`). Varias por turno. Nula = pagada fuera de la caja. No confundir con `sesion_caja_id`, que es el reparto del turno (087) y es uno por turno.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'liquidaciones_propina'
       and column_name = 'entregada_en_sesion_caja_id' and data_type = 'uuid' and is_nullable = 'YES'
  ) then
    raise exception '197: liquidaciones_propina.entregada_en_sesion_caja_id no quedó como se esperaba';
  end if;
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'liquidaciones_un_reparto_por_turno'
       and indexdef like 'CREATE UNIQUE INDEX%(sesion_caja_id)%'
  ) then
    raise exception '197: el índice del reparto por turno de la 087 debía seguir igual';
  end if;
  if exists (select 1 from liquidaciones_propina where entregada_en_sesion_caja_id is not null) then
    raise exception '197: ninguna liquidación existente debía quedar con caja de entrega';
  end if;
end $$;
