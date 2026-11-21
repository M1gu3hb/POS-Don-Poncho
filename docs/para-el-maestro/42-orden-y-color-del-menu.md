# 42 · El orden, el color y las opciones del menú (DP-24 · Parte 3)

**Una migración: la 196** (aditiva: una columna nula en `productos` con su `check` y su índice, y el
`check` del color de `categorias` ampliado; ninguna fila existente cambia). Genérica de cualquier
negocio con categorías y platillos: el maestro tiene las mismas tablas.

## Qué hace y por qué

Hasta hoy el portal ordenaba los platillos por nombre y la rejilla del mesero y la de la Caja por lo
que devolviera la lectura: `productos` no tenía de dónde sacar un orden propio y el negocio no podía
ordenar su menú como su hoja de comanda de papel. Ahora hay **un solo orden** para el portal QR, la
rejilla del mesero, la de la Caja y el buscador: la categoría (`categorias.orden`), el lugar del
platillo dentro de ella (`productos.orden_en_categoria`) y, a igualdad, el nombre.

- **La migración 196** (`packages/data/src/migraciones/sql/196_orden_de_los_productos.sql`):
  `productos.orden_en_categoria integer` (nulo = «nadie lo ordenó»: va al final de su categoría, por
  nombre; mientras nadie ordene el menú se ve igual que antes), su `check` (≥ 0) y su índice; y
  `categorias_color_check` ampliado para aceptar, además del hex de siempre, una clave de la paleta
  (`cat-1` … `cat-16`). Tipos en `packages/data/src/esquema.ts`; contrato en
  `scripts/esquema-esperado.json`.
- **El orden único** (`packages/domain/src/catalogo/orden-del-menu.ts`): `ordenarMenu`,
  `ordenarCategorias`, `moverEnLaLista`, `mismoOrden`. Puros. Los usa el portal
  (`portal/consulta.ts`: lo que la base recorta y lo que sale), `heredado/pages/Mesero.jsx`,
  `heredado/components/pedido/CatalogoDelPedido.jsx` (la rejilla de la Caja) y `heredado/pages/POS.jsx`.
- **Seis comandos de catálogo** (todos para dueño, administrador y gerente; con auditoría; los que no
  cambian nada no dejan rastro: `SinNovedad`):
  `catalogo.ordenar_categorias`, `catalogo.ordenar_productos` (con el orden que la pantalla vio, para
  detectar a otra persona ordenando: `CONFIGURACION_CONFLICTO`), `catalogo.mostrar_en_menu`
  (`visible_en_menu_digital`), `catalogo.guardar_categoria` (nombre y color), `catalogo.unir_categorias`
  (la que sobra se APAGA, no se borra) y `catalogo.mover_a_categoria`. **Unir y mover se niegan si el
  platillo cambiaría de estación de preparación** (la estación sale de la categoría o, sin ella, de la
  general). Rutas en `apps/web/app/api/catalogo/`.
- **Configuración → Portal de comensales → «El orden del menú»** (`OrdenDelMenu.tsx`): ↑ ↓ de 44 px
  para secciones y platillos, «En el menú / Oculto» por platillo. Antes el orden de las secciones se
  guardaba por el puente, sin auditoría, en «Personalizar menú»; ahora sólo vive aquí.
- **Colores** (`packages/ui/src/estilos/categorias.css`, `packages/domain/src/catalogo/colores-de-categoria.ts`):
  16 tokens (franja, fondo y texto) en claro y en oscuro, con el contraste medido en CI
  (`packages/ui/src/tokens/categorias.test.ts`). Las pestañas de la rejilla llevan el color, un punto
  y SU NOMBRE; la tarjeta, una franja de 5 px; el selector de color está en «Categorías de productos».
- **El guion de datos** `scripts/ordenar-menu-produccion.mjs`: deja el menú como la hoja de papel por
  los comandos de arriba (idempotente, con `--ensayo`, se detiene sin escribir si algo no casa).

## Cómo se aplica

`pnpm --filter @morphiqpos/data migrate`: la 196 es aditiva y no necesita respaldo especial. Después
`node --conditions=react-server scripts/ordenar-menu-produccion.mjs --org <negocio> --persona "<dueño>"`
(primero con `--ensayo`).

## Cómo se probó

- Integración contra Postgres: `catalogo/orden-del-menu.integracion.test.ts` (15: el orden del portal
  y el de las pantallas coinciden, conflicto, permisos, auditoría, unir y mover sin cambiar estación) y
  `restaurante/opciones-de-la-hoja.integracion.test.ts` (7: «Prepárala» y «Preparación» en la
  biblioteca, el mesero y la Caja, el portal, la línea que lee la cocina y el ticket).
- Unitarias: `domain/catalogo/orden-del-menu.test.ts`, `colores-de-categoria.test.ts`,
  `ui/tokens/categorias.test.ts`, `scripts/lib/plan-del-menu.test.ts`, `app/puente/orden-en-categoria.test.ts`
  y `web/restaurante/rejilla/rejilla.contrato.test.ts`.
- Navegador, con dedo: `pruebas/e2e/orden-y-color-del-menu.spec.ts`.

## Para llevarlo al maestro

1. Copiar la 196 con su número siguiente.
2. Llevar `orden-del-menu.ts` y `colores-de-categoria.ts` del dominio, los dos archivos de comandos
   (`orden-del-menu.ts`, `categorias-del-menu.ts`) y sus seis rutas, el campo `orden_en_categoria` del mapa
   del puente y el orden de `portal/consulta.ts`.
3. Llevar `categorias.css`, `PestanasDeCategoria`/`colores.ts`/`SelectorDeColorDeCategoria` y el
   cambio de las tres rejillas. No hay que tocar RLS ni permisos: son de la tabla.
