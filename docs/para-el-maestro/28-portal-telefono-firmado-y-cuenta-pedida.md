# 28 · El portal del comensal: el teléfono firmado, el aviso del vaciado, abrir y enviar en una llamada y la cuenta pedida (DP-13.3)

## Qué hace y por qué

- **El id del teléfono (13.3.11):** lo emite el servidor, firmado (`portal/telefono.ts`); un id
  inventado no cuenta como teléfono y los comandos lo rechazan. Emitir tiene límite por mesa y por
  IP, y «conectados» un tope. Las personas al abrir la mesa las confirma el comensal.
- **El comensal se entera (13.3.12):** cuando el mesero vacía el carrito, el siguiente sondeo de
  cada teléfono dice «Tu mesero vació el pedido», una vez.
- **Abrir y enviar (13.3.13):** el comensal abre la mesa y manda su pedido en UNA llamada y una
  transacción; si el envío falla, no queda una mesa abierta sin pedido.
- **Cuenta pedida (13.3.15):** el comensal ve un mensaje claro; el mesero puede reabrirla (sin
  pagos) y mandar el pedido del portal, en la misma transacción.

## Archivos

| Archivo                                                                                                                                                                                 | Qué                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `packages/app/src/portal/telefono.ts`, `limite.ts`, `carrito.ts`, `carrito-http.ts`, `carrito-comandos.ts`, `carrito-llamar.ts`, `http.ts`, `quien-envia.ts`                            | El id firmado, límites y envío |
| `packages/app/src/restaurante/reabrir-la-cuenta.ts`, `carrito-del-mesero.ts`, `carrito-del-mesero-lectura.ts`                                                                           | Reabrir y la marca del vaciado |
| `packages/contracts/src/errores/index.ts`                                                                                                                                               | Cuatro códigos nuevos          |
| `apps/web/src/portal/carrito-compartido/*`, `apps/web/heredado/pages/PortalCliente.jsx`, `apps/web/src/restaurante/portal-mesero/CarritoDelPortalParaElMesero.tsx`                      | Las pantallas                  |
| Pruebas: `telefono-firmado`, `vaciado-del-mesero`, `abrir-y-enviar`, `cuenta-pedida`, `sondeo-http` (integración); `telefono`, `carrito-vaciado`, `reglas-http-dp13`; e2e `portal-dp13` |                                |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico.

## Cómo portarlo

1. `telefono.ts` y su uso en el sondeo y en cada comando del carrito, juntos: un cliente viejo que
   inventa su id recibe uno nuevo y reintenta.
2. Los cuatro códigos de error en `contracts` antes que las pantallas.
3. `reabrir-la-cuenta.ts` sólo detrás de `reabrirCuenta: true` en `restaurante.carrito_enviar`.
