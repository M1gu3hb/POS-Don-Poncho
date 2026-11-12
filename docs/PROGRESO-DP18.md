# Progreso DP-18 · lo que encontró Miguel y la semana simulada con bots

> Si la sesión se corta o se compacta, **lo primero es releer este archivo** y seguir desde «Lo que
> sigue». Sin secretos ni PIN aquí: viven en `..\_PRIVADO\`.

## Arranque (11-11-2026, noche)

- **Skills:** `engineering:testing-strategy`, `engineering:debug`, `engineering:code-review` y
  `morphiq-prs` cargadas. «frontend-design» no existe con ese nombre: la más parecida es
  `anthropic-skills:design-taste-frontend` (o `impeccable`, como en DP-16); se carga en la Parte 5,
  que es la única de diseño.
- **Lo que el encargo dice y el repo no (gana el repo):**
  - no hay `CLAUDE.md` ni `AGENTS.md` en la raíz: sólo los de `apps/web` (la guía de Next en
    `node_modules/next/dist/docs/`);
  - `link.mjs` no está en `scripts/`: vive en `D:\mpos-tmp\dp15-link\link.mjs` (fuera del repo);
  - `verify` completo no corre en la laptop: con `DATABASE_URL_PRUEBAS`, `verify:entorno` exige el
    Postgres 17 del compose y el clúster local es 18; `verify:esquema`, `verify:rls` y
    `verify:acople` leen la base COMPARTIDA y el despliegue (la CI tampoco los corre). Se corre en
    dos tramos con `D:\mpos-tmp\dp18\verify-local.sh`: todas las puertas menos esas tres, y
    `test:integracion` con la base local `dp18_pruebas` (55433), como en DP-16 y DP-17.
- **El entorno estaba trabado:** los dos clústeres locales (55433 y 5460) seguían «en ejecución» desde
  el 09-11 pero no aceptaban conexiones (Windows, `error code 487` al reservar memoria compartida);
  se reiniciaron. Los 17 worktrees viejos de agentes (DP-12 a DP-16, varios con cambios sin commit)
  hacían lentísimos los verificadores que recorren el árbol: se movieron, sin borrar nada, a
  `D:\MIS PROYECTOS\MORPHIQ POS\.work\worktrees-viejos-dp18\` con `git worktree move`; uno
  (`agent-a2283480c75286caa`) quedó bloqueado por Windows y sigue en `.claude/worktrees`.
  `verify:pruebas` ahora salta `.claude` (como ya saltaba `node_modules`): los worktrees de los
  agentes no son pruebas de este árbol.
- Una prueba unitaria (`avisos-caducados.test.ts`) pasó de 5 s con la laptop cargada (16.6 s); sola,
  2 s. Ambiental.

## Producción, sólo leyendo (11-11, 20:00; conexión de sesión 5432, `begin read only` + `rollback`)

- 1 caja abierta: la abrió «Miguel · Morphiq» a las 10:14 en «Caja 2» (la tableta) con fondo $0 y se
  trasladó a «Caja 27» (la PC) a las 10:41. 1 venta: folio A-1, $429.00 en efectivo (10:14). Folios en 2.
- El cupo de cajas: ya era 2; a las 10:38:30 se movió a 1 y medio segundo después a 2; a las 10:40:53
  a 1; a las 10:41:31, «Traer» la caja a la PC. Hoy dice 1.
- El modo del menú: `productos_pos` («A la carta»), guardado a las 10:37:47.

## La copia de la base propia

- Exportación de sólo lectura (`exportar-negocio.mjs`, sin archivos) en
  `_PRIVADO\mudanza\2026-11-11-dp18-copia`: 135 tablas, 1,332 filas.
- `qa_dp18_base` en el clúster local 5460 (`D:\mpos-tmp\dp18\copia.sh`): migrada desde cero hasta la
  192, importada idéntica (filas y md5) y con los 10 PIN cambiados por PIN de prueba que sólo valen
  ahí (`D:\mpos-tmp\qa-dp18-base\pines.json`, fuera del repo).

## Estado por parte

| Parte | Qué | Estado |
| --- | --- | --- |
| 0 | Ubicarse, `verify`, bitácora | en curso |
| 1 | Lo que encontró Miguel (un PR) | pendiente |
| 2 | El simulador | pendiente |
| 3 | La semana | pendiente |
| 4 | Triage, arreglos, reporte 011 | pendiente |
| 5 | Tres direcciones del menú digital | pendiente |

## Lo que sigue

La Parte 1, en la rama `dp-18-1`.
