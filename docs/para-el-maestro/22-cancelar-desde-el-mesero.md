# 22 · El mesero cancela con motivo, y el corte dice quién y qué fue pérdida (DP-12.4)

## Qué hace y por qué

- El mesero quita un platillo y cancela una cuenta desde su mesa, con motivo obligatorio. Antes
  sólo caja y dirección; la mesa se quedaba clavada.
- Cada cancelación queda con quién la hizo, cuándo, por qué, cuánto y la mesa.
- El corte (el del servidor y el heredado de la Caja) y Registros → «Cancelaciones» leen lo mismo
  del servidor. Lo que la cocina ya tenía listo o entregado sale aparte como PÉRDIDA, resaltado y
  con total.

## Archivos

| Archivo                                                                                                                                                        | Qué                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `packages/app/src/restaurante/cancelacion.ts`, `anulacion-linea.ts`                                                                                            | El rol `mesero`                     |
| `packages/app/src/caja/corte/cancelaciones.ts`, `lectura-de-cancelaciones.ts`                                                                                  | La lectura única y sus dos comandos |
| `apps/web/app/api/caja/cancelaciones-del-corte`, `cancelaciones-registradas`                                                                                   | Las rutas                           |
| `packages/domain/src/venta/anulacion.ts`                                                                                                                       | `etiquetaDelMotivoDeAnulacion`      |
| `apps/web/src/restaurante/CancelarDelMesero.tsx`, `cancelar-del-mesero*.ts`                                                                                    | La mesa del mesero                  |
| `apps/web/src/corte/cancelaciones*.ts`, `filtrar-cancelaciones.ts`, `CancelacionesRegistradas.tsx`, `HojaDelCorte.tsx`, `hoja.ts`                              | El corte y Registros                |
| `apps/web/heredado/components/cortes/*`, `tickets/CorteTicket.jsx`, `pages/Registros.jsx`, `pages/Mesero.jsx`                                                  | Las pantallas heredadas             |
| Pruebas: `cancelacion-del-mesero` y `cancelaciones-del-corte` (integración), `cancelaciones-heredado` (contrato), `pruebas/e2e/cancelacion-del-mesero.spec.ts` |                                     |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico.

## Cómo portarlo

1. Los roles, la lectura del corte con sus comandos y rutas, y la etiqueta del motivo.
2. Las pantallas: la mesa del mesero, el corte (las dos hojas con el mismo código) y Registros.
3. Regenerar la matriz de permisos y el aislamiento.
