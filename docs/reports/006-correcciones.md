# 006 · DP-12 · Correcciones y funcionamiento final

Fecha: 01-11-2026 (hora de CDMX). Sesión local de Claude Code en la laptop de Miguel, en el
worktree `.claude/worktrees/dp12`, rama `dp-12` (de `main` @ `4b00f9e`). Sin secretos ni PIN: los
accesos viven en `..\_PRIVADO\`. Etapa: corregir, no agregar; el diseño de DP-11.4 (`dp-11`) no se
tocó.

## 1 · Por punto

### DP-12.1 · Datos de prueba fuera y mantenimiento sólo para plataforma (DP-D44) — hecho

- La marca de plataforma vive en `configuracion.valores.plataforma` (decisión de Miguel) y la exige
  el servidor en los cinco comandos que borran en masa; la pantalla sólo esconde los botones.
- En producción: la marca de «Miguel · Morphiq», la cuenta de prueba de la Mesa 1 cancelada y la
  venta purgada. Detalle y huellas en la sección 2.
- Pruebas: `plataforma.integracion.test.ts` (3) y unidad; mutaciones 6 de 6.

### DP-12.2 · Los comensales arman, el mesero confirma (DP-D45) — hecho

- «Quién manda a cocina» (por omisión, sólo el mesero) y «Los comensales pueden abrir su mesa»
  (apagada), en Portal QR → Configuración, exigidas en el servidor.
- El carrito se arma con la mesa cerrada; «Llamar a mi mesero para confirmar» deja el aviso
  «Pedido listo para confirmar (N platillos)».
- El portal en modo mesero: «Escanear QR», el aviso o la mesa abierta; cambiar, quitar, borrar,
  abrir la mesa y enviar a su nombre. Mantener presionada una mesa: «Ver mesa / Ver QR de la mesa».
- Arreglos del carrito (a–g): límite por teléfono, token validado antes de contar, latido cada
  30 s, precios según «Mostrar precios», id del teléfono fuera de la auditoría, tope 999, el
  diálogo que se reabría y «Sin conexión, reintentando».
- Pruebas: integración del portal y del carrito del mesero, unidad, mutaciones 20 de 20, navegador
  `portal-modo-mesero` (tacto real) y las vecinas, en tableta, teléfono y PC.

### DP-12.3 · Unir mesas (DP-D46) — hecho

- Las mesas no cambian al unir: tiemblan (contorno punteado con movimiento reducido), siguen al dedo
  1:1, la vecina se inclina y al soltar se funden en su forma (cápsula horizontal o vertical,
  rectángulo, cuadrado), también en el mapa.
- Con gente: «La Mesa N tiene gente y un pedido de $X. ¿Unir de todos modos?»; las alergias y la
  celebración llegan a la que queda. En limpieza: «márcala libre primero». «Separar mesas» desde el
  globo de la mesa, también para uniones libres. Ninguna unión se queda varada (editor y «vaciar el
  mapa»); `?unir=` se limpia.
- Pruebas: `union-con-gente` (5), dominio (7), pantalla; mutaciones 16 de 16; navegador
  `unir-mesas-al-tacto` (distancia dedo–mesa cuadro por cuadro, < 2 px) en tableta 1280 × 800,
  teléfono y PC, y las vecinas.

### DP-12.4 · El mesero cancela con motivo, y el corte lo dice (DP-D48) — hecho

- El mesero quita un platillo y cancela una cuenta desde su mesa, con motivo obligatorio y su
  nombre; cocina y almacén siguen fuera. Si la cocina ya preparó algo, se avisa que es pérdida.
- Una sola lectura del servidor para el corte (el de Cierre del día y el heredado de Caja) y para
  Registros → «Cancelaciones»: quién canceló (no quien atendía), cuándo, por qué, cuánto y la mesa.
  Lo que ya estaba listo o entregado sale aparte como PÉRDIDA, resaltado y con total, sin contarse
  dos veces.
- Pruebas: integración (16, partida en dos archivos), unidad y contrato; mutaciones 28 de 28;
  navegador `cancelacion-del-mesero` en tableta, teléfono y PC. Hecho por un subagente (Sonnet, en
  su worktree) e integrado aquí.

### DP-12.5 · Estaciones de punta a punta (DP-D47) — hecho

- Verificado con cuatro estaciones nuevas creadas en Configuración (una renombrada y otra
  desactivada) más las de la demo: un pedido del mesero sale en 5 comandas, una por estación; cada
  Cocina ve y anuncia (voz) sólo lo suyo; cada estación conecta sólo su teléfono, que ve lo suyo;
  el pedido del portal también se parte. El reparto ya era genérico.
- Arreglado: desactivar una estación se tragaba el error al mover sus categorías a la general.
- **Por platillo no se asigna:** el modelo toma la estación de la categoría; no se agregó la
  columna (sería DDL).

### DP-12.6 · Las pantallas (DP-D49) — hecho, con un pendiente

- **Menú QR:** la marca del precio tapa el impreso de 320 a 430 px; «Atención» a la izquierda.
- **Teléfono:** el encabezado de Cocina ya no se encima; el botón redondo del menú no tapa
  contenido; las pestañas de Solicitudes caben.
- **Ventas:** sin receta, «—, sin receta» (no 100 %), también en tablero, gráfica, Registros, PDF y
  CSV; sin la pastilla vacía; el encabezado dice qué cuenta.
- **Nombre de mesa** sin repetirse en nueve pantallas.
- **Un solo sistema de sonido:** sale «Activar sonidos»; el timbre de Cocina, el aviso del mesero
  y el pedido listo por el gestor, con la voz después del sonido.
- **La limpieza de solicitudes** automática, a lo mucho una vez por hora por negocio, sin escribir
  nada cuando no toca.
- **Pendiente para Miguel:** el Cierre del día, el corte y las pantallas de Caja todavía cuentan
  costo cero como 100 % de margen (el corte necesita contar en el servidor las ventas sin costo).
- **6 · Con 3 y con 25 mesas:** con 25 mesas en una zona, la 21 nacía encima de otra (a cada mesa
  puesta se le reservaba la caja más grande y tapaba la casilla de al lado). Arreglado: cada mesa
  reserva su medida; con la rejilla llena, baja de fila. Prueba de navegador con 3 y con 25
  (quitar y crear, QR nuevos, sin encimarse, mapa o rejilla, portal, unir y separar).

### DP-12.7 · Rendimiento de abrir una mesa — no se rescata (anotado)

- La mejora de `dp-11` (`5ba89ea`: teselas memoizadas, catálogo en dos tiempos, borrador fuera de
  `Mesero`) viene fundida con el rediseño de Mesero (componentes nuevos, `Mesero.jsx` −734 líneas).
  Separarla obliga a rehacer el estado del carrito en la `Mesero.jsx` actual: no es separable sin
  el diseño. Queda para cuando entre DP-11.4.

### DP-12.8 · Reauditoría — hecha en local; la de producción con PIN la hace Miguel

- **Todas las pantallas:** un recorrido (temporal, no se sube) entró con cada puesto —dueño,
  gerente, cajero, mesero y cocina— a TODAS las pantallas de su menú, en tableta y teléfono:
  31 visitas por aparato, cero errores de consola, cero excepciones, cero respuestas rotas de la
  API y cero desbordes a lo ancho.
- **Los flujos:** la mesa con dos comensales (`pedido-compartido`, `portal-modo-mesero`), la
  cocina por estación (`estaciones-de-punta-a-punta`), unir y separar (`unir-mesas-al-tacto`,
  `unir-mesas-en-el-mapa`, `restaurante-operaciones` 6, 6b, 6c y D-2 a D-7) y cancelar
  (`cancelacion-del-mesero`), en verde.
- **Lo que encontró y se arregló aquí:** entrar a «Unir mesas» desde la mesa abierta no abría el
  plano (se decidía con la lista vacía previa a la primera lectura) y el aviso con gente nombraba
  la mesa propia; el portal en blanco de la prueba de 25 mesas era la demo con el portal apagado.
- **Sin PIN de producción:** los PIN reales los teclea Miguel; la sección 3 es su recorrido.

## 2 · Lo que se escribió en producción y las huellas

- **20:43:27–20:43:36 UTC (DP-12.1):** marca de «Miguel · Morphiq»; la cuenta de prueba de la
  Mesa 1 cancelada con «Prueba» y la mesa libre; `purgar_ventas` sin revertir inventario (1 orden,
  1 línea, 1 comanda, 1 renglón de comanda). Exportaciones antes y después: sólo cambian
  `auditoria` +3, `comandos_ejecutados` +3, `configuracion`, `eventos_mesa` +1, `mesas` (la 1,
  libre) y lo purgado. Huella de los otros 10 negocios IDÉNTICA.

## 3 · Qué tiene que probar Miguel

Con la tableta de la sala, un teléfono propio (de comensal) y la PC de la caja, en
`pos-don-poncho.vercel.app`, con los PIN de `..\_PRIVADO\`. Sin cobrar nada real: al final se
cancela con motivo «Prueba».

1. **Plataforma (PC, con tu usuario):** Configuración → Mantenimiento sí aparece. Con el PIN del
   dueño de Don Poncho NO aparece, y en Ventas no está «Eliminar todas».
2. **Portal QR → Configuración (PC):** «Pedidos desde el portal» dice «Sólo el mesero confirma y
   envía». Déjalo así.
3. **El comensal arma (teléfono):** escanea el QR de una mesa CERRADA, agrega dos platillos. El
   botón dice «Llamar a mi mesero para confirmar»; tócalo. Debe decir que el pedido está guardado.
4. **El mesero confirma (tableta):** aparece el aviso «Pedido listo para confirmar (2 platillos)»
   en la mesa. Tócalo: se abre el pedido del portal. Cambia una cantidad con ±, quita uno, pon las
   personas y «Abrir la mesa», luego «Confirmar y enviar a cocina». Cocina lo recibe.
5. **Mantener presionada una mesa (tableta):** sale «Ver mesa / Ver QR de la mesa». «Ver QR de la
   mesa» pone el QR grande; escanéalo con el teléfono: abre el pedido de esa mesa.
6. **«Escanear QR» (tableta, junto a «Unir mesas»; sale con el Portal QR encendido):** con la cámara, el QR de otra mesa abre su
   pedido del portal en modo mesero.
7. **Unir mesas (tableta):** «Unir mesas». Las mesas NO cambian, tiemblan. Arrastra una con el dedo
   hacia otra: sigue al dedo sin brincar, la otra se inclina y al soltar se ven fundidas (dos
   redondas lado a lado: una cápsula). Si una tiene gente: «La Mesa N tiene gente y un pedido de
   $X. ¿Unir de todos modos?». Une. Luego mantén presionada la mesa unida → «Separar mesas»: cada
   una vuelve a su lugar.
8. **Cancelar (tableta, como mesero):** en una mesa con algo enviado, «Quitar un platillo» con su
   motivo y luego «Cancelar la cuenta» con «Prueba». En la PC: Registros → «Cancelaciones» dice tu
   nombre, el motivo y si fue pérdida; el corte del día lo dice aparte.
9. **Estaciones (PC y tableta de cocina):** crea tus estaciones en Configuración → Negocio →
   «Estaciones de preparación», asígnalas a sus categorías y a un usuario de cocina cada una. Un
   pedido con platillos de varias estaciones sale en una comanda por estación, y cada pantalla de
   Cocina ve y dice sólo lo suyo.
10. **Pantallas (teléfono):** Cocina sin el encabezado encimado; el botón redondo del menú no tapa
    nada al final de Recetas; Portal QR → Solicitudes con las pestañas en renglones; en el menú QR
    los precios tapan el impreso y «Atención» está a la izquierda.
11. **Ventas (PC):** una venta sin receta dice «—, sin receta», no 100 %. (El Cierre del día y el
    corte todavía no: pendiente.)
12. **Sonido (tableta de cocina):** ya no hay «Activar sonidos»; el primer toque en la pantalla
    habilita el sonido, y al llegar una comanda suena y luego habla.

Si algo no se ve así, una captura y en qué aparato.

## 4 · Commits

| Commit | Qué | Autor |
| --- | --- | --- |
| `23baf5b` | DP-12.1: los botones que borran en masa, sólo para plataforma | `M1gu3hb` |
| `22b0322` | DP-12.2 y DP-12.3 | `M1gu3hb` |
| `df8827d` | DP-12.6: con 25 mesas ninguna nace encima de otra | `M1gu3hb` |
| `aae53d4` | DP-12: para retomar, y el borrador del reporte 006 | `M1gu3hb` |
| `1be9a6d` | DP-12.5: las estaciones de punta a punta | `M1gu3hb` |
| `363f702` | DP-12.4: el mesero cancela con motivo, y el corte lo dice | `M1gu3hb` |
| `143750a` | DP-12.6: las pantallas, un solo sonido y la limpieza por hora | `M1gu3hb` |
| `0e1a8ef` | DP-12: las puertas del sistema de diseño sobre 12.2 y 12.3 | `M1gu3hb` |
| `a1057e0` | DP-12.3: entrar a unir desde la mesa abierta espera la lectura | `M1gu3hb` |
| `6ba7239` | DP-12: la galería declara los retratos que cambian a propósito | `M1gu3hb` |
| `2ddd476` | DP-12.3: el aviso con gente no nombra la mesa propia | `M1gu3hb` |

Todos `M1gu3hb <118588634+M1gu3hb@users.noreply.github.com>`, sin coautoría.
