# ESTADO · DP-22 · La auditoría final

> **Si la sesión se compactó, lee esto primero.** Luego `PLAN.md`, `HALLAZGOS.md` y
> `docs/PROGRESO-DP22.md`. Sin secretos ni PIN aquí: viven en `..\_PRIVADO\`.

Última puesta al día: 17-11, 22:15.

## AHORA MISMO (17-11, 22:15) — retomar desde aquí

1. **Lotes 1, 2, 3 y 4 EN PRODUCCIÓN Y CERRADOS** (`ff03687`, `829b13d`, `e4c45f5`, `6b76050`;
   migraciones hasta la 195; Vercel sin errores en la hora de cada uno).
2. **Lote 5 armado** en el checkout principal, rama `dp-22-quinto-lote` (subida, SIN PR todavía;
   sin migraciones). Lleva, revisado y con mutantes propios: el día de bots (agente F, DP-D175 y
   176), la Parte 5 completa y sus arreglos (agente G: hallazgos 12 corregido de verdad, 24, 29,
   30 y 36; DP-D171 a 174) y la Parte 7 en la app (agente H: hallazgos 31, 32 y 33, y el tiempo
   de la mesa; DP-D177 a 179). Comprobado con `bash /d/mpos-tmp/dp22/comprobar-lote5.sh <log>`
   (tipos de los tres proyectos, formato, 9 puertas, unitarias de zona, integración contra
   `dp22_lote4`, typecheck y lint): todo en 0.
   **Corriendo:** (a) la CI que REGENERA la galería sobre `3b9fd20`:
   `gh run view 44234811702` → bajar `galeria-restaurante`
   (`gh run download 44234811702 -n galeria-restaurante -D /d/mpos-tmp/dp22/galeria-lote5`),
   MIRAR los PNG que cambian, copiarlos a `pruebas/e2e/galeria.spec.ts-snapshots/` y confirmar;
   (b) el agente I · `a937b1199fc106d86` · `.work\dp20` · `dp-22-costo-por-medida` (sale de
   `72b5997`): el hallazgo 27 (el margen ignora lo vendido por kilo: el costo del renglón por
   medida queda en cero; DP-D180) y el 28 (el botón «Registrar compra» del almacenista).
   Recibirlo con parche desde `72b5997` y `git apply --3way --index`, `comprobar-lote5.sh`,
   mutante propio.
   **Después:** abrir el PR del lote 5 (`gh pr create --base main --head dp-22-quinto-lote`),
   Auto-fix, CI en verde, `gh pr merge N --squash`, «READY», `humo-produccion.sh 5`,
   `revisar-produccion.mjs` (no hay migración: la lectura debe salir idéntica), la hora de Vercel.
3. **El día de bots (Parte 10), con la máquina SOLA, cuando el lote 5 tenga su contenido final:**
   en `.work\dp20-lab` poner el código final (`git checkout --detach origin/dp-22-quinto-lote` o
   `main` si ya se unió), `pnpm build`, y
   `bash D:/mpos-tmp/dp22/bots/dia-de-bots.sh repetir 2211 > /d/mpos-tmp/dp22/bots/dia-2211.log 2>&1`
   (clona `qa_dp22_inv` a `qa_dp22_bots_2211`, migra, levanta 3210 y 54511; 8:00 a 19:00 a ×4:
   unas 2 h 45 min). Salida: `D:\mpos-tmp\dp22\bots\salida-2211\dia-22\DIA-dp22-2211.md`,
   `horas.json`, `caos-dp22.json`, `INCIDENTES.md`. Leer el informe y los incidentes; lo que sea de
   la app se arregla o se anota; repetir con otra semilla (2212…) hasta que salga limpio. Del
   ensayo quedaron por confirmar con la máquina sola: «Cambiar de mesa» que no se le ofrece al
   mesero que atiende (D22-020: ¿el reparto de mesas del caos le quitó la mesa?), botones que no
   aparecen en 45 s (carga) y el caos que nunca corrió (C4 a C8, S1, K1, K2, M1 a M3, R1, A1).
4. **Parte 11** con `bash /d/mpos-tmp/dp22/parte11.sh` (ya ensayada sin escribir: configurar
   mandaría 5 comandos; `ceros-ensayo 9` encuentra sólo las 9 cuentas de prueba y 1 caja cerrada;
   35 aparatos; orden: configurar → ceros 9 → primer-folio → aparatos → `revisar-produccion.mjs`
   → `pnpm dia-cero`; H1 NO se activa; exige que `packages/` y `scripts/` sean los de
   `origin/main`).
5. **Informe 013** (`docs/reports/013-auditoria-final.md`): veredicto, números, calificación, la
   lista física de Miguel (en la tableta, crear una receta eligiendo «Variable por medida»; tras
   el primer cierre real, ver el PDF en `Documentos\POS Don Poncho\Cortes`; el arqueo por billetes
   en el iMin; el tiempo de la mesa con la hora del aparato bien puesta) y lo grande para después
   (está en `NUEVO.md`).

## Dónde voy

- **Fase A (preparar) y Fase B (el mapa total):** hechas. La línea base de `main` quedó en verde
  salvo el Hallazgo 1 (ya arreglado). `MATRIZ.md` sin huecos: 34 pantallas, 96 ajustes, 104 flujos,
  126 comandos, 26 entidades.
- **Lote 1 = PR #37** (`dp-22-arranque` → `main`), abierto, con la CI corriendo sobre `7a51e29` y
  el arreglo automático de la CI encendido (la app avisa: no sondear). Lleva: Bloque 19 entero
  (H2, A24, devolución por peso, X4, H3, A23, A5, A6, A10, X5), la puerta de `heredado/`, el
  Hallazgo 1, lo decidido del anexo 012 y de la auditoría del 16-11, el mapa, el oráculo y los
  guiones de producción. Sin migraciones.
- **Lo que sigue al PR #37:** unir (merge, nunca force) → esperar la fila **Production «Ready»** de
  `vercel ls` (no el estado del commit, que puede ser el preview) → humo sin cobrar → Vercel sin
  errores nuevos en la hora siguiente → aviso en el chat.
- **Lote 2 (rama `dp-22-lote2`, en `.work\dp20-lab`):** el arnés táctil (`dp-22-arnes` `a5ae55d`)
  ya unido con el lote 1 y su arreglo (`e4decc8`). Encima trabaja el agente A.
- **Fase I (producción):** los guiones están en el lote 1 y ENSAYADOS en clones locales. Se corren
  en producción al final, con todo en verde. El bloqueo H1 NO se activa en esta sesión.

## Ramas y árboles (23:40)

| Quién             | Árbol                 | Rama               | Qué hace                                                                                                            | Estado                                                |
| ----------------- | --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Sesión principal  | `POS Don Poncho`      | `dp-22-arranque`   | el lote 1; aquí corre `verify-lote1` (puertas de mutación: nada de commits ni `git add -A` hasta que acabe)         | local en `6ce290a`; el remoto ya va en `7a51e29`      |
| Agente A (Sonnet) | `.work\dp20-lab`      | `dp-22-lote2`      | barrido de las pantallas de servicio en los 14 aparatos y arreglo de los hallazgos 2 a 6; e2e táctil del Hallazgo 1 | trabajando (desechable 5438, servidor 3210); DP-D154  |
| Agente B (Sonnet) | `.work\dp20`          | `dp-22-b18`        | Bloque 18, lado POS: guardar el PDF del corte en la carpeta al sellar; «Guardar en la carpeta» y «Abrir carpeta»    | trabajando; DP-D153                                   |
| Agente B (mismo)  | `.work\apps-electron` | `exe-1.0.2` (apps) | Bloque 18, la app 1.0.2: `MorphiqApp.archivos.guardar` y `abrirCarpeta` con sus tres cerrojos. NO publica           | trabajando                                            |
| Agente C (Sonnet) | `.work\dp18-integrar` | `dp-22-ajustes`    | Fase D: el dinero combinado de a tres con el oráculo (PICT), cada ajuste solo, los 11 cambios a media operación     | trabajando (base `dp22_ajustes` en el 55433); DP-D155 |

Ramas ya consolidadas y unidas en el lote 1: `dp-22-b19` (`6b580f5`), `dp-22-b19b` (`7921fd2`),
`dp-22-lote3` (`6d5c22b`). `dp-22-lote1-fix` (`7a51e29`) es el arreglo de las unitarias, ya en el PR.

Ningún agente hace commit. Al terminar cada uno: revisar su diff, correr YO sus pruebas **y las
unitarias completas de las zonas que tocó** (ver la trampa de abajo), un mutante propio,
`pnpm verify:aspecto` y `node scripts/verificar-heredado.mjs` en su árbol, revisar PIN
(`git add` y `node /d/mpos-tmp/dp21/revisar-pines.mjs <árbol>`) y consolidar en su rama.

## En curso (de fondo)

- `verify-lote1` en el checkout principal → `/d/mpos-tmp/dp22/verify-lote1.log` y un `.log` por
  puerta en `/d/mpos-tmp/dp22/verify-lote1/`. Corre sobre `6ce290a` (sin el arreglo de las
  unitarias). Marcó `lint=1` (ya arreglado en `6ce290a`) y `test:unit=1` (19 pruebas, arregladas en
  `7a51e29`). Al acabar: `git pull --ff-only` aquí y repetir sólo `test:unit`.
- La CI del PR #37 (GitHub). Llega como evento a la sesión.

## Qué sigue (en orden)

1. PR #37 en verde → unir → Production «Ready» → humo sin cobrar → la hora de Vercel → aviso.
2. Recibir a los agentes A, B y C; revisar, verificar, consolidar. **Lote 2** = arnés + lo de A.
   **Lote 4** = Bloque 18 (y publicar la 1.0.2 en `canal-don-poncho`; comprobar que llega a una
   1.0.1 en la laptop). **Lote 5** = Fase D.
3. `pnpm exec playwright init-agents --loop=claude` (modelo sonnet, semilla en el arnés, salida en
   `pruebas/e2e/qa-final/`), cuando el lote 2 esté unido.
4. Fase E (inventario y recetas desde cero en un clon de `qa_dp22_base`), Fase F y Parte 7 (barrido
   completo y lo que falta: ver «Lo que falta» abajo), H5 (A7 y A9 en Playwright).
5. Fase H (día de bots 08:00–19:00, con otra semilla hasta que salga limpio).
6. Fase I: `configurar-produccion.mjs` (ensayo y luego en serio), dejar en ceros SÓLO si siguen
   siendo las 9 cuentas conocidas y no hay caja abierta (`--desde 2026-11-11 --ventas 9`),
   `--primer-folio`, `renombrar-aparatos.mjs`, verificación de sólo lectura.
7. `docs/reports/013-auditoria-final.md` (veredicto SÍ/NO, números, calificación, lista física de
   Miguel, lo grande para después) y el resumen en el chat.

## Lo que falta (Parte 7) y los dos agentes que siguen

La revisión de las 16 funciones mínimas está en `NUEVO.md` (primera pasada leyendo el código). Se
construyen cuatro: **pasar la mesa a otro mesero** (el comando existe, falta la pantalla), **lo más
vendido** (por platillo y por mesero, sumado en el servidor), **el aviso de insumo bajo** y **el
teléfono en para llevar**. Por medir: pasar un platillo de una cuenta a otra (si pasa de medio día,
va a la lista de Miguel). Por decidir: la nota por comensal.

Los encargos de los dos agentes siguientes ya están escritos, con huecos `{{…}}` para el árbol, la
rama, los puertos y los números de decisión; se lanzan en cuanto se libere un árbol:

- `D:\mpos-tmp\dp22\briefs\d1-salon-y-cocina.md`: el hallazgo 7, pasar la mesa a otro mesero, el
  teléfono en para llevar, H5 (A7 y A9 en el navegador) y las dos sobras del agente 2.
- `D:\mpos-tmp\dp22\briefs\d2-inventario-desde-cero.md`: la Parte 5 por pantallas sobre un clon de
  la copia (extendiendo el día 0 del simulador), el aviso de insumo bajo y «lo más vendido».

Lo de `playwright init-agents` ya está ensayado: lo generado quedó en
`D:\mpos-tmp\dp22\init-agents\` (los tres agentes ya traen `model: sonnet`) y
`node /d/mpos-tmp/dp22/adaptar-agentes.cjs /d/mpos-tmp/dp22/init-agents <raíz>` lo deja en el repo
apuntando al arnés (`.claude/agents/`, `.mcp.json`, `pruebas/e2e/qa-final/specs/`). Se corre sobre
el árbol del lote 2 cuando el agente A termine.

## Hechos que ya no hay que volver a averiguar

- Producción (sólo lectura, 21:15): 9 cuentas pagadas A-1 a A-9 (11-11 y 15-11), 1 caja cerrada
  («Caja 33»), 0 cajas abiertas, 35 terminales «Caja N», cupo 1, 0 almacenes, 0 insumos, 0 recetas,
  107 productos, 10 mesas libres, 10 personas, `impuesto` vacío, sin prefijo de folio, migraciones
  hasta la 193, `silenciar_notificaciones_admin = true`. Guion:
  `D:\mpos-tmp\dp22\revisar-produccion.mjs` (por la conexión de sesión 5432, nunca el 6543).
- **La copia con el catálogo real:** `qa_dp22_base` (clúster 5460), idéntica a producción a las
  21:36, con PIN de prueba en `D:\mpos-tmp\qa-dp22-base\`. Trae tres negocios de demostración: las
  consultas se filtran por la organización de Don Poncho. Se clona con
  `create database X template qa_dp22_base`. Día 0 del simulador sobre un clon:
  `bash /d/mpos-tmp/dp22/dia0.sh <nombre>` (necesita el `.next` construido del checkout principal).
- **El ensayo de la Parte 11 en clones** (`qa_dp22_config`, `qa_dp22_ceros`): configurar (la
  segunda corrida no escribe), el primer folio se niega con cuentas, dejar en ceros, primer folio
  1001 y 101, 35 aparatos renombrados y el día cero de un jalón; y se niega (sin borrar nada) con
  otro número de cuentas, con cuentas anteriores a `--desde`, con una caja abierta y con el negocio
  ya operando.
- Electron 45.3.2 trae **Chrome 156**; Playwright 1.63 trae Chromium 153. El arnés usa Chrome for
  Testing 156 (`D:/mpos-tmp/chromium-electron/156/`) y el motor viejo de `D:/mpos-tmp/chromium-viejo/`.
- El arnés: `playwright.qa-final.config.ts`, 14 aparatos (`pruebas/e2e/qa-final/arnes/aparatos.ts`),
  45 de 45 en tres perfiles y tres mutantes del arnés hacen fallar su autoprueba
  (`/d/mpos-tmp/dp22/arnes-mutantes.json`). `pict-node` está instalado con su binario bloqueado
  (`allowBuilds: pict-node: false`): las tablas se generan en local y se guardan en el repo con un
  verificador puro; la CI no baja nada.
- Skills externas en `.claude/skills/` (fuera de git): `webapp-testing`,
  `verification-before-completion`, `systematic-debugging`, `test-driven-development`, `browser-qa`.

## Decisiones de esta sesión (ya en `DECISIONES.md`)

DP-D146 (candados, merma, valor de inventario, X4) · DP-D147 (el método: mapa generado y oráculo) ·
DP-D148 (la puerta de `heredado/`) · DP-D149 (producción por guion, `pnpm dia-cero`,
`silenciar_notificaciones_admin` se queda encendido, H1 no se activa) · DP-D150 (los seis pendientes
del agente 2) · DP-D151 (anexo 012 y auditoría del 16-11) · DP-D152 (hoy = el día del negocio).
Reservadas: DP-D153 (Bloque 18), DP-D154 (agente A), DP-D155 (agente C).

## Trampas de esta etapa

- **Correr las unitarias COMPLETAS de la zona, no sólo las pruebas nuevas.** El lote 1 pasó la
  integración de los candados (27 de 27) y aun así rompió 18 unitarias de `restaurante/` que usan
  la base falsa (`pruebas/constructor-falso.ts` no sabía `in` dentro de un `or`), y un texto
  partido en dos renglones rompió el contrato de `destinos-de-los-textos`. Lo vio `verify-lote1`.
- **`pnpm install` SIEMPRE con `. "/d/MIS PROYECTOS/MORPHIQ POS/.work/env.sh"` cargado.**
- Nunca ejecutar `electron.exe` ni `chrome.exe` para preguntar la versión (cuelgan la orden).
- Los `heredoc` de Bash se comen las barras invertidas, y las comillas invertidas dentro de un
  `node -e "…"` se ejecutan: los archivos se escriben con la herramienta de archivos.
- El checkout principal tiene un `.env`: **fijar siempre `DATABASE_URL` a mano** antes de correr un
  guion contra una copia.
- Con `psql` en Windows, `export PGCLIENTENCODING=UTF8`.
- Con la laptop cargada, `pnpm lint` tarda 16 minutos y las unitarias se pasan de tiempo: los rojos
  por «Test timed out» se repiten solos antes de creerlos.
- Los agentes tienden a saltarse `verify:aspecto`: un cambio de clases o textos en `heredado/` se
  declara en `scripts/aspecto-permitido.json`.
- Las puertas de mutación sólo exigen limpio el archivo que mutan: se pueden editar documentos en
  el checkout principal mientras corren, pero no hacer commit ni `git add -A`.
- Tocar una pantalla retratada por la galería de la CI exige regenerar sus PNG de Linux:
  `gh workflow run verificar.yml --ref <rama> -f actualizar_galeria=true`.

## Cómo se corre aquí (laptop de Miguel, sin Docker)

- Entorno: `. "/d/MIS PROYECTOS/MORPHIQ POS/.work/env.sh"` (cachés en D:).
- `verify` por puertas, sin detenerse: `bash /d/mpos-tmp/dp22/verify-todo.sh [raíz] [desde] [salida]`
  (sin `verify:esquema`, `verify:rls` ni `verify:acople`, que leen la base compartida).
- Unitarias de una zona: `pnpm exec vitest run --project unidad <rutas>`.
- Integración: `DATABASE_URL_PRUEBAS="$(cat /d/mpos-tmp/dp22-url.txt)"` (clúster 55433).
- Mutantes: `node /d/mpos-tmp/dp22/mutantes.cjs <raíz> <lista.json>`.
- e2e: base desechable en el 5437 y servidor en el 3200 (`scripts/base-desechable.mjs`).
- Arnés: `MORPHIQPOS_CHROMIUM_ELECTRON=… MORPHIQPOS_CHROMIUM_VIEJO=D:/mpos-tmp/chromium-viejo pnpm
exec playwright test -c playwright.qa-final.config.ts <spec> --project=<aparato>`.
- Un guion del repo contra una copia local: cargar el entorno de la desechable
  (`scripts/base-desechable.mjs entorno`), fijar `DATABASE_URL` a la copia y `ORGANIZACION=don-poncho`.
- Producción, sólo lectura: `node /d/mpos-tmp/dp18/con-fase-b.mjs -- node /d/mpos-tmp/dp22/revisar-produccion.mjs`.
