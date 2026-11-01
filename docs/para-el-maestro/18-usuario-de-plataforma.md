# 18 · El usuario de plataforma (DP-12.1)

## Qué hace y por qué

Miguel: «Limpiar ventas de prueba y Eliminar todas sólo los veo yo, nunca el dueño ni el gerente».

- Los cinco comandos de mantenimiento que borran en masa exigen, además del rol, que quien llama
  sea de plataforma: su empleo está en `configuracion.valores.plataforma.empleos`. Si no, 403
  `SIN_PERMISO`.
- La marca no se lee ni se escribe por el camino genérico de Configuración. La pone
  `mantenimiento.marcar_plataforma` (marca a quien lo ejecuta, sin ruta HTTP) desde
  `scripts/marcar-plataforma.mjs`.
- La sesión dice `es_plataforma`; las pantallas esconden los botones a los demás.
- De paso, `reiniciar_todo` ya corre contra una base real (acotado por padre y sin `returning id`).

## Archivos

| Archivo                                                                                      | Qué                                      |
| -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `packages/app/src/mantenimiento/plataforma.ts` (+test, +integración)                         | La marca, la guarda y el comando         |
| `packages/app/src/mantenimiento/comandos.ts`, `purgas.ts`                                    | La guarda en los cinco; `purgarCatalogo` |
| `packages/app/src/puente/configuracion.ts`                                                   | `plataforma` en `NUNCA_SALEN`            |
| `apps/web/app/api/auth/entrar/route.ts`, `api/catalogo/sesion/route.ts`                      | `es_plataforma` en la sesión             |
| `apps/web/heredado/lib/permissions.js`                                                       | `esUsuarioDePlataforma`                  |
| `Ventas.jsx`, `Configuracion.jsx`, `LimpiarSeccionButton.jsx`, `ReiniciarSistemaSection.jsx` | Los botones                              |
| `scripts/marcar-plataforma.mjs`, `scripts/limpiar-ventas-de-prueba.mjs`                      | Los guiones                              |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico: en el maestro, cada negocio marca a su usuario de plataforma con el guion. De Don Poncho
es sólo el dato (el empleo de «Miguel · Morphiq»).

## Cómo portarlo

1. Copiar `plataforma.ts` y sus pruebas; la guarda en los cinco comandos; `purgarCatalogo`.
2. `plataforma` en `NUNCA_SALEN`; `es_plataforma` en las dos rutas de sesión; los botones.
3. Correr el guion para cada negocio antes de publicar (sin la marca, nadie limpia).
