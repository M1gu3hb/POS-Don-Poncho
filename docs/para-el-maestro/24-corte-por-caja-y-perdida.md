# 24 · El corte: la pérdida por lo que valía, y cada caja con sus cuentas (DP-13.2)

## Qué hace y por qué

- **La pérdida** de una cuenta cancelada es sólo lo que valía lo ya preparado o entregado (antes:
  la cuenta entera si había UN platillo listo). Una cuenta mixta sale en las dos tablas del corte,
  cada una con su parte; Registros enseña el importe de la pérdida.
- **El corte de cada caja** trae sólo las cancelaciones de sus cuentas (las que cobró y las que
  canceló quien la abrió); **el Cierre del día** (el corte de la última caja abierta de la
  sucursal) trae todas las del día, una vez. Lo cancelado sin caja abierta cae en el Cierre del
  día que sigue. Antes, con dos cajas se duplicaban y lo de sin caja no salía (DP-D50).
- **El corte de una caja abierta** dice «Corte parcial · hasta HH:MM» y lee todo hasta ese mismo
  instante.

## Archivos

| Archivo                                                                                                                                                                         | Qué                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/app/src/caja/corte/alcance-del-corte.ts`                                                                                                                              | De qué cancelaciones habla un corte (la regla)                                  |
| `packages/app/src/caja/corte/cancelaciones.ts`                                                                                                                                  | `perdidaCentavos`; la lectura por alcance y la de Registros                     |
| `packages/app/src/caja/corte/documento.ts`, `consultas.ts`, `lectura-de-cancelaciones.ts`                                                                                       | `corteHasta`, `parcial`, `alcanceDeCancelaciones`; el heredado recibe `alcance` |
| `apps/web/src/corte/hoja.ts`, `cancelaciones.ts`, `cancelaciones-leidas.ts`, `CancelacionesRegistradas.tsx`                                                                     | Las dos tablas por partes, la nota del alcance, el corte parcial                |
| `apps/web/heredado/components/cortes/*`, `tickets/CorteTicket.jsx`                                                                                                              | El corte heredado con su alcance                                                |
| Pruebas: `cancelaciones-por-caja` y `cancelaciones-del-corte` (integración), `corte.test.ts`, `cancelaciones-registradas.test.ts`, `pruebas/e2e/cancelacion-del-mesero.spec.ts` |                                                                                 |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico (cualquier giro con varias cajas).

## Cómo portarlo

1. `alcance-del-corte.ts` y la lectura nueva de `cancelaciones.ts` (dos sentencias, cada una
   acotada al negocio: `corte.sql.test.ts`).
2. La hoja y el corte heredado con el alcance.
3. Revisar con el dueño la regla de la ventana (DP-D50): es una decisión, no una consecuencia.
