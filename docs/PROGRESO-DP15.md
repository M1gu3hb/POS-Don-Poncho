# Progreso DP-15 · mudanza a la base propia, auditoría por función y entrega con el puro link

> Si la sesión se corta o se compacta, **lo primero es releer este archivo** y seguir desde «Lo que
> sigue». Sin secretos ni PIN aquí: viven en `..\_PRIVADO\`.

- **Rama:** `dp-15` (sale de `main` en `f02d4ca`).
- **Fecha límite:** jueves 12-11-2026 en la noche. Instalación: sábado 14-11.
- **Proyecto nuevo de Supabase:** «POS Don Poncho», ref `mqlcusxwqrefpfttjjks`, us-east-2,
  Postgres 17, creado por Miguel el 08-11.
- **Producción, desde el 08-11 a las 11:03:** en la base propia. Desde el 09-11 a las 04:24, con
  `main` en `cd76829` (el PR #13; `dpl_8d4e…`, `READY`).

## Estado por fase

| Fase | Qué | Estado |
| --- | --- | --- |
| 0 | Arranque: lectura, plan, este archivo | hecho (08-11 10:45) |
| 1 | Datos del proyecto nuevo con la CLI → `_PRIVADO\fase-b.env` | hecho (10:46) |
| 2 | 2.1 PIN nuevos | hecho (10:59) |
| 2 | 2.2 gerente sin Datos/Integraciones · 2.3 informativos · 2.4 capacidad (`docs/infra/CAPACIDAD.md`; el portal ya sondea cada 12 s) | hecho |
| 3 | La mudanza | hecha (11:07): huella IDÉNTICA, humo 38/38, regreso atrás escrito |
| 4 | Base propia lista: 2 cajas, «Caja 2», descuentos, PIN, respaldo | hecho (11:10) |
| 5 | Auditoría por función | hecha: `docs/qa/AUDITORIA-POR-FUNCION.md` (2 bloqueantes, 15 medios) |
| 6 | Arreglos | hechos; PR #13 en `main` (`cd76829`, 09-11 04:22) con la CI 10/10 y el acople; DP-D83 a DP-D91, ficha 35 |
| 7 | QA de jornada | hecho: QA-J cuadró al centavo y 0/34; QA-D 54/54; 1 bloqueante y 5 medios arreglados; ronda 2 9/9 (`docs/qa/`) |
| 8 | Prueba del puro link | hecha (09-11 04:31): 6 aparatos, el portal en 5, 8 a la vez, 3G, «Agregar a inicio»; producción limpia; las alertas eran mis guiones (DP-D91), cero tras corregirlos |
| 9 | Entrega y reporte 009 | `docs/ENTREGA-DON-PONCHO.md` en `main`; el reporte 009 completo, en el PR de documentos (rama `dp-15-docs`) |

## Lo que sigue

1. El PR de documentos (`dp-15-docs` → `main`): el reporte 009, DP-D91 reescrita, la ficha 35, la
   bitácora, este archivo y el comentario de `cliente.contrato.test.ts`. CI en verde y merge.
2. El mensaje final a Miguel: el link, el commit, lo que falta y lo que necesita de él.
3. **Regla nueva (DP-D91):** cualquier guion que lea producción va con `begin read only … commit`,
   nunca con un `SET` de sesión por el pooler de transacción.

- Mutantes: todos los vigentes mueren (102; `D:\mpos-tmp\dp15-mutantes-final.log` y los tres rehechos).
- `pnpm verify` local completo en verde sobre el código final (sin `verify:entorno`; acople aparte).

## Dónde quedó cada cosa

- Skills cargadas: `morphiq-prs`, `vercel-cli-with-tokens`, `engineering:deploy-checklist`,
  `engineering:testing-strategy`, `engineering:code-review`, `engineering:debug` (las 6).
- Supabase CLI: `D:\herramientas\supabase-cli\node_modules\.bin\supabase` (v2.115.0), con sesión.
  **Ojo:** esa carpeta está ligada a la compartida; con la CLI siempre `--project-ref` explícito.
  El token de la CLI está en el administrador de credenciales de Windows («Supabase CLI:supabase»).
- `_PRIVADO\fase-b.env`: llaves, cadenas (sesión 5432 para migrar/importar con `postgres`;
  `DATABASE_URL` de `morphiqpos_app` por el 6543), `STORAGE_*` del conductor de Supabase.
- `_PRIVADO\PINES-DON-PONCHO.md`: los 10 PIN nuevos (usuario, puesto, PIN).
- `_PRIVADO\mudanza\`: `huellas-dp15\` (antes y después), `2026-11-08-dp15` (exportación de la
  compartida), `2026-11-08-dp15-compartida-despues`, `2026-11-08-dp15-propia-lista` (exportación de
  la propia ya lista) y `2026-11-08-dp15-propia-lista.dump` (`pg_dump -Fc` de `public`),
  `regreso-atras\` (guion y `LEEME.md`).
- Respaldos del plan (Pro): diarios físicos, 7 días; sin PITR. Se restauran desde el panel
  (Database → Backups), todo el proyecto a ese día.
- Worktree de arreglos: `.claude/worktrees/dp15-codigo` (rama `dp-15-codigo`), base de pruebas
  local en el 5436 (`integ.sh` corre la integración). Copias de auditoría en el 5460 (A 32701, B 32702).
- Guiones de esta sesión (fuera del repo, en el scratchpad): `con-env.mjs` (pone valores de
  `_PRIVADO` en el entorno del hijo), `preparar-base-propia.mjs`, `humo-mudanza.mjs`,
  `vercel-cinco.mjs`, `revisar-pines.mjs` (guardián de PIN antes de cada commit).
- Hora: en Git Bash, `date` sale en UTC; la de CDMX es 6 h menos (o `node hora.mjs`).
