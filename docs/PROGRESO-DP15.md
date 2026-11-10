# Progreso DP-15 · mudanza a la base propia, auditoría por función y entrega con el puro link

> Si la sesión se corta o se compacta, **lo primero es releer este archivo** y seguir desde «Lo que
> sigue». Sin secretos ni PIN aquí: viven en `..\_PRIVADO\`.

- **Rama:** `dp-15` (sale de `main` en `f02d4ca`).
- **Fecha límite:** jueves 12-11-2026 en la noche. Instalación: sábado 14-11.
- **Proyecto nuevo de Supabase:** «POS Don Poncho», ref `mqlcusxwqrefpfttjjks`, us-east-2,
  Postgres 17, creado por Miguel el 08-11.
- **Producción, desde el 08-11 a las 11:03:** en la base propia. Desde el 09-11 a las 10:03, con
  `main` en `8e06826` (el PR #15, DP-15.1; `dpl_9MDS…`, `READY`); antes, `cd76829` (el PR #13).

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
| 9 | Entrega y reporte 009 | hechos: `docs/ENTREGA-DON-PONCHO.md` y el reporte 009 en `main` (el 009 llegó con el #15) |

## DP-15.1 · La ronda final antes del sábado (auditoría del orquestador, 09-11)

Rama `dp-15-1` (sale de `dp-15-docs`, que lleva el reporte 009; el PR #14 quedó absorbido): el PR
[#15](https://github.com/M1gu3hb/POS-Don-Poncho/pull/15), merge `8e06826` (09-11, 10:02). Worktree `dp15-codigo`. El documento `AUDITORIA-2026-11-09.md` no está en disco: se trabaja
con el resumen del encargo.

| Parte | Qué | Estado |
| --- | --- | --- |
| 1 | El 25006: causa confirmada (DP-D92), `conTransaccion` en `read write`, escrituras sueltas a transacción, guiones fuera del 6543, regla en RUNBOOK y entrega | hecho (`a77d1a0`, 8/8 mutantes) |
| 2.1 | `caja.movimiento`: la cajera sólo retiro y entrada de cambio; ajuste con rastro; motivo mínimo; «1,500» | hecho (agente A, `047dcf1`; DP-D93) |
| 2.2 | Registros → Auditoría: filtro en el servidor, fecha, páginas, nombres legibles; lo negado marcado | hecho (agente B, `b5f2981`; DP-D95) |
| 2.3 | El mesero cambia de mesa desde su pantalla | hecho (`047dcf1`; DP-D94) |
| 2.4 | Lo listo de una cuenta cobrada antes de servir | **sin confirmar por Miguel: se queda como está** (DP-D97; se le pregunta) |
| 3 | Zonas desactivables y el «hoy» del Tablero (DP-D96); el borrador y lo agotado (DP-D94); la 190 `search_path` (aplicada a la propia 10:00); el iPhone en la entrega | hecho |
| 4 | 009, este archivo y la bitácora | hecho (el cierre, en un PR corto de documentos) |
| 5 | PR, CI, la 190 en la propia, merge, `READY`, humo con `link.mjs`, Vercel 1 h sin errores, Don Poncho en ceros | hecho: CI 9/9, acople, `READY` 10:03, humo verde, ceros y Vercel sin errores hasta las 11:06 |

## Lo que sigue

1. Lo que hace Miguel (`docs/ENTREGA-DON-PONCHO.md`): su revisión de 10 minutos con sus PIN (teléfono,
   PC, tableta, el QR con la cámara y «Agregar a inicio»; en el iPhone se entra otra vez desde el
   ícono); el sábado, nombrar «Caja 1» y «Caja 2» y probar la térmica; la primera semana, el uso de
   Vercel y Supabase.
2. **Su respuesta:** ¿cobran antes de servir? Si sí, el botón «Entregado» de DP-D97.
3. **La regla (DP-D92):** ninguna revisión contra producción por el 6543 mientras el restaurante opera.

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
