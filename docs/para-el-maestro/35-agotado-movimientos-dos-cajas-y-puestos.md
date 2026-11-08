# 35 · El agotado del día, los movimientos de la cajera, dos cajas en el cierre y lo que ve cada puesto (DP-15)

Decisiones DP-D83 a DP-D87. **Una migración: la 189** (aditiva). Todo es genérico: salió de la
auditoría por función de DP-15 (`docs/qa/AUDITORIA-POR-FUNCION.md`) y el maestro tiene los mismos
huecos.

## Qué hace y por qué

- **El platillo agotado del día** (DP-D83):
  - migración `packages/data/src/migraciones/sql/189_agotado_del_dia.sql`: `productos.agotado_hasta
timestamptz`, nula = disponible; precondición (la columna no existe) y poscondición (tipo y nulable);
    RLS y permisos no cambian;
  - `packages/app/src/catalogo/agotado.ts`: `catalogo.marcar_agotado` (dueño, administrador, gerente,
    cocina) lo pone al fin del día del negocio con `diaDelNegocio`; `exigirNoAgotados` lo niega con
    `PRODUCTO_AGOTADO` en el pedido del mesero, el carrito y el envío del portal, el pedido directo del
    portal y el mostrador; `packages/domain/src/catalogo/agotado.ts` (`estaAgotado`) es la regla pura;
  - pantallas: `apps/web/src/restaurante/AgotadosDelDia.tsx` (Cocina y Productos), la etiqueta «Agotado
    hoy» en `Mesero.jsx` y `PortalCliente.jsx`; el menú público declara el campo `agotado`.
- **Los movimientos de la cajera** (DP-D84): `/caja` → «Movimientos» (retiro, entrada de cambio, corte
  de turno; gasto y devolución para la gerencia) en `MovimientosDeCaja.tsx`, con la entrada de cambio
  nueva (`venta/EntradaDeCambio.tsx`, `venta/importe-tecleado.ts`).
- **Dos cajas** (DP-D85): el Cierre del día avisa si queda otra abierta y cierra sólo la de ese aparato
  (`restaurante/otras-cajas-al-cerrar.ts`, `CierreDiarioDialog.jsx`); «Ventas hoy» del Tablero suma el
  día de todas las cajas (`tablero/del-dia.ts`); `caja.terminales` lista sólo las que abrieron alguna
  sesión de caja (`packages/app/src/caja/terminales.ts`).
- **La mesa y la cocina al cobrar** (DP-D87): `sincronizarMesa` cuenta sólo las comandas pendientes
  al pasar una a «listo» (`ESTADOS_COMANDA_PENDIENTES`); `cobrarOrden` entrega lo listo de la cuenta
  por renglón (`restaurante/comandas-al-cobrar.ts`); quitar el único platillo cancela su comanda; la
  estación no pinta lo quitado y marca «Cuenta cobrada» (`apps/web/src/restaurante/platos-de-la-estacion.ts`).
- **Lo que ve cada puesto** (DP-D86): Datos e Integraciones sólo para dueño y administrador
  (`configuracion/pestanas-de-mando.contrato.test.ts` y el puente); la apariencia sólo para el dueño;
  Compras sin botones para el almacén; Registros → «Auditoría» con `reportes.auditoria_reciente`
  (`registros/AuditoriaReciente.tsx`, `describir-accion.ts`).
- **Lo demás:** el pedido a medias del mesero se guarda en el aparato (`restaurante/borrador-del-pedido.ts`);
  el diálogo «Cobrar» no se sale de su tarjeta; «Cambiar de mesa, unir o dividir» desde el panel de la
  mesa; «Nueva mesa» propone el número libre (`cliente/numero-de-mesa.ts`); las zonas se crean y
  renombran desde Configuración → Mesas (`ZonasDelSalonDialog.jsx`, `cliente/zonas-del-salon.ts`); el
  ticket en 58 u 80 mm (`apps/web/src/impresion/`); el cierre dice lo mismo que Registros (`trim_scale`
  en el SQL del corte); las exportaciones en la hora del negocio; el portal sondea su estado completo
  cada 12 s (`portal/sondeo-del-portal.ts`); en el iPhone, «Agregar a inicio» abre como app
  (`appleWebApp` en `app/layout.tsx`).

## Pruebas

- Integración: `agotado`, `auditoria-reciente`, `terminales` y las de cada comando tocado.
- Unidad y contratos: los de cada pantalla nueva (`*.contrato.test.ts`), `impresion`, `corte`,
  `hora-del-restaurante`, `sondeo-del-portal`.
- Mutaciones: cada arreglo con sus mutantes, todos muertos (la bitácora de DP-15 los cuenta).

## Cómo portarlo

1. La 189 primero (aditiva), con `pnpm db:migrate`; después el código que la lee.
2. Lo demás es independiente entre sí. Los vacíos usan `Vacio` del sistema (la puerta de adopción).
3. Los cambios visuales en `heredado/` van con su motivo en `scripts/aspecto-permitido.json`.
