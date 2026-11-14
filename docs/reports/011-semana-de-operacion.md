# 011 · DP-18 · Una semana de operación simulada

- **Fecha:** 11-11-2026 en la noche → 14-11-2026, hora de CDMX.
- **Dónde:** sesión local de Claude Code en la laptop de Miguel. Un PR por parte:
  `dp-18-1` ([#24](https://github.com/M1gu3hb/POS-Don-Poncho/pull/24), lo que encontró Miguel),
  `dp-18-lunes` ([#26](https://github.com/M1gu3hb/POS-Don-Poncho/pull/26), los arreglos para el lunes),
  `dp-18-2` ([#25](https://github.com/M1gu3hb/POS-Don-Poncho/pull/25), el simulador) y `dp-18-4`
  ([#27](https://github.com/M1gu3hb/POS-Don-Poncho/pull/27), lo que dejó la semana y este reporte).
- **Producción no se usó para probar.** Los bots corrieron contra una copia de la base propia en
  Postgres local (`qa_dp18_*`, puerto 5460) con la app construida igual que producción (`next start`).
  El candado del simulador aborta si la URL o la base son de producción. En producción sólo se leyó,
  por la conexión de sesión, en transacciones de sólo lectura.
- **Sin secretos ni PIN en este documento** (los PIN de la copia son de prueba y viven fuera del repo).

## 0 · Lo que necesita Miguel

1. **Decidir el lunes** con el estado de §1 (la recomendación está ahí).
2. **En producción, una vez:** Inventario o Compras → «Crear el almacén principal» (A4). Sin almacén no
   se registran compras.
3. **Decidir A18:** la sesión dura 8 h y la jornada de Don Poncho 11 h (8:00–19:00): a las 16:00 cada
   puesto vuelve a teclear su PIN. Propuesta: 12 h.
4. **Elegir la dirección del menú digital (Parte 5): A, B o C.**
5. **`dejar-en-ceros.mjs`** sólo cuando lo pida, el domingo en la noche (primero `--ensayo`).

## 1 · Veredicto

**Se puede entregar el lunes 16. Calificación: 86 / 100.**

- **Lo que estorbaba para operar el lunes** (A1–A4, A12, A15–A17) está en producción desde el 13-11
  (#26). **Lo que la semana encontró** y toca dinero o cobro (A7, A9, A19) y los reportes del dueño
  (A21, A22, A25) va en #27, que se validó repitiendo un día completo.
- **El dinero cuadró al centavo toda la semana:** ningún crítico fue de la app, y con el árbitro
  corregido cada cobro y cada corte de los siete días coincide con el libro.
- **La repetición del día 1 con #27:** 0 críticos, cajas e inventario al centavo y al gramo (1,725
  comparaciones, 0 diferencias), el dueño cuadra (216 comparaciones) y el día cierra solo antes del
  tope, sin una sola cuenta dividida a medias (A9 arreglado). Lo único «alto» que queda es el
  invariante I06, que es informativo por definición: la carne quedó en negativo porque el simulador
  vende ~55 kg al día y compra 8 (DP-D116 permite ese negativo para que el conteo lo enseñe).
- **Por qué 86 y no más:** quedan pendientes medianos que no estorban el lunes pero sí la primera
  semana (A5, A23, A24, y decidir A18); el simulador cubre lo que los bots saben hacer, no todo lo que
  una persona puede tocar; los días normales sentaron 112–119 cuentas de mesa, poco abajo de las 120
  del encargo; y el arreglo de Registros (A21) es reciente, validado con un día y una sonda.

## 2 · La semana, día por día

Siete días seguidos de 8:00 a 19:00 en la copia, con el reloj de QA movido sólo en la laptop
(viernes 20 a jueves 26 de noviembre de 2026). Los totales son del libro de los bots (cobros con
propina); «cuadró» es lo que el árbitro comparó contra la base al centavo.

| Día | Perfil | Cobros (mesa / llevar) | Total | Cuentas de mesa | Platillos | Críticos · altos | Cajas |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| 1 | normal | 207 (128 / 79) | $145,508.00 | 119 | 1,318 | 9 · 5 | al centavo salvo 3 propinas del guion |
| 2 | pico de sábado | 258 (141 / 117) | $155,145.92 | 134 | 1,491 | 229 · 36 | al centavo salvo 3 cuentas del guion |
| 3 | red mala | 155 (116 / 39) | $163,412.51 | 112 | 1,382 | 0 · 10 | al centavo |
| 4 | configuración en vivo | 160 (123 / 37) | $141,720.28 | 113 | 1,240 | 6 · 14 | al centavo salvo $2 del guion |
| 5 | tranquilo | 99 (66 / 33) | $87,344.77 | 67 | 853 | 0 · 8 | al centavo |
| 6 | pico con traslado | 180 (123 / 57) | $142,782.26 | 122 | 1,368 | 0 · 9 | al centavo |
| 7 | pico final | 206 (150 / 56) | $180,716.96 | 149 | 1,648 | 0 · 7 | al centavo |

- **Ningún crítico de la semana fue de la app.** Los 244 críticos son del simulador (el árbitro del día 2
  buscó los 207 cobros del día 1 en la ventana del día 2; uniones que dejó el cierre forzado; un
  descuento de un intento fallido; un precio en vivo que el bot no tomó; propinas del guion el día 1).
  Cada uno está explicado en `docs/qa/semana/` y en §4.
- **Volumen contra los mínimos del encargo** (por día normal; el 5 es «tranquilo» a propósito):

  | Mínimo | D1 | D2 | D3 | D4 | D5 | D6 | D7 |
  | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
  | cuentas de mesa ≥120 | 119 | 134 | 112 | 113 | 67 | 122 | 149 |
  | para llevar ≥25 | 79 | 117 | 39 | 37 | 33 | 57 | 56 |
  | platillos ≥700 | 1,318 | 1,491 | 1,382 | 1,240 | 853 | 1,368 | 1,648 |
  | pedidos del portal ≥60 | 124 | 134 | 122 | 106 | 73 | 115 | 123 |
  | divisiones ≥10 | 10 | 10 | 7 | 18 | 3 | 10 | 9 |
  | uniones ≥10 | 3 | 10 | 11 | 11 | 9 | 6 | 12 |
  | cambios de mesa ≥10 | 24 | 6 | 26 | 15 | 16 | 5 | 9 |
  | cancelaciones ≥15 | 7 | 18 | 19 | 15 | 14 | 11 | 20 |
  | descuentos ≥20 | 32 | 35 | 33 | 16 | 21 | 43 | 31 |
  | retiros ≥8 | 7 | 9 | 9 | 9 | 9 | 9 | 9 |
  | gastos ≥3 · compras ≥2 · mermas ≥3 | 2·3·2 | 3·3·4 | 3·3·4 | 3·3·4 | 3·3·4 | 3·3·3 | 3·3·3 |

  En los días normales las cuentas de mesa quedaron en 112–119, cerca de 120: con 20 mesas y estancias
  de 35 a 95 minutos, los meseros del simulador no sientan más. Las 20 mesas llenas en cada pico.
- **Lo que siempre cuadró:** cada cobro (total, descuento, propina, método por método, cambio) y cada
  corte de caja contra el libro, al centavo, todos los días desde que el árbitro compara el día.

## 3 · Lo que encontró de la app

| # | Qué | Gravedad | Estado |
| --- | --- | --- | --- |
| A1 | Asignar estación a una categoría daba 422 | alto | producción (#26) |
| A2 | Crear un producto «por porción» daba 500 | alto | producción (#26) |
| A3 | Por peso y por porción no bajaban su ingrediente base | alto | producción (#26) |
| A4 | Ninguna pantalla creaba el almacén (compras con 422) | alto | producción (#26) |
| A5 | El de almacén no puede registrar compras desde Inventario | medio | pendiente |
| A6 | El cierre pide «no recogido» y el restaurante no tiene esa acción | bajo | pendiente |
| A7 | El para llevar a medias se arrastraba al pedido siguiente (cobro doble) | medio · dinero | #27 |
| A8 | Porciones partidas en el carrito atoraban la ronda | medio | #27 |
| A9 | Cobro de una parte y propina a la vez; en tableta «Cobrar» dejaba de responder | alto · cobro | #27 |
| A10 | «Editar receta» visible con el renglón cerrado | bajo | pendiente |
| A11 | Compra en efectivo sale del cajón de la caja abierta | decidido | DP-D115 |
| A12 | Interbloqueo al «Preparar» en cocina (500) | alto | producción (#26) |
| A13 | «−»/«+» del carrito sin nombre accesible | medio | #27 |
| A14 | Botones repetidos al dividir | bajo | #27 |
| A15 | Mapa de mesas sin rol ni foco en tableta/escritorio | alto | producción (#26) |
| A16 | Portal en modo mesero a 360 px se salía de la pantalla | alto | producción (#26) |
| A17 | Pago mixto sin etiquetas | medio | producción (#26) |
| A18 | Sesión de 8 h para una jornada de 11 h | bajo | por decidir (Miguel) |
| A19 | Cancelar la cuenta de mesas unidas las dejaba unidas sin preguntar | medio · dinero | #27 |
| A20 | Ventas enseñaba 200 sin decir que hay más | bajo | #27 (aviso) |
| A21 | Registros cargaba las últimas N y filtraba en el navegador | alto · reportes | #27 |
| A22 | El resumen de Registros no sumaba compras y gastos de hoy | alto · reportes | #27 |
| A23 | Propinas en Registros con el mismo tope | medio | pendiente |
| A24 | Con existencia negativa no se puede registrar una merma | medio | pendiente |
| A25 | Buscar un folio corto en Ventas no lo encontraba (coincide con casi todo) | medio · reportes | #27 |

Revisado y que no es falla: la devolución de lo vendido por peso no regresa el insumo (es la regla: lo
preparado no vuelve al anaquel).

## 4 · Lo que era del simulador (prueba mal hecha)

Cada falla del simulador se anotó, se esquivó y el día siguió. Las que más pesaron:

- **El día que no cerraba:** el día 1 llegó al tope con mesas ocupadas y sus cajas abiertas, y el día 2
  no pudo abrir caja. `cierre-forzado.ts` cierra por la app lo que un día deja (cuentas, partes de
  cuentas divididas, para llevar sin cobrar, mesas, uniones y cajas contando lo esperado) y quedó como
  paso fijo al final de cada día. La fila que se cansa a los 45 min y estancias que no pasan de las 19:00.
- **El árbitro:** comparaba el libro de toda la semana contra la base del día (207 críticos falsos el día
  2); ahora compara el día, y el inventario como movimiento neto del día.
- **Lo que A3 cambió:** el libro y el invariante I03 no sabían que por porción baja su ingrediente base.
- **Lectura de pantalla:** la mesa unida en el teléfono («18 Unida con 19»), la propina dentro de su
  diálogo, el buscador de Ventas, el Tablero que aún sincronizaba, el precio en vivo, el para llevar
  rearmado y su descuento.
- **Entorno:** 500 a las 8:22 del día 2 por el pool contra el Postgres local con la laptop cargada.

## 5 · La repetición

El día 1 otra vez, con el build de #27 (`dp-18-4`), desde el molde del inicio del día 1, misma semilla
y perfil, en una salida aparte (`docs/qa/semana/REPETICION-*.md`).

- **Volumen:** 212 cobros por $143,131.87 (130 de mesa, 82 para llevar), 116 cuentas de mesa (65 de
  mesero y 51 por el QR), 1,309 platillos, 108 pedidos del portal, 41 descuentos, 9 divisiones, 13
  uniones, 22 cambios de mesa y 19 cancelaciones; el día terminó a las 19:43, antes del tope, con todas
  las mesas libres y las dos cajas cerradas por las cajeras.
- **Incidentes:** 0 críticos, 5 altos, 60 medios y 60 bajos. De los altos: dos eran del árbitro (dos
  platillos quitados que el libro contaba como consumidos: arreglado en el simulador y re-arbitrado, 0
  diferencias); dos eran el dueño que no encontraba los folios 2 y 6 (A25: arreglado y comprobado en
  pantalla sobre la misma base, encuentra los folios 2, 6, 61 y 150); y el I06 informativo.
- **Lo que se vio funcionar:** ningún para llevar arrastró un pedido anterior (A7), ninguna cuenta
  dividida quedó a medias (A9), el rótulo de Ventas dice las del día (A21).

## 6 · Producción

- `main` con #24, #26 y #25: Vercel «Ready». En producción no se cobró nada durante la semana.
- #27: CI completo en verde (10/10); unido a `main` el 14-11 a las 10:25 y en producción («Ready») a
  las 10:25:38. Humo de sólo lectura: las páginas responden 200, la API sin sesión 403, y el JavaScript
  publicado trae los textos nuevos de A7, A8 y A21.
- **En producción, Don Poncho necesita:** «Crear el almacén principal» una vez (A4) y, el domingo en la
  noche y sólo si Miguel lo pide, `dejar-en-ceros.mjs` (primero `--ensayo`).

## 7 · Lo no hecho, y por qué

- **A5, A6, A10, A23, A24** (medianos y bajos): no estorban el lunes. A23 (Propinas con el mismo tope
  que tenía Registros) y A24 (merma con existencia negativa) son los primeros para la semana siguiente.
- **A18** (sesión de 8 h): es decisión de Miguel; el cambio es una constante.
- **La Parte 5** (menú digital): espera la elección A, B o C.
- **Las copias de la laptop** (`qa_dp18_*`): se archivan o borran al cerrar el encargo.

## 8 · Decisiones

- **DP-D115:** una compra en efectivo sale del cajón de la caja abierta; si no salió de la caja, se
  registra con transferencia o tarjeta.
- **DP-D116:** lo que pasó por cocina se cobra aunque el inventario diga que no hay.
