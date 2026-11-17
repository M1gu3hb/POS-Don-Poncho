# 40 · El teléfono opcional del pedido para llevar (DP-22, DP-D157)

**Una migración: la 194** (aditiva: una columna nullable en `ordenes` y su `check`; ninguna fila
existente cambia). Genérica de cualquier negocio con pedidos para llevar: el maestro tiene la misma
tabla `ordenes` y `nombre_pedido` (la 081).

## Qué hace y por qué

La cajera teclea, junto al nombre del pedido para llevar, el teléfono del cliente (opcional) para
llamarle cuando el pedido está listo. Es una etiqueta efímera de la orden, igual que `nombre_pedido`:
no es el teléfono de un cliente identificado y no entra al padrón (la razón de la 081).

- **La migración 194** (`packages/data/src/migraciones/sql/194_telefono_del_pedido_para_llevar.sql`):
  `ordenes.telefono_pedido text` y el `check` `ordenes_telefono_pedido_valido` (nulo, o sólo dígitos,
  espacios, guiones y un «+» al inicio; hasta 20 caracteres y de 7 a 15 dígitos). Tipos en
  `packages/data/src/esquema.ts`; contrato en `scripts/esquema-esperado.json`.
- **La regla** (`packages/domain/src/venta/telefono-del-pedido.ts`): una sola definición para el
  servidor (`restaurante.armar_para_llevar` la aplica a lo que llega y limpia el texto) y la pantalla
  (avisa antes de enviar). El `check` es la última red.
- **Dónde se ve:** `restaurante.para_llevar_del_dia` devuelve `telefono` y la lista de «Para llevar»
  de la Caja lo pinta. **No sale** en el ticket (`venta.ticket`), la cocina ni el puente de datos.
- **Cada armado sella nombre y teléfono** y descartar el pedido los borra: no se arrastran al
  pedido siguiente.

## Cómo se aplica

`pnpm --filter @morphiqpos/data migrate` (o el ejecutor de migraciones del despliegue): la 194 es
aditiva y no necesita respaldo especial ni ventana de mantenimiento.

## Cómo se probó

- Integración contra Postgres: `restaurante/telefono-para-llevar.integracion.test.ts` (14 casos: con y
  sin teléfono, vacío, siete teléfonos inválidos rechazados por el servidor, el `check` de la base
  escrito a mano, rearmar y descartar sin arrastrar, y el ticket sin el teléfono).
- Unitarias: `domain/venta/telefono-del-pedido.test.ts` y
  `apps/web/src/restaurante/para-llevar/telefono-del-pedido.test.ts`.
- Mutantes a mano: sin sellar el teléfono, sin la validación, sin borrarlo al descartar, sin
  mostrarlo en la lista, sin vaciarlo del borrador; todos muertos.

## Para llevarlo al maestro

1. Copiar la 194 con su número siguiente.
2. Llevar `telefono-del-pedido.ts` del dominio y los cambios de `para-llevar.ts` y
   `para-llevar-del-dia.ts`.
3. No hay que tocar RLS ni permisos: son de la tabla.
