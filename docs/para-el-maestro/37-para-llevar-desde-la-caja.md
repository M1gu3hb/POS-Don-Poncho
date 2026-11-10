# 37 · El pedido para llevar desde la Caja, su número del día y «Entregado» (DP-16, parte 1)

Decisiones DP-D98 a DP-D100. **Una migración: la 191** (aditiva: dos columnas, dos `check` y un
índice único parcial en `ordenes`). Todo es genérico de restaurante: el maestro tiene las mismas
piezas (`venta.cobrar` con `comandarLineasPendientes`, el borrador por terminal, `canal` y
`nombre_pedido` de la 081).

## Qué hace y por qué

- **La migración 191** (`packages/data/src/migraciones/sql/191_numero_para_llevar.sql`):
  `ordenes.numero_pedido integer` y `ordenes.dia_del_pedido date`, juntas o ninguna
  (`ordenes_numero_pedido_con_su_dia`), positivas, y el índice único
  `ordenes_numero_pedido_del_dia (organizacion_id, dia_del_pedido, numero_pedido)` donde hay número.
  Tipos en `packages/data/src/esquema.ts` y el contrato en `scripts/esquema-esperado.json`.
- **El número del día** (`packages/app/src/venta/numero-para-llevar.ts`): `asignarNumeroParaLlevar`
  toma un `pg_advisory_xact_lock` por negocio, lee `max + 1` del día del negocio (`diaDelNegocio`) y lo
  escribe; un reintento conserva el número. Lo llama `venta.cobrar` (paso `numero_para_llevar`) cuando
  el canal es `llevar`, después del folio y antes de la cocina; el resultado trae `numeroPedido`.
- **Los comandos nuevos** (`packages/app/src/restaurante/`):
  - `restaurante.armar_para_llevar` (`para-llevar.ts`): el pedido en el borrador de la terminal, con
    `prepararTodas` y `prepararLasOpciones` del pedido del mesero (precio, agotado, opción
    obligatoria); reemplaza las líneas si ya había; no comanda.
  - `restaurante.descartar_para_llevar`: vacía el borrador si el cobro se canceló.
  - `restaurante.entregar_para_llevar` (`para-llevar-entregar.ts`): lo listo del pedido a entregado.
  - `restaurante.para_llevar_del_dia` (`para-llevar-del-dia.ts`, lectura): los pedidos del día con
    su estado en la cocina.
- **Lo listo ya cobrado de un pedido para llevar no se entrega solo** (`comandas-al-cobrar.ts`,
  `entregarLoListoYaCobrado`: `o.canal <> 'llevar'`).
- **El descuento de la cuenta** admite el pedido para llevar (`motivoParaNoDescontar`).
- **El puente** sirve `numero_pedido` y `nombre_pedido` en `Venta`, y `canal` y `numero_pedido` en
  `PedidoPreparacion`.
- **La pantalla** (`apps/web`): `heredado/components/caja/ParaLlevarDialog.jsx`,
  `heredado/components/pedido/{CatalogoDelPedido.jsx,useArmadoDelPedido.js}`,
  `src/restaurante/para-llevar/ParaLlevarDeHoy.tsx`, `src/restaurante/rotulo-de-la-comanda.ts`
  (cocina, teléfono y voz), `src/restaurante/toma-de-pedido/renglon-para-el-comando.ts`,
  `src/corte/{canales.ts,por-canal.ts}` (corte, Registros y CSV), y el renglón del ticket.

## Pruebas

- Integración: `packages/app/src/restaurante/para-llevar.integracion.test.ts` (de punta a punta con
  barbacoa ½ kg, opción y nota; cancelar el cobro; reemplazar; dos cajas a la vez; dos transacciones
  cruzadas a propósito; el corte de cada caja cuadra; el número vuelve a 1). Mutantes muertos: el
  candado, la entrega sola, el reintento, el cobro sin número, armar sin reemplazar y entregar sin
  entregar.
- Unidad: `rotulo-de-la-comanda.test.ts`, `canales.test.ts`, `pedidos-para-llevar.test.ts`,
  `renglon-para-el-comando.test.ts`, `descuento-de-cuenta.test.ts`.

## Para llevarlo al maestro

1. Aplicar la 191 con su `pnpm db:migrate` (aditiva; ninguna orden existente cambia).
2. Copiar los módulos y las rutas (`apps/web/app/api/restaurante/{armar,descartar,entregar}-para-llevar`,
   `para-llevar-del-dia`) y regenerar la matriz de permisos y el aislamiento.
3. En un giro que NO cobra antes de servir lo para llevar, la exclusión de `entregarLoListoYaCobrado`
   se puede quitar sin tocar lo demás.
