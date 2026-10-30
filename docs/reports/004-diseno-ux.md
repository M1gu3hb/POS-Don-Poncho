# 004 · Diseño, UI y UX (DP-11)

Se llena al cerrar cada paso. Sin secretos ni PIN: los accesos viven en `..\_PRIVADO\` y los PIN
de demo en la carpeta temporal de la PC.

## DP-11.0 · Inventario, línea base y plan (29-10-2026)

- **Qué quedó:** el inventario de pantallas, la línea base de rendimiento y el plan, en
  `docs/diseno/INVENTARIO-DP-11.md`; el medidor `scripts/medir-fluidez.mjs`; DP-D35 (publicación
  paso a paso en `main`), DP-D36 (el diseño va a las pantallas reales) y DP-D37 (id al azar por
  http). Rama `dp-11`.
- **Evidencia:** `docs/reports/evidencia-004/fluidez-antes.json` (CPU 4×, tableta y teléfono).
  `idAlAzar`: unidad y contrato en verde, seis mutaciones muertas, tipos y lint en verde.
- **Escrito en producción:** las posiciones de las 10 mesas (decisión de Miguel: cuadrícula 5×2,
  1–5 arriba y 6–10 abajo), con `scripts/acomodar-mesas.mjs` por `puente.escribir`, el 30-10 entre
  01:06:21 y 01:06:29 UTC. Comparado con exportaciones de antes y después: sólo cambiaron `mesas`
  (10 posiciones), `auditoria` (+10) y `comandos_ejecutados` (+10). Huella de las otras 10
  organizaciones IDÉNTICA (119 tablas). Lecturas: Don Poncho con 0 órdenes y 0 pagos.
- **La demo de `fase-b`** para Miguel quedó en `.work/demo-fase-b` con su lanzador
  `.work/demo-fase-b.ps1` (fuera del repositorio), sobre la base desechable
  `don_poncho_demo_faseb`.
- **Pendientes:** la distribución REAL del salón (hoy es una cuadrícula para que se pueda tocar
  cada mesa): el dueño la ajusta en Configuración → Mesas arrastrándolas.

## DP-11.1 · Morfi en el POS (29-10-2026)

- **Qué quedó:** Morfi en la carga de pantalla completa (al entrar con PIN o recargar: «Cargando
  tu caja», «Cargando las mesas»…), en la carga del menú del portal QR, en la página que no
  existe y en el QR que no lleva a ninguna mesa. Nada se ve antes de 600 ms; las manos quedan en
  la orilla de la tarjeta por cálculo (prueba); nunca dos clips a la vez; se cierra con un toque.
  WebM con transparencia (Chrome, Edge, Firefox, Android), WebP animado a 15 cuadros (Safari, todo
  el iPhone y el iPad, también los navegadores dentro de WhatsApp o Instagram) e imagen fija con
  «reducir movimiento». Interruptor «Mascota Morfi» por negocio en Configuración → Apariencia,
  encendido por omisión (`configuracion.valores.experiencia`, sin migración). DP-D38, ficha 14.
- **Fuente:** `M1gu3hb/Morfi-pet` `c61aab2`, clips 03, 07 y 11 (partido en dormido y despertar
  para DP-11.2). Pesos: WebM 2.2 MB los cuatro, WebP 3.9 MB, fijas 23 KB cada una.
- **De paso, en el teléfono:** Configuración → Apariencia se desbordaba a lo ancho (543 px en un
  teléfono de 412) y el interruptor quedaba fuera. Causa: el `<main>` de `AppLayout` (hijo de
  flex sin `min-w-0`) crecía con el contenido más ancho; y el `fieldset` de las voces no dejaba
  encoger sus renglones. Dos clases, declaradas en `verify:aspecto`.
- **Evidencia:** unidad e integración (Postgres) en verde; 18 mutaciones de la lógica y del
  servidor, 18 muertas (dos sobrevivientes destaparon el caso de los navegadores dentro de apps
  del iPhone y del iPad, que ahora tiene prueba); `verify:adopcion` reconoce `PantallaDeCarga`
  como la espera de una pantalla entera (con su prueba roja/verde); `verify:aspecto` con los
  cambios del heredado declarados.
- **Navegador:** `pruebas/e2e/morfi.spec.ts`, 18 de 18 en escritorio, tableta y teléfono: el 404
  con el clip que SE REPRODUCE y se cierra con un toque; la imagen fija con «reducir movimiento»;
  el WebP (y que carga) con la identificación de un iPhone; el QR sin mesa; la carga larga (en
  300 y 590 ms, con la animación detenida, no se ve; luego sí, con Morfi); y con «Mascota Morfi»
  apagada, sin Morfi, y el interruptor la vuelve a encender (que la pestaña quepa a lo ancho en
  el teléfono también se comprueba).
- **Revisión independiente** (subagente Sonnet, sólo lectura): sin críticos ni altos. Atendido:
  el video lleva su imagen fija de `poster` y, si no se puede reproducir, se queda en ella; el
  WebP cuenta su duración desde que carga; el portal ya no ofrece «Volver a intentar» en un QR que
  no sirve. Anotado sin cambiar: el servidor lee dos veces la fila de configuración al pintar
  (apariencia y experiencia), costo despreciable.

