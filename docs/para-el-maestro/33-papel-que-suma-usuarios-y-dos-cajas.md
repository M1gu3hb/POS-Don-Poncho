# 33 · El papel que suma, los usuarios con su puesto real, dos cajas en pantalla y el descuento (DP-14, ronda 2)

Decisiones DP-D73 a DP-D79. **Sin migración.** Lo hicieron la sesión principal y dos agentes
(Sonnet) en sus worktrees, cada uno con su revisión adversarial.

## Qué hace y por qué

- **El papel suma (DP-D73):** `apps/web/src/venta/totales-del-papel.ts` es el único cálculo del papel
  (precuenta, ticket final, reimpresión, `/pos`, partes de una cuenta dividida: `PreCuentaTicket.jsx`)
  y del cobro de la Caja (`Caja.jsx`): renglones − descuento (+ IVA si no va incluido) = el total del
  servidor; + propina = lo cobrado. `venta.descuento_autorizado` dice quién autorizó y por qué.
  Genérico: el maestro tiene el mismo hueco en el ticket.
- **Dos cajas en pantalla (DP-D74):** `caja/traer.ts` trae el cupo; `Caja.jsx` y
  `CajaEnOtraTerminal.jsx` (abrir si cabe, traer con confirmación si no, el mensaje de la tercera, el
  cobro que se cierra si otra caja ya cobró); `caja/terminales.ts` (`caja.terminales`,
  `caja.nombrar_terminal`) y `configuracion/TerminalesDeLaSucursal.tsx`. Genérico.
- **El peso único:** `restaurante/peso.ts` (`cantidadEnLaLista`) en el cobro de la Caja y en Ventas.
- **Usuarios (DP-D76, DP-D77):** `puente/usuarios.ts` (el puesto real y el color guardado),
  `identidad/empleados.ts` (editarse, otorgar, sesiones, soltar las mesas al desactivar),
  `restaurante/repartir-mesas.ts`, y en lo heredado `UsuariosPOSSection.jsx`, `FilaDeUsuario.jsx`,
  `UsuarioPOSDialog.jsx`, `puestos.js`, `usePuesto.js`, `RepartirMesasDialog.jsx`,
  `lib/asignacionMesas.js` (la mesa sin mesero la ven todos). Genérico.
- **El descuento y cancelar (DP-D78):** `identidad/tope-del-autorizador.ts` y la ruta del supervisor
  (el tope de quien autoriza), `DescuentoDeVenta.tsx` y `AjustesDeLaCuenta.tsx` (hasta cuánto, el
  rechazo que pide el PIN otra vez, el doble toque, «Reemplaza»), `identidad/supervisor.ts` (el propio
  PIN para cancelar). Genérico.
- **El carrito caducado (DP-D79):** `portal/avisos-caducados.ts` (desde `puente/consultar.ts` para
  `SolicitudQR`) y `portal/carrito.ts` (el aviso sólo para quien tenía algo). Genérico.

## Pruebas

Unidad: `totales-del-papel`, `peso`, `empleados-propio`, `puestos-de-la-pantalla`, `mesas-sin-mesero`,
`tope-de-quien-autoriza`, `supervisor`, `avisos-caducados`, y contratos de las pantallas heredadas.
Integración: `venta/descuento-autorizado`, `caja/terminales`, `caja/traer`,
`identidad/usuarios-del-negocio`, `identidad/mesas-de-un-mesero`, `identidad/tope-del-autorizador`,
`portal/carrito-caducado-del-mapa`. Navegador: `ticket-con-descuento`, `usuarios-y-mesas`,
`descuento-y-cancelar-dp14-ronda2`, `carrito-caducado-dp14-ronda2`. Bancos de mutaciones, todos los
mutantes muertos.

## Cómo portarlo

1. `totales-del-papel.ts` primero; después el ticket y el cobro.
2. El puente de usuarios y `empleados.ts` juntos (la pantalla lee el puesto real).
3. Dos cajas, el descuento y el carrito caducado son independientes.
