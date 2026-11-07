# 32 · Cancelar una parte, la opción obligatoria en el servidor, cancelar sin la cocina, el margen y los menores (DP-14.6)

Decisiones DP-D66 a DP-D72. **Sin migración**; un DATO opcional en `motivos_merma` (abajo). Lo
hicieron tres agentes (Sonnet) en sus worktrees, cada uno con revisión adversarial; la sesión
principal lo revisó, lo integró y añadió lo que faltaba.

## Qué hace y por qué

- **Cancelar una parte de una cuenta dividida (DP-D66):** `restaurante/datos.ts`
  (`ordenParaCancelar`), `restaurante/parte-cancelada.ts` (la madre suma sus partes vivas; la mesa
  sigue, pasa a limpieza o queda libre), `cancelacion.ts`, `cancelar-con-permiso.ts` (la mesa de la
  parte es la de su madre). En el corte (`caja/corte/cancelaciones.ts`) la parte sale con la mesa de
  su madre. Genérico.
- **La opción obligatoria en el servidor (DP-D67):** `restaurante/opciones-de-la-linea.ts`, los
  códigos `OPCION_OBLIGATORIA` y `OPCION_NO_VALIDA` (`contracts/errores`), y las entradas
  `opciones` de `restaurante.enviar_pedido` y `venta.agregar_linea`; el portal en `portal/pedido.ts`.
  Guarda `orden_linea_modificadores` y `orden_lineas.opciones`. `/pos` abre el diálogo de opciones
  (`venta/opciones-en-pos.ts`). Genérico, con un efecto: el cobro aplica el sustituto y el factor de
  inventario de cada opción guardada.
- **Cancelar sin poder comprobar la cocina (DP-D68):** `restaurante.cancelar_orden` acepta
  `sinComprobarLaCocina`; exige la autorización de supervisor y deja `todoComoHecho` en la auditoría;
  `merma-por-cancelacion.ts` saca todo lo vivo y el corte lo cuenta como pérdida entera (lee la marca
  de la auditoría). En la pantalla, `permiso-al-cancelar.ts` (8 s) y `AjustesDeLaCuenta.tsx`
  («Reintentar», el PIN, y manda la marca). Genérico.
- **Reabrir con PIN (DP-D69):** `restaurante/reabrir-la-cuenta.ts`, `carrito-del-mesero.ts`.
- **El margen (DP-D70):** `caja/corte/costo-conocido.ts` (insumo en cero = receta incompleta),
  `consultas.ts` y `hoja.ts` («sin receta» y «receta incompleta» por separado), y las pantallas del
  margen y del Cierre del día. Genérico.
- **La merma no imputable (DP-D71):** `merma-por-cancelacion.ts` usa `por_cancelacion` si existe y
  `prueba_cocina` si no. **El dato, si el maestro lo quiere** (en una base propia; en la compartida
  ese catálogo es de todos):
  `insert into motivos_merma (clave, etiqueta, giro, imputable) values ('por_cancelacion', 'Por cancelación', 'restaurante', false) on conflict (clave) do nothing;`
- **Cuotas (DP-D72):** `http/limite.ts` (`LIMITES.supervisor`) y `portal/limite.ts` (teléfonos
  nuevos por mesa e IP).
- **Menores:** las cancelaciones del corte cuentan y suman en SQL y avisan «se muestran X de N»;
  el PDF del corte dice «—» sin dato y trae «Efectivo esperado»; el CSV de Registros deja Costo,
  Utilidad y Margen en blanco a quien no ve márgenes; un POST a una ruta de `/api` que no existe da
  404 (`apps/web/app/api/[...ruta]/route.ts`); el sonido no gasta el timbre hasta que el audio corre,
  su aviso va arriba y no se queda con el toque (`AvisoDeSonidoBloqueado.tsx`: no tapa los botones
  del encabezado), y su botón sale con el menú colapsado y en `/cocina-telefono`; el escáner no se cierra con un
  código que no es de mesa; la lista sin cámara dice zona y estado; «Nueva mesa» siempre trae una
  zona; «Marcar libre» en el Cierre del día; un carrito caducado avisa al comensal.

## Pruebas

Integración: `restaurante/cancelar-parte-dividida`, `cancelar-sin-comprobar-la-cocina`,
`opciones-obligatorias`, `union-avisos`, `mesa-sin-renglones`, `portal/reabrir-con-permiso`,
`caja/corte/insumo-sin-costo`, `cancelaciones-sin-tope`, y las ajustadas de la merma y el margen.
Navegador: `sala-dp14c-{cierre,mesero,telefono}`, `pos-opciones-obligatorias`,
`cancelar-con-la-cocina-detenida`, `sonido-dp14`, `api-ruta-inexistente`. Bancos de mutaciones de
los tres agentes y de la sesión principal, todos los mutantes muertos.

## Cómo portarlo

1. La opción obligatoria entera (servidor, `/pos` y el envío estructurado del mesero) junta.
2. Cancelar una parte antes que «sin la cocina» (la segunda usa el permiso de la primera).
3. El margen, las cuotas y los menores son independientes.
