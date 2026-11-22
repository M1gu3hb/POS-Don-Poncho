-- ─────────────────────────────────────────────────────────────────────────────
-- 204 · LA COPIA CIFRADA DEL PIN (DP-25, parte 7).
--
-- El PIN se guarda para entrar como hash Argon2id (`credenciales_pin.pin_hash`): de un hash no se
-- vuelve al PIN, y eso no cambia. Al personal se le olvida y cambiarlo a cada rato es un problema,
-- así que el DUEÑO puede verlo: para eso, al poner o cambiar un PIN se guarda además una COPIA
-- cifrada (AES-256-GCM, `v1.<vector>.<etiqueta>.<cuerpo>`), con una llave que vive sólo en el entorno
-- del servidor. La base nunca ve el PIN ni la llave.
--
-- ── Qué NO cambia ─────────────────────────────────────────────────────────────────────────────
-- Las credenciales que ya existen se quedan sin copia (nula): su PIN no se puede recuperar de un
-- hash, y la pantalla dice «No disponible: asígnalo de nuevo una vez». RLS y permisos son de la tabla:
-- `credenciales_pin` no se lee por el puente; sólo un comando del servidor la toca.
--
-- Aditiva: una columna nula y un `check` de su forma.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.credenciales_pin') is null then
    raise exception '204: no existe la tabla credenciales_pin';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'credenciales_pin'
       and column_name = 'pin_cifrado'
  ) then
    raise exception '204: credenciales_pin.pin_cifrado ya existe; la base no está como se esperaba';
  end if;
end $$;

alter table credenciales_pin
  add column pin_cifrado text;

-- La forma de la copia, para que nunca entre un PIN a la vista por error: cuatro partes separadas por
-- puntos, la primera la versión. Un PIN son de 4 a 8 dígitos y no cumple esta forma.
alter table credenciales_pin
  add constraint credenciales_pin_copia_cifrada check (
    pin_cifrado is null or pin_cifrado ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
  );

comment on column credenciales_pin.pin_cifrado is
  'DP-25 · Copia del PIN cifrada con AES-256-GCM (llave PIN_CIFRADO_CLAVE, sólo en el entorno del servidor), atada a su identidad. Sólo el dueño la ve, con su propio PIN, y cada vista queda en la auditoría. Nula = no hay copia (PIN de antes, o sin llave).';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'credenciales_pin'
       and column_name = 'pin_cifrado' and data_type = 'text' and is_nullable = 'YES'
  ) then
    raise exception '204: credenciales_pin.pin_cifrado no quedó como se esperaba';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.credenciales_pin'::regclass
       and conname = 'credenciales_pin_copia_cifrada'
  ) then
    raise exception '204: no quedó el check credenciales_pin_copia_cifrada';
  end if;
  if exists (select 1 from credenciales_pin where pin_cifrado is not null) then
    raise exception '204: ninguna credencial existente debía quedar con copia';
  end if;
end $$;
