# 21 · Las estaciones de punta a punta (DP-12.5)

## Qué hace y por qué

Don Poncho tendrá varias estaciones de preparación, todavía sin nombre. Se verificó con más de
dos, de Configuración a la cocina:

- Crear, renombrar y desactivar en Configuración → Negocio → «Estaciones de preparación». Al
  desactivar, sus categorías pasan a la general; si una no se puede mover, la estación no se apaga
  y se dice por qué (antes el error se tragaba).
- Asignar por categoría (por platillo no: el modelo la toma de la categoría).
- Un cocinero por estación: su Cocina ve y anuncia sólo lo suyo; la dueña ve todo.
- El teléfono de cocina se conecta por estación y ve lo suyo.
- El pedido del mesero y el del comensal (portal) salen en una comanda por estación.

## Archivos

| Archivo                                                                                  | Qué                              |
| ---------------------------------------------------------------------------------------- | -------------------------------- |
| `apps/web/heredado/components/configuracion/EstacionesPreparacionSection.jsx`            | Desactivar sin tragarse el error |
| `apps/web/src/restaurante/estaciones-heredado.contrato.test.ts`                          | El contrato                      |
| `pruebas/e2e/estaciones-de-punta-a-punta.spec.ts`, `pruebas/e2e/ayudantes/estaciones.ts` | La prueba de punta a punta       |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico.

## Cómo portarlo

1. El cambio de `confirmarDesactivar` y su contrato.
2. La prueba de punta a punta, con las categorías y estaciones del negocio de prueba del maestro.
