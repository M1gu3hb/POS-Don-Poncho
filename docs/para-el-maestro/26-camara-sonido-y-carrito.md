# 26 · La cámara del escáner, el sonido que no se queda mudo y el carrito que no pasa a la siguiente familia (DP-13.2)

## Qué hace y por qué

- **La cámara** (DP-D54): `Permissions-Policy` daba `camera=()` a todo y «Escanear QR» no podía
  funcionar. Ahora `camera=(self)` sólo en `/mesero` y `/pos`, `camera=()` en lo demás (el portal
  incluido), y la puerta de cabeceras en vivo lo exige. La cabecera es del DOCUMENTO: quien entra
  al mesero sin recargar (la mesera que abre `/caja` cae en `/mesero` así) seguía sin cámara; abrir
  el escáner en un documento cargado en otra ruta recarga una vez con `?escanear=1` y el escáner
  se abre solo. Sin cámara o sin permiso, se elige la mesa de una lista (antes, un campo numérico
  para un token alfanumérico). «Pedido del portal» en la pulsación larga de la mesa. La cámara se
  apaga siempre, también si se cierra mientras arranca.
- **El sonido** (DP-D53): se desbloquea con `pointerdown`/`touchstart`, `resume()` tiene tiempo
  límite, lo que llegó mudo suena con el primer toque, la voz que el navegador negó se reintenta
  después del timbre, y un aviso «Sonido apagado · toca para activar» lo dice.
- **El carrito** (DP-D55): liberar la mesa borra su carrito (lo de un comensal ya no le aparece a la
  siguiente familia); el carrito de una mesa sin cuenta caduca a las 3 h sin actividad, y abrir la
  mesa no lo revive. «Pedido listo para confirmar» se resuelve al vaciar o enviar por cualquier
  camino; agregar, quitar y enviar toman el candado del carrito.

## Archivos

| Archivo                                                                                                                                                                                            | Qué                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `apps/web/permisos-del-navegador.mjs`, `next.config.mjs`, `scripts/verificar-cabeceras.mjs`                                                                                                        | La política por ruta y su puerta |
| `apps/web/src/cliente/escaner-del-documento.ts`, `use-escaner-del-documento.ts`; `heredado/pages/{Mesero,POS}.jsx`                                                                                 | La cámara es del documento       |
| `apps/web/src/restaurante/portal-mesero/ElegirLaMesa.tsx`, `heredado/components/barcode/BarcodeScanner.jsx`                                                                                        | El respaldo sin cámara           |
| `apps/web/src/sonidos/gestor.ts`, `voz`, `AvisoDeSonidoBloqueado.tsx`, `ProveedorDeSonidos.tsx`; `heredado/lib/voiceAlert.js`                                                                      | El sonido                        |
| `packages/app/src/restaurante/carrito-del-salon.ts`, `portal/carrito.ts`, `portal/carrito-comandos.ts`, `portal/mesa.ts`                                                                           | Caducidad, candado y avisos      |
| Pruebas: `carrito-fantasma`, `aviso-del-pedido` (integración); `escaner-del-documento`, `permisos-del-navegador`, `gestor`, `bloqueo-del-sonido`; e2e `escanear-qr-con-camara`, `sonido-bloqueado` |                                  |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico.

## Cómo portarlo

1. `permisos-del-navegador.mjs` con su puerta, y `escaner-del-documento.ts` en las pantallas que
   escanean: sin lo segundo, la cámara sólo funciona tras recargar.
2. El gestor de sonido y su aviso, juntos.
3. `carrito-del-salon.ts` con la caducidad y el candado; las llamadas que vacían el carrito pasan
   el reloj (`ahora`) para resolver el aviso.
