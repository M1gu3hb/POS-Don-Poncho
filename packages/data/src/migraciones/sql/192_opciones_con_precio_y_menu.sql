-- ─────────────────────────────────────────────────────────────────────────────
-- 192 · LAS OPCIONES CON PRECIO, EL PESO POR PRESENTACIONES Y EL FONDO DE LA TARJETA (DP-16).
--
-- Cuatro columnas nuevas, todas aditivas y sin datos (nada existente cambia):
--
-- 1. `modificadores.minimo_elecciones` y `maximo_elecciones`: cuántas opciones se pueden elegir de
--    un grupo de «varias» («elige de 1 a 3 salsas»). Nulas = sin límite (lo de siempre). El
--    servidor las hace cumplir al elegir (`elegirLasOpciones`).
-- 2. `orden_linea_modificadores.delta_precio_centavos`: lo que esa opción le sumó (o restó) al
--    renglón, FIRMADO. `precio_extra_centavos` sigue como estaba (`>= 0`, de la 003) y guarda lo
--    positivo; la cuenta usa el firmado. Así «sin crema −$5» queda en la instantánea del pedido.
-- 3. `productos.solo_presets_variable`: el producto por peso que sólo se vende en sus
--    presentaciones (¼, ½, 1 kg…) y no en cantidad libre. Falso = lo de siempre.
-- 4. `productos.fondo_tarjeta`: el fondo de la tarjeta del producto sin foto en el menú digital
--    del comensal (un color, un degradado o una ilustración de la galería). Nulo = el de omisión.
--
-- RLS y permisos no cambian (son de las tablas; `morphiqpos_app` ya las lee y escribe).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and ((table_name = 'modificadores' and column_name in ('minimo_elecciones', 'maximo_elecciones'))
         or (table_name = 'orden_linea_modificadores' and column_name = 'delta_precio_centavos')
         or (table_name = 'productos' and column_name in ('solo_presets_variable', 'fondo_tarjeta')))
  ) then
    raise exception '192: alguna columna ya existe; la base no está como se esperaba';
  end if;
end $$;

alter table modificadores
  add column minimo_elecciones smallint,
  add column maximo_elecciones smallint;

alter table modificadores
  add constraint modificadores_minimo_valido check (minimo_elecciones is null or minimo_elecciones >= 0),
  add constraint modificadores_maximo_valido check (maximo_elecciones is null or maximo_elecciones >= 1),
  add constraint modificadores_minimo_hasta_maximo check (
    minimo_elecciones is null or maximo_elecciones is null or minimo_elecciones <= maximo_elecciones
  );

alter table orden_linea_modificadores
  add column delta_precio_centavos bigint not null default 0;

alter table productos
  add column solo_presets_variable boolean not null default false,
  add column fondo_tarjeta text;

alter table productos
  add constraint productos_fondo_tarjeta_corto check (fondo_tarjeta is null or length(fondo_tarjeta) <= 200);

comment on column modificadores.minimo_elecciones is
  'DP-16 · Cuántas opciones hay que elegir como mínimo en un grupo de varias. Nula = sin mínimo.';
comment on column modificadores.maximo_elecciones is
  'DP-16 · Cuántas opciones se pueden elegir como máximo en un grupo de varias. Nula = sin tope.';
comment on column orden_linea_modificadores.delta_precio_centavos is
  'DP-16 · Lo que la opción sumó (o restó, firmado) al renglón. La cuenta usa éste; precio_extra guarda lo positivo.';
comment on column productos.solo_presets_variable is
  'DP-16 · Por peso: sólo se vende en sus presentaciones (presets_variable), no en cantidad libre.';
comment on column productos.fondo_tarjeta is
  'DP-16 · Fondo de la tarjeta sin foto en el menú digital: color, degradado o ilustración. Nulo = omisión.';
