# 29 · Lo que encontró el QA: cuentas, cortes, propinas, topes y entradas (DP-13.5)

Todo sale de la ronda 1 de QA sobre una copia de producción (`docs/qa/HALLAZGOS.md`). Ninguno pide
migración y todos son genéricos: el maestro tiene el mismo código.

## Qué hace y por qué

- **El documento del corte de turno cuadra igual que el corte (QA2-008):** el esperado del PDF es
  la suma de los movimientos de la sesión hasta el corte, la apertura incluida, la misma cuenta que
  hizo el corte. Antes sumaba el fondo dos veces en el primer turno.
- **Las salidas sin venta del corte, por caja (QA2-004):** el corte de una caja sólo trae las
  salidas de su sucursal y de su tramo, y las de quien la abrió salvo el cierre del día.
- **El costo de lo consumido (QA2-003):** cada salida de almacén por venta guarda el costo del
  insumo en ese momento; antes quedaba en 0 y «Insumos consumidos» y el kardex salían a $0.
- **El ticket trae la propina y la hora del cobro (observación de QA2-005):** el payload de
  `venta.ticket` trae la propina y `emitidoEn` es el cobro, no la apertura de la cuenta.
- **Una cuenta pedida en caja no la cancela el mesero (QA2-007):** «pedida» también es la que ya
  tiene su código de caja.
- **El carrito del portal se olvida con sus teléfonos (QA2-006).**
- **La propina de una venta devuelta sigue pendiente (QA2-010):** devolver no devuelve la propina;
  `propinas.pendientes` también mira `parcialmente_reembolsada` y `reembolsada`.
- **Sin topes de descuento, los del sistema (QA2-009, DP-D59).**
- **El PDF del corte: el costo por producto por cantidad, y Costo/Utilidad sólo con margen
  (QA2-012).**
- **El corte sólo da por regresado lo que volvió al almacén (QA2-011):** se lee del movimiento de
  stock de la devolución, no de su casilla; lo de receta nunca regresa.
- **Entradas que ya no truenan:** un filtro del puente con un valor de otro tipo es un 400
  (`PUENTE_FILTRO_INVALIDO`), no un 500 (QA2-002); un insumo de cocina sólo con unidades de
  cocina; la cuota del PIN de supervisor se devuelve al autorizar bien (QA2-001).

## Archivos

| Archivo                                                                                                    | Qué                                  |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `packages/app/src/caja/documento.ts`, `caja/corte/consultas.ts`, `caja/corte/devoluciones.ts`              | El corte y su documento              |
| `packages/data/src/repos/stock.ts`, `packages/data/src/repos/ordenes/ticket.ts`, `venta/consultas.ts`      | Costo del consumo y ticket           |
| `packages/app/src/restaurante/cancelar-con-permiso.ts`, `restaurante/carrito-del-salon.ts`                 | Cuenta pedida y carrito              |
| `packages/app/src/propinas/repositorio.ts`                                                                 | Propinas de lo devuelto              |
| `packages/app/src/venta/descuento.ts`, `venta/topes-del-sistema.ts`                                        | Topes del sistema                    |
| `apps/web/heredado/components/tickets/CorteTicket.jsx`                                                     | El PDF del corte                     |
| `packages/app/src/puente/consultar.ts`, `inventario/inventario.ts`, `app/api/identidad/supervisor/route.ts` | Entradas                             |
| `packages/contracts/src/errores/index.ts`, `apps/web/src/servidor/http.ts`                                 | `PUENTE_FILTRO_INVALIDO`             |

Pruebas (integración): `documento-del-turno`, `salidas-por-caja`, `costo-del-consumo`,
`ticket-con-propina`, `propina-de-la-devuelta`, `topes-sin-configurar`, `devolucion-de-receta`,
`filtro-de-otro-tipo`, `unidad-del-insumo`; unitarias `supervisor-cuota`; contrato
`margen-heredado`.

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico. Sólo DP-D59 importa más en negocios dados de alta después de la 078.

## Cómo portarlo

1. Cada arreglo con su prueba; son independientes entre sí.
2. `PUENTE_FILTRO_INVALIDO` en `contracts` antes que `consultar.ts`.
3. `salidasSinVenta` cambió de firma (recibe el alcance del corte): pasar el alcance desde
   `documento.ts` y ajustar `corte.sql.test.ts`.
