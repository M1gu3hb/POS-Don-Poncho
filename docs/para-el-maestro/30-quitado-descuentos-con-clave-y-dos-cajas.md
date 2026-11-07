# 30 · Lo quitado no se cobra, los descuentos con clave y dos cajas (DP-14.1 y DP-14.2)

De la auditoría del 6-11 y de lo que decidió Miguel. **Sin migración.** Decisiones DP-D60, DP-D61
y DP-D62.

## Qué hace y por qué

- **El puente no sirve lo quitado (DP-D62):** `DetalleVenta` lleva `filtroFijo: { anulada_en: null }`
  (el `filtroFijo` acepta ahora `null` = `is null`) y la entidad nueva `RenglonQuitado` (la misma
  tabla con `soloConValorEn: ['anulada_en']`, sin importes) sirve lo quitado al historial. Antes la
  Caja enseñaba, dividía e imprimía el platillo anulado mientras el total ya no lo contaba.
  Genérico: el maestro tiene el mismo puente y el mismo defecto.
- **La Caja descuenta y cancela:** `DescuentoDeLaCuenta` y `CancelarLaCuenta` en el cobro de
  `Caja.jsx`, también en las partes de una cuenta dividida (`Venta.orden_padre_id`, nuevo en el
  puente). Genérico.
- **La autorización con PIN firma el monto y se gasta (DP-D61):** `identidad/supervisor.ts` firma
  `monto` (centavos) y `leerAutorizacion` lo exige; `venta/autorizacion-de-un-uso.ts` gasta el nonce
  (candado consultivo con el nonce y búsqueda en la auditoría del comando, en la misma
  transacción). Genérico, y conviene en el maestro.
- **El respaldo de los topes por puesto:** `topeDe` usa el tope del sistema para el puesto que el
  negocio no escribió (antes, sólo si no tenía ninguna fila). Genérico; corrige DP-D59.
- **Todo descuento con clave, y se pueden apagar:** `venta/descuentos-permitidos.ts`
  (`configuracion.permitir_descuentos`, `DESCUENTOS_APAGADOS`), la gerente que vuelve a teclear su
  PIN (`autorizarConPin` deja «uno mismo» sólo para descuentos), el tope propio de quien pide en
  cero en `autorizaciones_descuento`. **De Don Poncho** la regla «siempre PIN»; en el maestro puede
  quedar el tope por puesto con PIN por encima.
- **Los descuentos del corte, uno por uno:** `caja/corte/descuentos-del-corte.ts`
  (`caja.descuentos_del_corte`) y su sección en `CorteTicket.jsx`. Genérico.
- **Dos cajas (DP-D60):** `caja/cajas-a-la-vez.ts` (`caja.fijar_cajas_simultaneas`,
  `caja.cajas_simultaneas`), Configuración → Caja; «Ya se cobró en Caja 1» (`venta/ya-cobrada.ts`)
  y «Ya hay 2 cajas abiertas: cierra una». El tope de 2 es de Don Poncho (la base acepta 4).

## Archivos

| Archivo                                                                                                                                                                                                           | Qué                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `packages/app/src/puente/{tipos,consultar,escribir,mapa}.ts`, `apps/web/heredado/api/cliente.ts`, `heredado/pages/Ventas.jsx`                                                                                     | Lo quitado                                  |
| `apps/web/heredado/pages/Caja.jsx`                                                                                                                                                                                | Descuento y cancelar en el cobro            |
| `packages/app/src/identidad/supervisor.ts`, `apps/web/app/api/identidad/supervisor/route.ts`, `apps/web/src/venta/PinDeSupervisor.tsx`                                                                            | La firma con monto                          |
| `packages/app/src/venta/{autorizacion-de-un-uso,descuentos-permitidos,descuento-de-mostrador,descuento}.ts`, `restaurante/descuento-de-cuenta.ts`                                                                 | La regla de la clave                        |
| `apps/web/src/venta/{DescuentoDeVenta.tsx,use-descuentos-permitidos.ts}`, `restaurante/AjustesDeLaCuenta.tsx`, `configuracion/CajaYDescuentos.tsx`, `heredado/pages/Configuracion.jsx`                            | Pantallas                                   |
| `packages/app/src/caja/corte/descuentos-del-corte.ts`, `apps/web/src/corte-heredado/descuentos-del-corte.ts`, `heredado/components/tickets/CorteTicket.jsx`, `cortes/{CorteAutoDownloader,CorteViewerDialog}.jsx` | Descuentos en el corte                      |
| `packages/app/src/caja/{cajas-a-la-vez,sesion}.ts`, `venta/{ya-cobrada,cobrar}.ts`                                                                                                                                | Dos cajas                                   |
| `packages/contracts/src/errores/index.ts`                                                                                                                                                                         | `DESCUENTOS_APAGADOS`, `AUTORIZACION_USADA` |

Pruebas: integración `puente/renglones-quitados`, `restaurante/descuento-con-clave`,
`caja/dos-cajas`, `caja/corte/descuentos-del-corte`; unidad `identidad/supervisor` (monto y uno
mismo), `corte-heredado/descuentos-del-corte`; navegador `quitado-en-la-caja.spec.ts`. Ajustadas a la
regla nueva: `candado-de-la-cuenta`, `division-y-cobro`, `pedido-simultaneo`,
`descuento-de-mostrador` (unidad e integración), `descuento`, `topes-sin-configurar` y
`restaurante-operaciones.spec.ts`.

## Migraciones

Ninguna.

## Cómo portarlo

1. El puente primero (`filtroFijo` con `null`, `soloConValorEn`, `RenglonQuitado`): es
   independiente y arregla el ticket.
2. La firma con monto y el uso único, con la ruta y `PinDeSupervisor` a la vez (la pantalla manda
   `montoCentavos`).
3. Decidir en el maestro si «todo descuento con PIN» es por negocio (una bandera) o se queda el tope
   por puesto; el resto es igual.
