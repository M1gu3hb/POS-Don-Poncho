# DP-24 · Los cambios que pidió Don Poncho (la Caja manda)

Bitácora de la etapa. Empieza el **20-11-2026 a las 16:45** (hora del centro), con `main` en `101f86f`
(DP-23, PR #46). La entrega fue el 19-11; mañana se capacita a los meseros.

## Cómo se reparte

| Parte | Qué | Quién | Árbol y rama |
|---|---|---|---|
| 1 | La Caja: tarjeta de cobro nueva, propina, efectivo, varias tarjetas, modificar la cuenta, propinas en el corte | sesión principal, en persona | checkout principal · `dp-24-p1-caja` |
| 2 | Quién quita y cancela (y la confirmación de la Parte 7) | agente Sonnet | `.work/dp18-integrar` · `dp-24-p2-quien-cancela` |
| 3 | El menú: orden, categorías, colores y opciones | agente Sonnet | `.work/dp20-lab` · `dp-24-p3-menu` |
| 4 | Cocina por producto, avisos al mesero y la mesa | agente Sonnet | `.work/dp20` · `dp-24-p4-cocina` |
| 5 | Unir mesas poco a poco | agente Sonnet (cuando se libere un árbol) | por abrir |
| 6 | Impresión: copias y el permiso del iMin (POS y repo de las apps) | agente Sonnet (cuando se libere un árbol) | por abrir |
| 7 | Lo que sólo se confirma | con la Parte 2 | — |
| 8 | Cero final | sólo cuando Miguel escriba «CERO FINAL» | — |

Los agentes no confirman ni suben: dejan el cambio en su árbol; la sesión principal revisa el diff,
corre sus pruebas, confirma, abre el PR y lo une con la CI en verde. Orden de subida: 2, 3, 6, 5, 4 y 1.

## Arranque (20-11, 05:00–06:15 y 16:45–17:00)

- **Skills cargadas:** `engineering:code-review`, `engineering:testing-strategy`, `engineering:debug` y
  `morphiq-prs` (apareció como `morphiq-prs:morphiq-prs`).
- **El mensaje de contexto de la mañana era el de DP-21** (ya hecho); Miguel lo anuló en el encargo de DP-24.
  En la raíz del repo no hay `CLAUDE.md` ni `AGENTS.md` (sólo en `apps/web`), como en etapas anteriores.
- **Línea base:** los dos repos al día y limpios; `pnpm install` en verde; las 40 puertas de `verify` que
  corren en la laptop, en verde (fuera, como siempre, `verify:esquema`, `verify:rls` y `verify:acople`).
  `test:integracion`: 1,107 de 1,107 (179 archivos) sobre una base local migrada desde cero (127
  migraciones, última la 195). Los dos rojos previos fueron del ambiente: el Postgres local 55433 apagado
  tras un reinicio de la laptop y una base vieja que se había quedado en la migración 193.
- **Producción, sólo leída (sesión 5432), 05:19:** desplegado `101f86f`, 0 errores en Vercel en 24 h;
  4 cuentas pagadas del 19-11 (DP-01001 a DP-01004, $2,128.25), 1 caja abierta («Aparato 33») y 1
  cerrada, 6 comandas entregadas, 35 aparatos, cupo de 1 caja, IVA en 0, H1 sin activar, migración 195.
  **Miguel (16:45): son las pruebas de la presentación; NO se borran ni se cierra esa caja; los ceros van
  después de la capacitación, cuando escriba «CERO FINAL».**
- **El catálogo real** se exportó en sólo lectura (16:49) a un archivo fuera del repo para el agente del
  menú: 17 categorías, 107 productos, 13 grupos de opciones con 139 opciones, estaciones «Cocina» y
  «Cantina». Ninguna cuenta usa un producto «(extra)».

## Lo que se aprendió de la laptop hoy (para no repetirlo)

- Con cuatro árboles trabajando a la vez, **una construcción de la app tarda de 20 a 35 minutos** (sola
  tarda 4). Sólo corre una a la vez (candado `D:\mpos-tmp\dp24\candado-build`), así que las pruebas de
  navegador en local se forman en fila. Por eso cada parte se sube a su PR en cuanto sus pruebas
  unitarias y de integración están en verde, y la CI corre las de navegador en paralelo.
- `node scripts/base-desechable.mjs subir` **se cuelga** en esta laptop (su `pg_ctl start` hereda las
  tuberías de Node y no regresa). `D:\mpos-tmp\dp24\e2e-subir.sh` arranca el clúster por su cuenta.
- Para ver una pantalla mientras se trabaja: servidor de desarrollo contra la base desechable
  (`D:\mpos-tmp\dp24\dev-p1.sh`, lanzado con la configuración `caja-dp24`), sin construir.

## Parte 2 · Quién quita y cancela (PR abierto el 20-11, 18:50)

- **Hecho:** el mesero ya no anula lo enviado ni cancela la cuenta (roles de `restaurante.anular_linea`
  y `restaurante.cancelar_orden`, y regla de dominio en `cancelar-con-permiso.ts`); el cajero siempre
  con el PIN de un gerente, administrador o dueño; la gerencia sin PIN; el motivo sigue obligatorio.
  En pantalla el mesero no ve los botones; la Caja pide el PIN de entrada al cajero y nunca a la
  gerencia. Se cerró además la puerta de al lado (`transicionar_pedido` a «cancelado», sólo gerencia).
- **Pruebas:** `quien-quita-y-cancela.integracion.test.ts` (16) y `cancelar-con-permiso.test.ts` (8);
  8 mutantes muertos; la integración de restaurante, caja, portal, puente y mantenimiento completa en
  verde tras ajustar los flujos que daban por hecho que el mesero cancelaba.
- **Parte 7 (sólo se confirma):** con la asignación apagada, quien abre o atiende la mesa se queda con
  ella: `portal/sin-asignacion.integracion.test.ts` (9) y una prueba nueva. El Tablero no se tocó.
- **Lo revisó la sesión principal** línea por línea (toca permisos). Decisión: DP-D210.
- **No comprobado en local:** las e2e reescritas (la fila de construcción); las corre la CI del PR.
- **Queda anotado:** el simulador de bots (`qa/simulador`) sigue haciendo que el mesero quite platillos;
  no corre en la CI y se ajusta antes de la próxima jornada de bots.

## Decisiones (en `DECISIONES.md`, desde DP-D210)

- **DP-D210** · Quién quita y cancela.

## Estado por parte

| Parte | Estado |
|---|---|
| 1 · La Caja | en curso (sesión principal) |
| 2 · Quién quita y cancela | PR abierto, esperando la CI |
| 3 · El menú | agente trabajando |
| 4 · Cocina por producto | agente trabajando |
| 5 · Unir mesas poco a poco | por lanzar |
| 6 · Impresión | por lanzar |
| 7 · Lo que sólo se confirma | hecho con la Parte 2 |
| 8 · Cero final | espera el «CERO FINAL» de Miguel |
