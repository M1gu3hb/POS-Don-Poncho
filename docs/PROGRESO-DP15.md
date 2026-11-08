# Progreso DP-15 · mudanza a la base propia, auditoría por función y entrega con el puro link

> Si la sesión se corta o se compacta, **lo primero es releer este archivo** y seguir desde «Lo que
> sigue». Sin secretos ni PIN aquí: viven en `..\_PRIVADO\`.

- **Rama:** `dp-15` (sale de `main` en `f02d4ca`).
- **Fecha límite:** jueves 12-11-2026 en la noche. Instalación: sábado 14-11.
- **Proyecto nuevo de Supabase:** «POS Don Poncho», ref `mqlcusxwqrefpfttjjks`, us-east-2,
  Postgres 17, creado por Miguel el 08-11.
- **Producción, desde el 08-11 a las 11:03:** en la base propia (`dpl_J8sH…`, `READY`).

## Estado por fase

| Fase | Qué | Estado |
| --- | --- | --- |
| 0 | Arranque: lectura, plan, este archivo | hecho (08-11 10:45) |
| 1 | Datos del proyecto nuevo con la CLI → `_PRIVADO\fase-b.env` | hecho (10:46) |
| 2 | 2.1 PIN nuevos | hecho (10:59) |
| 2 | 2.2 gerente sin Datos/Integraciones · 2.3 informativos · 2.4 capacidad | pendiente |
| 3 | La mudanza | hecha (11:07): huella IDÉNTICA, humo 38/38, regreso atrás escrito |
| 4 | Base propia lista: 2 cajas, «Caja 2», descuentos, PIN, respaldo | hecho (11:10) |
| 5 | Auditoría por función | pendiente |
| 6 | Arreglos | pendiente |
| 7 | QA de jornada | pendiente |
| 8 | Prueba del puro link | pendiente |
| 9 | Entrega y reporte 009 | pendiente |

## Lo que sigue

1. Fase 2.2 y 2.3 (código, con prueba en rojo y mutante) y 2.4 (capacidad: medir el sondeo).
2. Fase 5: copia desechable de la propia (`_PRIVADO\mudanza\2026-11-08-dp15-propia-lista`) y la
   auditoría por módulos con agentes (máx. 2 a la vez; Sonnet para criterio, Haiku para inventarios).
3. WebKit de Playwright no está instalado (`D:\_cache-dev\playwright`): hace falta para las Fases 7 y 8.

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
- Guiones de esta sesión (fuera del repo, en el scratchpad): `con-env.mjs` (pone valores de
  `_PRIVADO` en el entorno del hijo), `preparar-base-propia.mjs`, `humo-mudanza.mjs`,
  `vercel-cinco.mjs`, `revisar-pines.mjs` (guardián de PIN antes de cada commit).
- Hora: en Git Bash, `date` sale en UTC; la de CDMX es 6 h menos (o `node hora.mjs`).
