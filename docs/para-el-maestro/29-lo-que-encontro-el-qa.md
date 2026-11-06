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
- **Las opciones del platillo para el personal (QA1-4):** `restaurante.opciones_de_los_platillos`
  (`POST /api/restaurante/opciones-de-los-platillos`) da los grupos de cada platillo con
  «obligatorio»; `Mesero.jsx` los pega a sus productos (espera a tenerlos antes de agregar) y el
  editor de Productos abre con lo guardado. En Don Poncho: la quesadilla, los pulques, los jugos y
  los licuados se mandaban a cocina sin su opción.
- **Dividir donde se cobra (QA1-5, QA1-6):** «Dividir» en el cobro de la caja heredada; las partes
  se llaman por su nombre («Mesa 5 · cuenta 1 de 2»).
- **La precuenta sin «Folio null» (QA1-7)** y **Registros con lo que guardó el cierre (QA1-8):** el
  CSV de cortes sólo pide lo que el puente sirve (con `TOTALES_DE_CAJA`, lo que agrega
  `adjuntarTotalesDeCaja`) y el PDF toma `diferencia_al_cerrar`.
- **Entradas que ya no truenan:** un filtro del puente con un valor de otro tipo es un 400
  (`PUENTE_FILTRO_INVALIDO`), no un 500 (QA2-002); un insumo de cocina sólo con unidades de
  cocina; la cuota del PIN de supervisor se devuelve al autorizar bien (QA2-001).

## Archivos

| Archivo                                                                                                                                                                                                                             | Qué                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `packages/app/src/caja/documento.ts`, `caja/corte/consultas.ts`, `caja/corte/devoluciones.ts`                                                                                                                                       | El corte y su documento     |
| `packages/data/src/repos/stock.ts`, `packages/data/src/repos/ordenes/ticket.ts`, `venta/consultas.ts`                                                                                                                               | Costo del consumo y ticket  |
| `packages/app/src/restaurante/cancelar-con-permiso.ts`, `restaurante/carrito-del-salon.ts`                                                                                                                                          | Cuenta pedida y carrito     |
| `packages/app/src/propinas/repositorio.ts`                                                                                                                                                                                          | Propinas de lo devuelto     |
| `packages/app/src/venta/descuento.ts`, `venta/topes-del-sistema.ts`                                                                                                                                                                 | Topes del sistema           |
| `apps/web/heredado/components/tickets/CorteTicket.jsx`                                                                                                                                                                              | El PDF del corte            |
| `packages/app/src/puente/consultar.ts`, `inventario/inventario.ts`, `app/api/identidad/supervisor/route.ts`                                                                                                                         | Entradas                    |
| `packages/contracts/src/errores/index.ts`, `apps/web/src/servidor/http.ts`                                                                                                                                                          | `PUENTE_FILTRO_INVALIDO`    |
| `packages/app/src/restaurante/opciones-de-los-platillos.ts`, `apps/web/src/restaurante/opciones-de-los-platillos.ts`, `use-opciones-de-los-platillos.ts`, `heredado/pages/Mesero.jsx`, `Productos.jsx`                              | Opciones del platillo       |
| `apps/web/heredado/pages/Caja.jsx`, `apps/web/src/restaurante/DividirLaCuenta.tsx`, `hoja-de-la-precuenta.ts`, `heredado/lib/exportColumns.js`, `corte-heredado/diferencia-del-corte.ts`, `puente/consultar.ts` (`TOTALES_DE_CAJA`) | Caja, precuenta y Registros |

Pruebas (integración): `documento-del-turno`, `salidas-por-caja`, `costo-del-consumo`,
`ticket-con-propina`, `propina-de-la-devuelta`, `topes-sin-configurar`, `devolucion-de-receta`,
`filtro-de-otro-tipo`, `unidad-del-insumo`, `opciones-de-los-platillos`; unitarias `supervisor-cuota`,
`diferencia-del-corte`, `precuenta-de-la-mesa`; contratos `margen-heredado`, `columnas-de-exportacion`,
`dividir-en-la-caja`, `opciones-de-los-platillos`; e2e `dividir-en-la-caja` y el paso del mesero en
`restaurante-menu-personalizado`.

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico. Sólo DP-D59 importa más en negocios dados de alta después de la 078.

## Cómo portarlo

1. Cada arreglo con su prueba; son independientes entre sí.
2. `PUENTE_FILTRO_INVALIDO` en `contracts` antes que `consultar.ts`.
3. `salidasSinVenta` cambió de firma (recibe el alcance del corte): pasar el alcance desde
   `documento.ts` y ajustar `corte.sql.test.ts`.
