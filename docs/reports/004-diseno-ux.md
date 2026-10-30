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
- **Escrito en producción:** nada. Lecturas: actividad de Don Poncho (0 órdenes, 0 pagos) y la
  posición de sus 10 mesas (todas en 100, 100).
- **La demo de `fase-b`** para Miguel quedó en `.work/demo-fase-b` con su lanzador
  `.work/demo-fase-b.ps1` (fuera del repositorio), sobre la base desechable
  `don_poncho_demo_faseb`.
- **Pendientes:** la posición real de las mesas en producción (decide Miguel); el portal de la demo
  de `fase-b` espera la fusión de `main` con `idAlAzar`.
