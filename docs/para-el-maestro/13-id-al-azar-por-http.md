# 13 · Un id al azar que también sirve por http (DP-11.0)

## Qué hace y por qué

`crypto.randomUUID` sólo existe en un contexto seguro: https o `localhost`. Servida por la IP de
una red local (la demo con teléfonos, o el servidor del negocio en la Fase C), la página no la
tiene y todo lo que la llamaba se caía: el teléfono de cocina no movía comandas, el editor de
botones del menú QR no agregaba uno y el carrito compartido del portal (fase B) no cargaba.

`idAlAzar()` usa `randomUUID` si está y, si no, arma un UUID v4 con `crypto.getRandomValues`, que
está en cualquier contexto y da el mismo azar criptográfico. `nuevaClave()` (idempotencia) la usa
y deja su respaldo con `Math.random`.

## Archivos

| Archivo                                                    | Qué                                       |
| ---------------------------------------------------------- | ----------------------------------------- |
| `apps/web/src/cliente/id-al-azar.ts`                       | La función                                |
| `apps/web/src/cliente/id-al-azar.test.ts`                  | Unidad y el contrato (nadie más la llama) |
| `apps/web/src/cliente/api.ts`, `heredado/api/cliente.ts`   | `nuevaClave()` la usa                     |
| `apps/web/src/telefono-de-cocina/pantalla-del-telefono.ts` | La clave de idempotencia del teléfono     |
| `apps/web/src/restaurante/menu-qr/EditorDeBotones.tsx`     | El id de un botón nuevo                   |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico. En el maestro importa en cuanto un negocio se sirva por http en su red local.

## Cómo portarlo

Copiar los dos archivos de `id-al-azar` y cambiar cada `crypto.randomUUID()` del navegador por
`idAlAzar()`; el contrato dice cuáles quedan. Del lado del servidor (Node) no hace falta.
