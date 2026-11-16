-- ─────────────────────────────────────────────────────────────────────────────
-- 193 · EL LUGAR DE CAJA (DP-21 · Bloque 5, base propia de Don Poncho).
--
-- Lo que vio Miguel: «las cajas se suman (Caja 28, Caja 32, Caja 37…)». Cada navegador o aparato
-- que entra crea una terminal y ése era el nombre que veía la caja: 35 terminales «Caja N» en
-- producción y el corte de prueba salió en «Caja 33».
--
-- La caja deja de ser el aparato. El cupo de la sucursal (`sucursales.cajas_simultaneas`, la 179)
-- define los LUGARES de caja: 1, 2… Cada sesión de caja guarda en cuál abrió (`lugar`), y ese
-- lugar viaja con ella cuando se traslada a otro aparato (`caja.traer` sólo cambia la terminal).
-- El nombre de cada lugar («Caja principal», «Caja barra») es un ajuste del negocio y vive en
-- `configuracion.valores.nombres_de_cajas`; sin nombre, «Caja 1», «Caja 2».
--
-- El índice único parcial no deja dos sesiones ABIERTAS en el mismo lugar de la misma sucursal:
-- es la red que respalda al comando, que elige el primer lugar libre dentro de su transacción.
-- El cupo lo sigue haciendo cumplir el disparador de la 179.
--
-- Aditiva y sin datos: las sesiones que ya existen quedan con `lugar` nulo (se siguen llamando
-- como su aparato) y ninguna cambia. RLS y permisos no cambian (son de la tabla; `morphiqpos_app`
-- ya la lee y la escribe).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.sesiones_caja') is null then
    raise exception '193: no existe la tabla sesiones_caja';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'sesiones_caja' and column_name = 'lugar'
  ) then
    raise exception '193: sesiones_caja.lugar ya existe; la base no está como se esperaba';
  end if;
end $$;

alter table sesiones_caja
  add column lugar smallint;

-- El cupo de la 179 va de 1 a 4: un lugar fuera de ahí no existe.
alter table sesiones_caja
  add constraint sesiones_caja_lugar_valido check (lugar is null or lugar between 1 and 4);

create unique index sesiones_caja_un_lugar_abierto
  on sesiones_caja (organizacion_id, sucursal_id, lugar)
  where estado = 'abierta' and lugar is not null;

comment on column sesiones_caja.lugar is
  'DP-21 · El lugar de caja de la sucursal (1, 2…) en el que abrió esta sesión. Viaja con la caja al trasladarla. Nulo en las sesiones anteriores a la 193.';
comment on index sesiones_caja_un_lugar_abierto is
  'DP-21 · Una sola caja abierta por lugar y sucursal. El cupo de lugares lo hace cumplir el disparador de la 179.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'sesiones_caja'
       and column_name = 'lugar' and data_type = 'smallint' and is_nullable = 'YES'
  ) then
    raise exception '193: sesiones_caja.lugar no quedó como se esperaba';
  end if;
  if to_regclass('public.sesiones_caja_un_lugar_abierto') is null then
    raise exception '193: no quedó el índice sesiones_caja_un_lugar_abierto';
  end if;
end $$;
