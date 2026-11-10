# 38 · Las opciones cobran, la biblioteca de grupos y el peso en presentaciones (DP-16, parte 2.1)

Decisión DP-D104. **Una migración: la 192** (aditiva: dos columnas en `modificadores`, una en
`orden_linea_modificadores` y dos en `productos`, con sus `check`; nada existente cambia). Todo es
genérico de restaurante: el maestro tiene las mismas tablas de opciones (`modificadores`,
`modificador_opciones` con `delta_precio_centavos` firmado desde la 084, `producto_modificadores`,
`orden_linea_modificadores`) y la misma valoración de líneas.

## Qué hace y por qué

- **La migración 192** (`packages/data/src/migraciones/sql/192_opciones_con_precio_y_menu.sql`):
  `modificadores.minimo_elecciones` y `maximo_elecciones` (`smallint`, nulos = sin límite, mínimo ≤
  máximo), `orden_linea_modificadores.delta_precio_centavos` (`bigint`, firmado, 0 por omisión),
  `productos.solo_presets_variable` (`boolean`, falso por omisión) y `productos.fondo_tarjeta`
  (`text` ≤ 200, para el menú digital de la Parte 3). Tipos en `packages/data/src/esquema.ts` y el
  contrato en `scripts/esquema-esperado.json`.
- **El precio de la línea** (`packages/app/src/restaurante/precio-de-las-opciones.ts`):
  `precioConLasOpciones` suma las opciones por pieza, o una vez por renglón en lo que va por peso o por
  porción; nunca baja de cero. Lo usan el pedido del mesero (`pedido.ts`), para llevar
  (`para-llevar.ts`), el portal (`portal/pedido.ts`), el carrito de `/pos` (`venta/carrito.ts`, también
  al cambiar la cantidad) y el carrito compartido (`portal/precio-en-el-carrito.ts`).
- **Elegir y guardar** (`opciones-de-la-linea.ts`): el máximo y el mínimo de un grupo de varias se hacen
  cumplir (`OPCION_NO_VALIDA`, `OPCION_OBLIGATORIA`); la instantánea de la línea lleva el precio de cada
  opción; `orden_linea_modificadores` guarda el firmado (`delta_precio_centavos`) y lo positivo en
  `precio_extra_centavos`.
- **Dividir** (`division-partir-linea.ts`): la parte nueva copia sus opciones (antes fallaba con
  `22P02` al insertar la instantánea).
- **La biblioteca de grupos** (`packages/app/src/catalogo/grupos-de-opciones.ts` y
  `grupos-de-opciones-lectura.ts`): `catalogo.guardar_grupo_de_opciones`,
  `catalogo.asignar_grupos_de_opciones` y `catalogo.grupos_de_opciones` (dueño, administrador,
  gerente). `modificadores-guardar.ts` ya no borra las opciones de un grupo que usa otro producto.
- **«Sólo presentaciones»** (`venta/valorar.ts`, `exigirPresentacion`): una cantidad que no es una de
  las presentaciones se rechaza con `CANTIDAD_INVALIDA`.
- **Dónde se ve:** el ticket de `/pos` (`venta/consultas.ts`), el puente (`DetalleVenta.opciones_snapshot`
  y `ProductoTerminado.solo_presets_variable`), el menú público del portal
  (`portal/opciones-publicas.ts`: precio de cada opción sólo con los precios a la vista, mínimo y
  máximo; `solo_presets_variable` en la lista blanca), y el corte
  (`caja/corte/opciones-vendidas.ts` → «Opciones vendidas · cuánto sumaron»).
- **La pantalla** (`apps/web`): el diálogo de opciones del mesero y de la Caja
  (`SeleccionModificadoresDialog.jsx`), la cantidad por peso (`CantidadVariableDialog.jsx`), el portal
  (`ProductoQRDialog.jsx` con `src/portal/eleccion-de-opciones.ts`), la precuenta y el ticket
  (`PreCuentaTicket.jsx` con `src/venta/opciones-del-renglon.ts`), Productos
  (`TipoVentaSection.jsx`, `ProductoSimpleDialog.jsx` y el editor de grupos en
  `src/catalogo/opciones/`) y el corte (`src/corte/opciones-vendidas.ts`).

## Pruebas

- Integración: `restaurante/opciones-con-precio.integracion.test.ts` (única con precio; múltiple y dos
  grupos; el máximo; barbacoa ½ kg por renglón para llevar con nota larga; dividir con opciones; «sólo
  presentaciones»; el corte cuadra y «Opciones vendidas» dice veces e importe) y
  `catalogo/grupos-de-opciones.integracion.test.ts` (la biblioteca, el orden, el portal cobra lo mismo,
  el editor viejo no vacía un grupo compartido).
- Unidad: `precio-de-las-opciones.test.ts` (servidor y pantalla), `opciones-de-la-linea.test.ts`,
  `opciones-publicas.test.ts`, `portal.proyeccion.test.ts`, `eleccion-de-opciones.test.ts`,
  `opciones-del-renglon.test.ts`, `corte/opciones-vendidas.test.ts`.

## Para llevarlo al maestro

1. Aplicar la 192 con su `pnpm db:migrate` (aditiva; las líneas viejas quedan con `delta` 0 y su precio
   de siempre).
2. Copiar los módulos y las rutas `apps/web/app/api/catalogo/{guardar-grupo-de-opciones,
asignar-grupos-de-opciones,grupos-de-opciones}` y regenerar la matriz de permisos y el aislamiento.
3. En un giro donde la opción no debe cobrar, basta con dejar sus precios en cero: todo lo demás se
   comporta como antes.
