/**
 * LAS INVARIANTES DE LA BASE (adaptadas de las consultas de QA de DP-15, `consultas-r2.sql`): cada una
 * es una consulta de SÓLO LECTURA que NO debe devolver filas; una fila es una violación. Se acotan a la
 * organización de Don Poncho. Generado del archivo de QA; no se edita a mano.
 */
export interface Invariante {
  readonly id: string;
  readonly nombre: string;
  readonly sql: string;
}

export const INVARIANTES: readonly Invariante[] = [
  {
    id: 'C01',
    nombre: 'cuenta cobrada sin pago confirmado, o pagos que no suman el total',
    sql: "select o.id, o.serie || '-' || o.folio as folio, o.estado, o.total_centavos,\n       coalesce(sum(p.monto_centavos) filter (where p.estado = 'confirmado'), 0) as pagado\n  from ordenes o\n  left join pagos p on p.orden_id = o.id and p.organizacion_id = o.organizacion_id\n where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado = 'pagada'\n group by o.id\nhaving coalesce(sum(p.monto_centavos) filter (where p.estado = 'confirmado'), 0) <> o.total_centavos",
  },
  {
    id: 'C02',
    nombre: 'total ≠ subtotal − descuento; impuestos ≠ IVA incluido 16 %; utilidad ≠ total − costo',
    sql: "with regla as (\n  select coalesce((c.valores -> 'impuesto' ->> 'puntosBase')::int, 1600)              as tasa,\n         coalesce((c.valores -> 'impuesto' ->> 'incluidoEnPrecio')::boolean, true)     as incluido\n    from (select 1) x left join configuracion c on c.organizacion_id = (select id from organizaciones where slug = 'don-poncho'))\nselect o.id, o.serie || '-' || o.folio as folio, o.subtotal_centavos, o.descuento_centavos,\n       o.impuestos_centavos, o.total_centavos, o.costo_total_centavos, o.utilidad_centavos, o.margen_bp,\n       r.tasa, r.incluido\n  from ordenes o cross join regla r\n where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada')\n   and ( o.total_centavos <> case when r.incluido then o.subtotal_centavos - o.descuento_centavos\n                                  else o.subtotal_centavos - o.descuento_centavos + o.impuestos_centavos end\n      or o.impuestos_centavos <> case when r.incluido\n                                      then (o.total_centavos * r.tasa * 2 + (10000 + r.tasa)) / ((10000 + r.tasa) * 2)\n                                      else ((o.subtotal_centavos - o.descuento_centavos) * r.tasa * 2 + 10000) / 20000 end\n      or o.utilidad_centavos <> o.total_centavos - o.costo_total_centavos\n      or o.margen_bp <> case when o.total_centavos = 0 then 0\n                             else (o.utilidad_centavos * 10000 / o.total_centavos) end )",
  },
  {
    id: 'C03',
    nombre: 'el encabezado no es la suma de sus platillos vivos (cuentas cobradas)',
    sql: "select o.id, o.serie || '-' || o.folio as folio,\n       o.subtotal_centavos, l.subtotal as suma_lineas, o.descuento_centavos, l.descuento as desc_lineas,\n       o.costo_total_centavos, l.costo as costo_lineas\n  from ordenes o\n  join lateral (\n         select coalesce(sum(x.subtotal_centavos), 0) as subtotal,\n                coalesce(sum(x.descuento_centavos), 0) as descuento,\n                coalesce(sum(round(x.cantidad * x.costo_unitario_centavos)), 0)::bigint as costo\n           from orden_lineas x\n          where x.orden_id = o.id and x.organizacion_id = o.organizacion_id and x.anulada_en is null) l on true\n where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado = 'pagada'\n   and (o.subtotal_centavos <> l.subtotal\n     or o.descuento_centavos <> least(l.descuento, l.subtotal)\n     or abs(o.costo_total_centavos - l.costo) > 1)",
  },
  {
    id: 'C04',
    nombre: 'cada platillo: total = subtotal − descuento; utilidad = total − costo',
    sql: "select l.id, o.serie || '-' || o.folio as folio, l.producto_nombre, l.cantidad, l.precio_unitario_centavos,\n       l.subtotal_centavos, l.descuento_centavos, l.total_centavos, l.costo_unitario_centavos, l.utilidad_centavos\n  from orden_lineas l join ordenes o on o.id = l.orden_id and o.organizacion_id = l.organizacion_id\n where l.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado = 'pagada' and l.anulada_en is null\n   and ( l.total_centavos <> l.subtotal_centavos - l.descuento_centavos\n      or abs(l.subtotal_centavos - round(l.cantidad * l.precio_unitario_centavos)) > 1 )",
  },
  {
    id: 'C05',
    nombre: 'folio de ticket repetido, cobrada sin folio, o hueco en la numeración (por serie)',
    sql: "select 'repetido' as caso, o.serie, o.folio::text as folio, count(*)::text as n\n  from ordenes o where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.folio is not null\n group by o.sucursal_id, o.serie, o.folio having count(*) > 1\nunion all\nselect 'sin_folio', o.serie, o.id::text, o.estado\n  from ordenes o where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada') and o.folio is null\nunion all\nselect 'hueco', serie, 'faltan ' || (maximo - minimo + 1 - cuantos)::text, 'de ' || minimo::text || ' a ' || maximo::text\n  from (select o.sucursal_id, o.serie, min(o.folio) as minimo, max(o.folio) as maximo, count(distinct o.folio) as cuantos\n          from ordenes o where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.folio is not null group by 1, 2) f\n where maximo - minimo + 1 <> cuantos",
  },
  {
    id: 'C07',
    nombre: 'cobrada sin caja, o con una caja de otra sucursal / ya cerrada antes de cobrarse',
    sql: "select o.id, o.serie || '-' || o.folio as folio, o.sesion_caja_id, s.sucursal_id as suc_caja, o.sucursal_id as suc_orden,\n       o.cobrada_en, o.cerrada_en, s.abierta_en, s.cerrada_en as caja_cerro\n  from ordenes o left join sesiones_caja s on s.id = o.sesion_caja_id\n where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada')\n   and ( o.sesion_caja_id is null or s.sucursal_id <> o.sucursal_id\n      or o.cerrada_en < s.abierta_en\n      or (s.cerrada_en is not null and o.cerrada_en > s.cerrada_en) )",
  },
  {
    id: 'C08',
    nombre:
      'pagos: sin orden, de otra caja que la de su orden, con cambio/recibido que no cuadra, cobrados tras el cierre',
    sql: "select p.id, o.serie || '-' || o.folio as folio, p.metodo, p.monto_centavos, p.propina_centavos, p.recibido_centavos,\n       p.cambio_centavos, p.sesion_caja_id, o.sesion_caja_id as caja_orden, 'detalle' as nota\n  from pagos p left join ordenes o on o.id = p.orden_id and o.organizacion_id = p.organizacion_id\n where p.organizacion_id = (select id from organizaciones where slug = 'don-poncho')\n   and ( o.id is null\n      or p.sesion_caja_id is distinct from o.sesion_caja_id\n      or (p.metodo = 'efectivo' and p.recibido_centavos is not null\n          and p.recibido_centavos - p.cambio_centavos <> p.monto_centavos + p.propina_centavos)\n      or exists (select 1 from sesiones_caja s where s.id = p.sesion_caja_id and s.cerrada_en is not null and p.created_at > s.cerrada_en) )",
  },
  {
    id: 'C09',
    nombre:
      'efectivo: movimiento de caja «venta» ≠ pagos en efectivo; «propina» ≠ propina en efectivo (por cuenta)',
    sql: "select o.id, o.serie || '-' || o.folio as folio,\n       coalesce(pg.efectivo, 0) as pagos_efectivo, coalesce(mv.venta, 0) as mov_venta,\n       coalesce(pg.propina_efectivo, 0) as propina_efectivo, coalesce(mv.propina, 0) as mov_propina\n  from ordenes o\n  left join lateral (select sum(p.monto_centavos) filter (where p.metodo = 'efectivo' and p.estado = 'confirmado') as efectivo,\n                            sum(p.propina_centavos) filter (where p.metodo = 'efectivo' and p.estado = 'confirmado') as propina_efectivo\n                       from pagos p where p.orden_id = o.id and p.organizacion_id = o.organizacion_id) pg on true\n  left join lateral (select sum(m.monto_centavos) filter (where m.tipo = 'venta') as venta,\n                            sum(m.monto_centavos) filter (where m.tipo = 'propina') as propina\n                       from movimientos_caja m where m.referencia_tipo = 'orden' and m.referencia_id = o.id and m.organizacion_id = o.organizacion_id) mv on true\n where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado = 'pagada'\n   and ( coalesce(pg.efectivo, 0) <> coalesce(mv.venta, 0)\n      or coalesce(pg.propina_efectivo, 0) <> coalesce(mv.propina, 0) )",
  },
  {
    id: 'C10',
    nombre:
      'movimientos de caja sin cuenta (referencia a orden que no existe / de otra org) o de una caja inexistente',
    sql: "select m.id, m.tipo, m.monto_centavos, m.referencia_tipo, m.referencia_id, m.sesion_caja_id\n  from movimientos_caja m\n where m.organizacion_id = (select id from organizaciones where slug = 'don-poncho')\n   and ( (m.referencia_tipo = 'orden' and not exists (select 1 from ordenes o where o.id = m.referencia_id and o.organizacion_id = m.organizacion_id))\n      or not exists (select 1 from sesiones_caja s where s.id = m.sesion_caja_id and s.organizacion_id = m.organizacion_id) )",
  },
  {
    id: 'C12',
    nombre: 'cuenta cancelada: con pagos, sin quién/motivo, o todavía con mesa que la apunta',
    sql: "select o.id, o.serie || '-' || coalesce(o.folio::text, '∅') as folio, o.estado, o.cancelada_por, o.motivo_cancelacion, o.cancelada_en,\n       (select count(*) from pagos p where p.orden_id = o.id) as pagos,\n       (select count(*) from mesas m where m.orden_activa_id = o.id) as mesas_que_la_apuntan\n  from ordenes o\n where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado = 'cancelada'\n   and ( o.cancelada_por is null or length(btrim(coalesce(o.motivo_cancelacion, ''))) < 3\n      or exists (select 1 from pagos p where p.orden_id = o.id)\n      or exists (select 1 from mesas m where m.orden_activa_id = o.id) )",
  },
  {
    id: 'K07',
    nombre: 'Σ por método ≠ venta del corte (sin reembolsos)',
    sql: "select s.id, s.serie || '-' || coalesce(s.folio::text, '∅') as corte,\n       (select coalesce(sum(p.monto_centavos), 0) from pagos p where p.sesion_caja_id = s.id and p.estado = 'confirmado') as pagos_confirmados,\n       (select coalesce(sum(o.total_centavos), 0) from ordenes o where o.sesion_caja_id = s.id and o.estado in ('pagada', 'parcialmente_reembolsada')) as venta_tickets\n  from sesiones_caja s\n where s.organizacion_id = (select id from organizaciones where slug = 'don-poncho')\n   and (select coalesce(sum(p.monto_centavos), 0) from pagos p where p.sesion_caja_id = s.id and p.estado = 'confirmado')\n    <> (select coalesce(sum(o.total_centavos), 0) from ordenes o where o.sesion_caja_id = s.id and o.estado in ('pagada', 'parcialmente_reembolsada'))",
  },
  {
    id: 'P03',
    nombre:
      'propina cobrada que el panel de «propinas pendientes» ya no ve (venta devuelta en parte o entera)',
    sql: "select o.id, o.serie || '-' || o.folio as folio, o.estado, sum(p.propina_centavos) as propina_sin_liquidar\n  from ordenes o join pagos p on p.orden_id = o.id and p.estado in ('confirmado', 'reembolsado')\n where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado in ('parcialmente_reembolsada', 'reembolsada') and o.propina_liquidacion_id is null\n group by o.id having sum(p.propina_centavos) > 0",
  },
  {
    id: 'X02',
    nombre: 'comanda viva, platillo vivo o solicitud pendiente de una cuenta cancelada o cobrada',
    sql: "select 'comanda_viva' as caso, c.id::text as id, c.estado, o.estado as orden_estado, o.id::text as orden\n  from comandas c join ordenes o on o.id = c.orden_id\n -- (una cuenta de mesa cobrada ANTES de que cocina termine deja su comanda viva: legítimo; sólo la cancelada no)\n where c.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado = 'cancelada' and c.estado in ('nuevo', 'en_preparacion')\nunion all\nselect 'item_vivo', ci.id::text, ci.estado, o.estado, o.id::text\n  from comanda_items ci join comandas c on c.id = ci.comanda_id join ordenes o on o.id = c.orden_id\n -- un platillo `entregado` de una cuenta que luego se canceló SE QUEDA entregado a propósito: es la evidencia de la pérdida\n where ci.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado = 'cancelada' and ci.estado in ('pendiente', 'en_preparacion', 'listo')\nunion all\nselect 'linea_no_cancelada', l.id::text, l.estado_preparacion, o.estado, o.id::text\n  from orden_lineas l join ordenes o on o.id = l.orden_id\n -- un platillo ANULADO antes de cancelar la cuenta conserva el estado de cocina que tenía (es la evidencia de su pérdida)\n where l.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado = 'cancelada' and l.estado_preparacion <> 'cancelado' and l.anulada_en is null\nunion all\nselect 'solicitud_viva', s.id::text, s.estado, o.estado, o.id::text\n  from solicitudes_qr s join ordenes o on o.id = s.orden_id\n where s.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and s.estado in ('pendiente', 'atendida') and o.estado in ('cancelada', 'pagada')",
  },
  {
    id: 'X04',
    nombre:
      'platillo anulado: sin quién/motivo, con comanda viva, o aún sumado en una cuenta ya cobrada',
    sql: "select l.id, o.serie || '-' || coalesce(o.folio::text, '∅') as folio, l.producto_nombre, l.anulada_en, l.motivo_anulacion, l.empleado_anula_id,\n       o.estado, (select count(*) from comanda_items ci where ci.orden_linea_id = l.id and ci.estado not in ('cancelado')) as items_vivos\n  from orden_lineas l join ordenes o on o.id = l.orden_id\n where l.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and l.anulada_en is not null\n   and ( l.empleado_anula_id is null or l.motivo_anulacion is null\n      or exists (select 1 from comanda_items ci where ci.orden_linea_id = l.id and ci.estado in ('pendiente', 'en_preparacion')) )",
  },
  {
    id: 'M01',
    nombre: 'estado de la mesa incoherente con su cuenta',
    sql: "select m.numero, m.estado, m.orden_activa_id, o.estado as orden_estado, m.unida_a_mesa_id,\n       case\n         when m.orden_activa_id is null or o.estado in ('pagada', 'cancelada', 'absorbida') then 'ocupada_sin_cuenta_viva'\n         when o.estado = 'dividida' then 'ocupada_por_dividida_ya_saldada'\n         when m.estado in ('libre', 'limpieza') then 'libre_o_limpieza_con_cuenta_viva'\n         else 'cuenta_solicitada_con_cuenta_que_no_lo_es'\n       end as caso\n  from mesas m left join ordenes o on o.id = m.orden_activa_id\n where m.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and m.activa\n   and ( ( m.estado in ('esperando_orden', 'pedido_enviado', 'en_preparacion', 'en_espera_entrega', 'ocupada', 'cuenta_solicitada')\n           and m.unida_a_mesa_id is null\n           and ( m.orden_activa_id is null or o.estado in ('pagada', 'cancelada', 'absorbida')\n              or ( o.estado = 'dividida'\n                   and not exists (select 1 from ordenes h where h.orden_padre_id = o.id\n                                    and h.estado in ('borrador', 'confirmada', 'en_preparacion', 'lista', 'cuenta_solicitada', 'parcialmente_pagada')) ) ) )\n      or ( m.estado in ('libre', 'limpieza') and o.id is not null\n           and o.estado in ('borrador', 'confirmada', 'en_preparacion', 'lista', 'cuenta_solicitada', 'parcialmente_pagada') )\n      or ( m.estado = 'cuenta_solicitada' and o.id is not null and o.estado not in ('cuenta_solicitada', 'parcialmente_pagada', 'dividida') ) )",
  },
  {
    id: 'M02',
    nombre: 'cuenta viva con mesa que no la tiene (la mesa libre o apuntando a otra cuenta)',
    sql: "select o.id, o.serie, o.estado, m.numero, m.estado as mesa_estado, m.orden_activa_id\n  from ordenes o join mesas m on m.id = o.mesa_id\n where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado in ('borrador', 'confirmada', 'en_preparacion', 'lista', 'cuenta_solicitada', 'parcialmente_pagada')\n   and m.orden_activa_id is distinct from o.id\n   and not exists (select 1 from ordenes h where h.orden_padre_id = o.orden_padre_id and o.orden_padre_id is not null and h.id = m.orden_activa_id)",
  },
  {
    id: 'M03',
    nombre:
      'UNIÓN VARADA: viva sin mesas, mesa absorbida de unión cerrada o inexistente, principal que no es la que dice',
    sql: "select 'union_viva_sin_miembros' as caso, u.id::text, u.mesa_principal_id::text, null::text\n  from uniones_mesa u\n where u.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and u.cerrada_en is null\n   and not exists (select 1 from union_mesa_miembros x where x.union_id = u.id)\nunion all\nselect 'absorbida_sin_union_viva', m.id::text, m.numero::text, m.unida_a_mesa_id::text\n  from mesas m\n where m.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and m.unida_a_mesa_id is not null\n   and not exists (select 1 from uniones_mesa u join union_mesa_miembros x on x.union_id = u.id\n                    where u.organizacion_id = m.organizacion_id and u.cerrada_en is null\n                      and u.mesa_principal_id = m.unida_a_mesa_id and x.mesa_id = m.id)\nunion all\nselect 'miembro_abierto_de_union_cerrada', x.union_id::text, x.mesa_id::text, null\n  from union_mesa_miembros x join uniones_mesa u on u.id = x.union_id\n where u.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and u.cerrada_en is not null and x.union_abierta\nunion all\nselect 'miembro_vivo_sin_marca_en_mesa', x.union_id::text, x.mesa_id::text, null\n  from union_mesa_miembros x join uniones_mesa u on u.id = x.union_id join mesas m on m.id = x.mesa_id\n where u.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and u.cerrada_en is null and m.unida_a_mesa_id is distinct from u.mesa_principal_id\nunion all\nselect 'dos_uniones_vivas_misma_principal', u.mesa_principal_id::text, count(*)::text, null\n  from uniones_mesa u where u.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and u.cerrada_en is null group by u.mesa_principal_id having count(*) > 1\nunion all\nselect 'absorbida_con_orden_viva', m.id::text, o.id::text, o.estado\n  from mesas m join ordenes o on o.id = m.orden_activa_id\n where m.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and m.unida_a_mesa_id is not null and o.estado not in ('absorbida')",
  },
  {
    id: 'I01',
    nombre: 'existencia ≠ Σ movimientos (el kardex no cuadra con el saldo)',
    sql: "select i.nombre, e.almacen_id, e.cantidad as existencia, coalesce(k.suma, 0) as suma_movimientos\n  from existencias e join insumos i on i.id = e.insumo_id\n  left join lateral (select sum(m.cantidad) as suma from movimientos_stock m\n                      where m.insumo_id = e.insumo_id and m.almacen_id = e.almacen_id and m.organizacion_id = e.organizacion_id) k on true\n where e.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and e.cantidad <> coalesce(k.suma, 0)",
  },
  {
    id: 'I03',
    // DP-18 (A3): por peso y por porción bajan su ingrediente base sin receta; el I03 sólo miraba
    // recetas y el día 3 contó 110 renglones «sin esperado» que la app descontó bien.
    nombre:
      'venta: lo descontado ≠ cantidad vendida × receta o ingrediente base (cuentas cobradas)',
    sql: "with esperado as (\n  select orden_id, insumo_id, sum(cant) as cant from (\n  select o.id as orden_id, r.insumo_id, l.cantidad * r.cantidad * (1 + r.merma_bp / 10000.0) as cant\n    from ordenes o join orden_lineas l on l.orden_id = o.id and l.anulada_en is null\n    join recetas r on r.producto_id = l.producto_id and r.activa\n         and (r.aplica_canal is null or r.aplica_canal = '{}' or o.canal = any (r.aplica_canal))\n   where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada')\n  union all\n  select o.id, l.insumo_base_id,\n         case when l.tipo_venta = 'porcion_contenedor' then l.cantidad_porciones * l.ml_por_porcion\n              when l.unidad_variable in ('kg', 'l') then l.cantidad_variable * 1000\n              else l.cantidad_variable end\n    from ordenes o join orden_lineas l on l.orden_id = o.id and l.anulada_en is null\n   where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada')\n     and l.insumo_base_id is not null) x group by 1, 2),\nreal as (\n  select m.referencia_id as orden_id, m.insumo_id, -sum(m.cantidad) as cant\n    from movimientos_stock m where m.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and m.tipo = 'salida_venta' and m.referencia_tipo = 'orden' group by 1, 2)\nselect coalesce(e.orden_id, r.orden_id) as orden, i.nombre, e.cant as esperado, r.cant as descontado\n  from esperado e full join real r on r.orden_id = e.orden_id and r.insumo_id = e.insumo_id\n  left join insumos i on i.id = coalesce(e.insumo_id, r.insumo_id)\n where abs(coalesce(e.cant, 0) - coalesce(r.cant, 0)) > 0.001\n order by 1",
  },
  {
    id: 'I06',
    nombre: 'existencia negativa (informativa: tras una cancelación puede ser legítima, DP-D57)',
    sql: "select i.nombre, e.cantidad from existencias e join insumos i on i.id = e.insumo_id where e.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and e.cantidad < 0",
  },
  {
    id: 'A01',
    nombre: 'comando que escribió sin fila de auditoría, o fila de auditoría de éxito sin comando',
    sql: "select 'comando_sin_auditoria' as caso, c.comando, c.correlation_id::text, c.created_at\n  from comandos_ejecutados c\n where c.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and c.completado_en is not null\n   and not exists (select 1 from auditoria a where a.organizacion_id = c.organizacion_id and a.correlation_id = c.correlation_id and a.accion = c.comando)\nunion all\nselect 'auditoria_sin_comando', a.accion, a.correlation_id::text, a.created_at\n  from auditoria a\n where a.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and a.id > 0 and a.accion <> 'negocio.alta' and coalesce(a.payload ->> 'resultado', '') = ''\n   and not exists (select 1 from comandos_ejecutados c where c.organizacion_id = a.organizacion_id and c.correlation_id = a.correlation_id and c.comando = a.accion)\nunion all\nselect 'comando_sin_completar', c.comando, c.correlation_id::text, c.created_at\n  from comandos_ejecutados c where c.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and c.completado_en is null",
  },
  {
    id: 'A02',
    nombre:
      'hechos del día SIN su fila de auditoría (cobro, cancelación, anulación, caja abierta/cerrada, unión)',
    sql: "select 'cobro' as hecho, o.id::text as id from ordenes o\n where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado in ('pagada', 'parcialmente_reembolsada', 'reembolsada')\n   and not exists (select 1 from auditoria a where a.organizacion_id = o.organizacion_id and a.accion = 'venta.cobrar' and a.entidad_id = o.id)\nunion all\nselect 'cancelacion', o.id::text from ordenes o\n where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and o.estado = 'cancelada'\n   and not exists (select 1 from auditoria a where a.organizacion_id = o.organizacion_id and a.accion in ('restaurante.cancelar_orden', 'restaurante.liberar_mesa', 'venta.vaciar_orden') and a.entidad_id = o.id)\nunion all\nselect 'anulacion', l.id::text from orden_lineas l\n where l.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and l.anulada_en is not null\n   and not exists (select 1 from auditoria a where a.organizacion_id = l.organizacion_id and a.accion = 'restaurante.anular_linea' and (a.entidad_id = l.id or a.entidad_id = l.orden_id))\nunion all\nselect 'caja_abierta', s.id::text from sesiones_caja s\n where s.organizacion_id = (select id from organizaciones where slug = 'don-poncho')\n   and not exists (select 1 from auditoria a where a.organizacion_id = s.organizacion_id and a.accion = 'caja.abrir' and a.entidad_id = s.id)\nunion all\nselect 'caja_cerrada', s.id::text from sesiones_caja s\n where s.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and s.estado = 'cerrada'\n   and not exists (select 1 from auditoria a where a.organizacion_id = s.organizacion_id and a.accion = 'caja.cerrar' and a.entidad_id = s.id)\nunion all\nselect 'union', u.id::text from uniones_mesa u\n where u.organizacion_id = (select id from organizaciones where slug = 'don-poncho')\n   and not exists (select 1 from auditoria a where a.organizacion_id = u.organizacion_id and a.accion = 'restaurante.unir_mesas' and a.created_at between u.abierta_en - interval '5 seconds' and u.abierta_en + interval '5 seconds')\nunion all\nselect 'separacion', u.id::text from uniones_mesa u\n where u.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and u.cerrada_en is not null and u.cerrada_en > '2026-11-02'::timestamptz\n   -- una unión se cierra con «Separar mesas» o al liberar la principal con `grupo: 'separar'` (DP-9.6)\n   and not exists (select 1 from auditoria a where a.organizacion_id = u.organizacion_id\n                      and a.accion in ('restaurante.separar_mesas', 'restaurante.liberar_mesa')\n                      and a.created_at between u.cerrada_en - interval '5 seconds' and u.cerrada_en + interval '5 seconds')",
  },
  {
    id: 'G01',
    nombre: 'hijas con organización distinta a la del padre (fuga entre negocios)',
    sql: "select 'orden_linea' as tabla, l.id from orden_lineas l join ordenes o on o.id = l.orden_id where l.organizacion_id <> o.organizacion_id\nunion all select 'pago', p.id from pagos p join ordenes o on o.id = p.orden_id where p.organizacion_id <> o.organizacion_id\nunion all select 'comanda', c.id from comandas c join ordenes o on o.id = c.orden_id where c.organizacion_id <> o.organizacion_id\nunion all select 'comanda_item', ci.id from comanda_items ci join comandas c on c.id = ci.comanda_id where ci.organizacion_id <> c.organizacion_id\nunion all select 'mov_caja', m.id from movimientos_caja m join sesiones_caja s on s.id = m.sesion_caja_id where m.organizacion_id <> s.organizacion_id\nunion all select 'mov_stock', m.id from movimientos_stock m join insumos i on i.id = m.insumo_id where m.organizacion_id <> i.organizacion_id\nunion all select 'solicitud', s.id from solicitudes_qr s join mesas m on m.id = s.mesa_id where s.organizacion_id <> m.organizacion_id",
  },
  {
    id: 'G02',
    nombre: 'sucursal incoherente: cuenta de una sucursal en la mesa/caja de otra',
    sql: "select o.id, o.sucursal_id as suc_orden, m.sucursal_id as suc_mesa, s.sucursal_id as suc_caja\n  from ordenes o left join mesas m on m.id = o.mesa_id left join sesiones_caja s on s.id = o.sesion_caja_id\n where o.organizacion_id = (select id from organizaciones where slug = 'don-poncho') and ( m.sucursal_id <> o.sucursal_id or s.sucursal_id <> o.sucursal_id )",
  },
];
