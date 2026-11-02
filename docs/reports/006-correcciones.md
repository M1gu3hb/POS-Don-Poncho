# 006 · DP-12 · Correcciones y funcionamiento final

Fecha: 01-11-2026 (hora de CDMX). Sesión local de Claude Code en la laptop de Miguel, en el
worktree `.claude/worktrees/dp12`, rama `dp-12` (de `main` @ `4b00f9e`). Sin secretos ni PIN: los
accesos viven en `..\_PRIVADO\`. Etapa: corregir, no agregar; el diseño de DP-11.4 (`dp-11`) no se
tocó.

> BORRADOR EN CURSO: las secciones marcadas «pendiente» se completan al cerrar cada punto.

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

### DP-12.4 · Cancelar con motivo, y el corte — pendiente de integrar

### DP-12.5 · Estaciones de punta a punta — pendiente

### DP-12.6 · Las pantallas — en curso

- **6 · Con 3 y con 25 mesas:** con 25 mesas en una zona, la 21 nacía encima de otra (a cada mesa
  puesta se le reservaba la caja más grande y tapaba la casilla de al lado). Arreglado: cada mesa
  reserva su medida; con la rejilla llena, baja de fila. Prueba de navegador con 3 y con 25
  (quitar y crear, QR nuevos, sin encimarse, mapa o rejilla, portal, unir y separar).

### DP-12.7 · Rendimiento de abrir una mesa — no se rescata (anotado)

- La mejora de `dp-11` (`5ba89ea`: teselas memoizadas, catálogo en dos tiempos, borrador fuera de
  `Mesero`) viene fundida con el rediseño de Mesero (componentes nuevos, `Mesero.jsx` −734 líneas).
  Separarla obliga a rehacer el estado del carrito en la `Mesero.jsx` actual: no es separable sin
  el diseño. Queda para cuando entre DP-11.4.

### DP-12.8 · Reauditoría — pendiente

## 2 · Lo que se escribió en producción y las huellas

- **20:43:27–20:43:36 UTC (DP-12.1):** marca de «Miguel · Morphiq»; la cuenta de prueba de la
  Mesa 1 cancelada con «Prueba» y la mesa libre; `purgar_ventas` sin revertir inventario (1 orden,
  1 línea, 1 comanda, 1 renglón de comanda). Exportaciones antes y después: sólo cambian
  `auditoria` +3, `comandos_ejecutados` +3, `configuracion`, `eventos_mesa` +1, `mesas` (la 1,
  libre) y lo purgado. Huella de los otros 10 negocios IDÉNTICA.

## 3 · Qué tiene que probar Miguel — pendiente

## 4 · Commits

| Commit | Qué | Autor |
| --- | --- | --- |
| `23baf5b` | DP-12.1: los botones que borran en masa, sólo para plataforma | `M1gu3hb` |
| `22b0322` | DP-12.2 y DP-12.3 | `M1gu3hb` |
| `df8827d` | DP-12.6: con 25 mesas ninguna nace encima de otra | `M1gu3hb` |

Todos `M1gu3hb <118588634+M1gu3hb@users.noreply.github.com>`, sin coautoría.
