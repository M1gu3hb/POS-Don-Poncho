-- ─────────────────────────────────────────────────────────────────────────────
-- 194 · EL TELÉFONO OPCIONAL DEL PEDIDO PARA LLEVAR (DP-D157, base propia de Don Poncho).
--
-- La cajera toma un pedido para llevar con el nombre del cliente (`nombre_pedido`, la 081) y, ahora,
-- su teléfono si lo da: para llamarle cuando el pedido está listo y no se acerca a la barra. La Caja
-- lo ve en la lista de «Para llevar de hoy». No sale en el ticket del cliente ni en la cocina.
--
-- ── Por qué una columna nueva y no `cliente_nombre`/el padrón ────────────────────────────────
-- Igual que el nombre del pedido, es una ETIQUETA EFÍMERA de esta orden: el cliente no está
-- identificado ni tiene ficha. Meterlo en el padrón de clientes sembraría números sueltos en la
-- base con la que se hace la lealtad (la razón de la 081). Una columna en `ordenes`, junto a
-- `nombre_pedido`, es el menor cambio limpio.
--
-- ── Lo que exige el `check` ──────────────────────────────────────────────────────────────────
-- El servidor valida y limpia lo que llega (`@morphiqpos/domain/venta`, `normalizarTelefonoDelPedido`);
-- esto es la última red por si alguien escribe a mano: sólo dígitos, espacios, guiones y un «+» al
-- inicio; de 7 a 15 dígitos (el máximo de E.164) y no más de 20 caracteres. Nulo es «sin teléfono».
--
-- Aditiva y sin datos: ninguna orden existente cambia (todas quedan en nulo). RLS y permisos no
-- cambian (son de la tabla; `morphiqpos_app` ya la lee y la escribe). No hay índice: no se busca por
-- teléfono.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ordenes') is null then
    raise exception '194: no existe la tabla ordenes';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ordenes' and column_name = 'telefono_pedido'
  ) then
    raise exception '194: ordenes.telefono_pedido ya existe; la base no está como se esperaba';
  end if;
end $$;

alter table ordenes
  add column telefono_pedido text;

alter table ordenes
  add constraint ordenes_telefono_pedido_valido check (
    telefono_pedido is null
    or (
      telefono_pedido ~ '^\+?[0-9][0-9 -]*$'
      and char_length(telefono_pedido) <= 20
      and char_length(regexp_replace(telefono_pedido, '[^0-9]', '', 'g')) between 7 and 15
    )
  );

comment on column ordenes.telefono_pedido is
  'DP-D157 · El teléfono OPCIONAL del pedido para llevar, para llamar al cliente cuando está listo. Etiqueta efímera de la orden (como nombre_pedido): NO es el teléfono de un cliente identificado y no sale en el ticket.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ordenes'
       and column_name = 'telefono_pedido' and data_type = 'text' and is_nullable = 'YES'
  ) then
    raise exception '194: ordenes.telefono_pedido no quedó como se esperaba';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ordenes'::regclass and conname = 'ordenes_telefono_pedido_valido'
  ) then
    raise exception '194: no quedó el check ordenes_telefono_pedido_valido';
  end if;
end $$;
