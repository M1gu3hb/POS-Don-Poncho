# 23 · Las pantallas que se veían mal (DP-12.6)

## Qué hace y por qué

- Menú QR: la marca del precio tapa el precio impreso en todos los anchos de teléfono; «Atención»
  a la izquierda, sin tapar la columna de precios.
- Cocina en el teléfono: el encabezado ya no se encima. El botón redondo del menú no tapa
  contenido. Las pestañas de Solicitudes no se salen de lo ancho.
- Ventas: sin receta, «—, sin receta» (no 100 %); también en tablero, Registros, PDF y CSV. Sin la
  pastilla vacía del folio; el encabezado dice qué cuenta.
- El nombre de mesa no se repite («Mesa 2 · Mesa 2»).
- Con 25 mesas ninguna nace encima de otra.
- Un solo sistema de sonido (el gestor de DP-11.3), con la voz después del sonido.
- La limpieza automática de solicitudes, a lo mucho una vez por hora, sin auditoría cuando no toca.

## Archivos

| Archivo                                                                                                                                                                                                                                                 | Qué                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `apps/web/src/restaurante/menu-qr/*`, `heredado/components/portalqr/AtencionFAB.jsx`                                                                                                                                                                    | Menú QR                             |
| `heredado/pages/Cocina.jsx`, `components/common/AppLayout.jsx`, `portalqr/SolicitudesQRTab.jsx`                                                                                                                                                         | Teléfono                            |
| `packages/domain/src/venta/costo-de-la-venta.ts`, `apps/web/src/restaurante/margen-de-las-ventas.ts`, `MargenDeLaVenta.tsx`, `heredado/pages/Ventas.jsx`, `Dashboard.jsx`, `FinancialChart.jsx`, `registros/*`, `packages/app/src/reportes/exportar.ts` | Margen sin receta                   |
| `apps/web/src/restaurante/nombre-de-la-mesa.ts` y nueve pantallas                                                                                                                                                                                       | Nombre de mesa                      |
| `apps/web/src/cliente/mesas-del-mapa.ts`                                                                                                                                                                                                                | 25 mesas                            |
| `apps/web/src/sonidos/gestor.ts` y los vigilantes de Cocina y del mesero                                                                                                                                                                                | Un solo sonido                      |
| `packages/app/src/restaurante/limpieza-de-solicitudes.ts`, `solicitudes.ts`, `fallos.ts`, `comando.ts`                                                                                                                                                  | La limpieza por hora y `SinNovedad` |
| Pruebas: `pantallas-sin-estorbos.spec.ts`, `mesas-tres-y-veinticinco.spec.ts`, `sonidos.spec.ts` y las de unidad, contrato e integración                                                                                                                |                                     |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico, salvo dónde se llamó a `sonar` (las pantallas del restaurante).

## Cómo portarlo

1. El dominio (`costo-de-la-venta.ts`), `SinNovedad` en el envoltorio y la limpieza por hora.
2. Los ayudantes de la pantalla (nombre de mesa, margen, posición de la mesa nueva).
3. Las pantallas heredadas, una por una, con `scripts/aspecto-permitido.json`.
