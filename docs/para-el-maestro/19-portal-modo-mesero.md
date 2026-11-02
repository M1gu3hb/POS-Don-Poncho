# 19 · Los comensales arman, el mesero confirma: el portal en modo mesero (DP-12.2)

## Qué hace y por qué

Miguel y el orquestador: «En el portal va a pedir mucha gente a la vez y algo van a hacer mal. Que
el mesero sea quien manda a cocina».

- Los comensales arman el carrito de su mesa aunque esté cerrada; lo ven todos sus teléfonos y se
  conserva al abrir la mesa. Se olvida cuando la cuenta se cierra (cobrada, cancelada o la vacía
  que se libera) y al cerrar la última caja del día.
- «Quién manda a cocina» (Portal QR → Configuración): «Sólo el mesero confirma y envía» (por
  omisión) o «También los comensales»; y «Los comensales pueden abrir su mesa» (apagada).
- Con sólo el mesero, el comensal toca «Llamar a mi mesero para confirmar»: una solicitud `ordenar`
  con la nota «Pedido listo para confirmar (N platillos)», que el mesero ve como globo y en
  «Solicitudes», con su voz. El comensal lee «Tu pedido está guardado. Tu mesero lo confirma y lo
  manda a cocina».
- El mesero abre el portal de la mesa en modo mesero (escaneando el QR desde «Mesas y pedidos»,
  tocando el aviso o desde la mesa abierta): cambia cantidades, quita cualquier línea, borra el
  pedido, abre la mesa y lo confirma y lo envía a su nombre.
- Mantener presionada una mesa del mapa (o clic derecho) abre «Ver mesa / Ver QR de la mesa».
- El carrito sigue a la cuenta al unir y al cambiar de mesa. Arreglos: límite por teléfono, token
  validado antes de contar, latido cada 30 s, precios según «Mostrar precios», el id del teléfono
  fuera de la auditoría, cantidad tope 999, el diálogo que se reabría solo y «Sin conexión».

## Archivos

| Archivo | Qué |
| --- | --- |
| `packages/app/src/portal/quien-envia.ts` (+test) | Quién manda a cocina y qué le toca al comensal |
| `packages/app/src/portal/banderas.ts`, `puente/configuracion.ts` | Las dos opciones, leídas y validadas |
| `packages/app/src/portal/carrito.ts`, `carrito-comandos.ts`, `carrito-http.ts` | Sin cuenta, el envío según la regla, el límite por teléfono, el latido |
| `packages/app/src/portal/carrito-llamar.ts` | `portal.carrito_llamar_mesero` |
| `packages/app/src/portal/mesa.ts` | `abrirLaMesaDelPortal`, compartida |
| `packages/app/src/negocio/despliegue.ts` | El token se busca siempre antes de contar |
| `packages/app/src/restaurante/carrito-del-salon.ts` | Olvidar el carrito (cuenta cerrada, fin del día) y moverlo |
| `packages/app/src/restaurante/carrito-del-mesero*.ts` | Los cuatro comandos y las lecturas del mesero |
| `packages/app/src/restaurante/pedido.ts` | `comandarLasLineas`, el cuerpo de `enviar_pedido` |
| `packages/app/src/restaurante/mesas-escrituras.ts`, `sala-escrituras.ts`, `caja/sesion.ts` | Dónde se olvida y se mueve el carrito |
| `apps/web/app/api/restaurante/carrito-*`, `qr-de-la-mesa`, `api/publico/qr/[token]/carrito/llamar` | Las rutas |
| `apps/web/src/portal/carrito-compartido/*` | El teléfono: el botón según la regla, «Sin conexión» |
| `apps/web/src/restaurante/portal-mesero/*` | El modo mesero, el QR escaneado, la pulsación larga, el QR en pantalla |
| `apps/web/heredado/pages/Mesero.jsx`, `PortalCliente.jsx`, `ConfiguracionQRTab.jsx` | Las pantallas reales |
| Pruebas: `carrito-sin-cuenta`, `carrito-doce-telefonos`, `carrito-del-mesero` (integración), `pruebas/e2e/portal-modo-mesero.spec.ts` | |

## Migraciones

Ninguna (la 186 y la 187 ya están).

## Genérico o de Don Poncho

Genérico. Lo de Don Poncho es la opción elegida.

## Cómo portarlo

1. Copiar `quien-envia.ts`, `carrito-llamar.ts`, `carrito-del-salon.ts` y `carrito-del-mesero*.ts`
   con sus pruebas; aplicar los cambios de `carrito*.ts`, `banderas.ts`, `configuracion.ts`,
   `despliegue.ts`, `pedido.ts`, `mesa.ts` y los tres ganchos (cancelar, cobrar, caja).
2. Las rutas, `apps/web/src/restaurante/portal-mesero/` y los cambios del teléfono.
3. En las pantallas heredadas: «Escanear QR», la pulsación larga (`data-mesa-id`), el carrito en la
   mesa abierta y la sección «Pedidos desde el portal». Regenerar la matriz y el aislamiento.
