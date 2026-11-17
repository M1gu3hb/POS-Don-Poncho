# PROGRESO · DP-22 · La auditoría final y el QA definitivo

> Si la sesión se corta o se compacta, **lo primero es leer `docs/qa-final/ESTADO.md`** y seguir
> desde ahí. Ésta es la bitácora larga: qué pasó y en qué orden. Sin secretos ni PIN aquí: viven
> en `..\_PRIVADO\`.

Empezó el lunes 16-11-2026 hacia las 20:50 (CDMX). Sin reloj fijo: la fecha de instalación se está
definiendo. Se trabaja en orden de importancia y se despliega cada lote en cuanto está en verde.

## Dónde está cada cosa

| Qué | Dónde |
| --- | --- |
| El estado para retomar | `docs/qa-final/ESTADO.md` |
| El plan | `docs/qa-final/PLAN.md` |
| El mapa total (generado) | `docs/qa-final/MATRIZ.md` y `qa/qa-final/datos/` |
| Los hallazgos | `docs/qa-final/HALLAZGOS.md` |
| Lo nuevo | `docs/qa-final/NUEVO.md` |
| Guiones y registros de la etapa | `D:\mpos-tmp\dp22\` (fuera del repo) |
| La copia con el catálogo real | clúster 5460, base `qa_dp22_base` (PIN de prueba en `D:\mpos-tmp\qa-dp22-base\`) |

## Arranque (16-11, 20:50 a 21:50)

- **Lectura:** `REGLAS.md`, `CONTEXTO.md`, `apps/web/AGENTS.md`, `DECISIONES.md` desde DP-D100, el
  informe 012 y su anexo, `PROGRESO-DP21.md`, `CONFIGURACION-MAPA.md`, el informe 011, el README del
  simulador, el RUNBOOK y el README de las apps. No hay `CLAUDE.md` ni `AGENTS.md` en la raíz (sólo
  los de `apps/web`), igual que en DP-21.
- **Repos:** el POS en `63977e1` y las apps en `d2d94ed`, los dos al día.
- **`pnpm install`:** el primer intento falló a medias (`ERR_PNPM_PACKAGE_MANAGER_REMOVE_MODULES_DIR`)
  por correrlo sin el entorno de cachés (`.work/env.sh`): pnpm cambió de almacén y quiso rehacer
  `node_modules`. Con el entorno cargado, en verde en 16 minutos. No es un defecto del repo: es una
  trampa de la laptop, ya anotada en `ESTADO.md`.
- **Producción, sólo leyendo** (conexión de sesión 5432, una transacción `read only` con `rollback`):
  9 cuentas pagadas (A-1 a A-9, $3,050.80), 1 caja cerrada, 0 abiertas, 35 terminales «Caja N»,
  cupo 1, 0 almacenes, 0 insumos, 0 recetas, 107 productos, 10 mesas libres, 10 personas, `impuesto`
  vacío, migraciones hasta la 193. Coincide con lo que dice el encargo.
- **La copia con el catálogo real:** exportación de sólo lectura de producción
  (`scripts/exportar-negocio.mjs --sin-archivos`, a `..\_PRIVADO\mudanza\`) e importación a
  `qa_dp22_base` en el clúster local con `qa/simulador/copia.ts`: 135 tablas y 1,873 filas idénticas
  al origen (filas y md5), con 10 PIN de prueba fuera del repo.
- **Skills:** de la cuenta, cargadas `morphiq-prs`, `contratos-por-mutacion`,
  `supabase-vercel-produccion` y `engineering:testing-strategy`; las demás se cargan al llegar a su
  fase. Externas (clonadas con `git`, leídas completas, en `.claude/skills/`, fuera de git):
  `webapp-testing` (anthropics/skills `e4bb5d9`), `verification-before-completion`,
  `systematic-debugging` y `test-driven-development` (obra/superpowers `22f0b46`) y `browser-qa`
  (affaan-m/ecc `8abdf32`). Ninguna pide mandar datos fuera ni correr código raro. `webapp-testing`
  es de Python: se usa su método (reconocer y luego actuar), no sus guiones. Ya estaban instaladas
  `dispatching-parallel-agents`, `subagent-driven-development` y `using-git-worktrees`.
- **El motor de los POS:** Electron 45.3.2 trae Chrome 156.0.8078.100 (leído del binario, sin
  ejecutarlo); Playwright 1.63 trae Chromium 153. El arnés usa Chrome for Testing 156.
- **Agentes (Sonnet, sin commit, cada uno en su árbol):** el 1, Bloque 19 A (H2, A24, la devolución
  por peso, X4); el 2, Bloque 19 B (H3, A23, A5, A6, A10, X5); el 3, el arnés táctil.
- **El mapa total:** `scripts/qa-final/generar-matriz.mjs` saca del código 34 pantallas (28 con
  sesión) con 107 ventanas, 78 ajustes del negocio y 18 de este aparato, 104 flujos, 124 comandos
  (32 sin pantalla, lo mismo que contó el anexo 012) y 26 entidades del puente. Los puestos de cada
  ruta se le preguntan a la misma función que usa el armazón de la app.

### Lo que el encargo dice y el repo no (gana el repo)

- `pnpm verify` completo no corre en la laptop (sin Docker): va por puertas, sin `verify:esquema`,
  `verify:rls` ni `verify:acople` (leen la base compartida; la CI tampoco los corre).
- El encargo pide instalar las skills externas con `npx skills add`: se clonaron con `git` (el
  propio encargo lo da como alternativa) para leerlas antes de que nada se ejecute.
- «1920×1080 a su escala real» del iMin: no hay dato de su densidad; se prueban las dos probables.

## Línea base (16-11, 21:50 a 22:50)

`verify` sobre `main` (`63977e1`), puerta por puerta (`verify-todo.sh`), con tres agentes
trabajando a la vez en la laptop:

- Todas las puertas estáticas, de contratos y de mutación: en verde.
- Unitarias: 4 pruebas se pasaron de tiempo con la laptop cargada (`portal/avisos-caducados`,
  `sonidos/sonidos`, `validacion/cuerpo-inerte.contrato`, `venta/categorias-de-gasto.contrato`) y
  `verify:cabeceras` no alcanzó a arrancar su servidor en 30 s. Repetidas solas, todas pasan: no
  son defectos.
- Integración contra Postgres: 770 de 772. Las dos que fallaron son de
  `tablero/serie.integracion.test.ts` y fallan sólo de noche: **es el Hallazgo 1** (después de las
  18:00 de México «hoy» era mañana). De día pasan, por eso la CI nunca lo vio.

## Lotes

Cada lote: qué lleva, su PR, la CI, el despliegue, el humo y los errores de Vercel en la hora
siguiente.

### Lote 1 · PR #37 (`dp-22-arranque` → `main`) · sin migraciones

- **Qué lleva:** el Bloque 19 entero (H2, A24, la devolución por peso o porción, X4, H3, A23, A5,
  A6, A10, X5), la puerta `verify:heredado` en `verify` y en la CI, el Hallazgo 1 (el día del
  negocio en once pantallas y en el servidor), lo decidido del anexo 012 y de la auditoría del
  16-11 (`PUBLICOS` en tres claves, sin cola de sincronización en la Caja, «Hecho por MORPHIQ»,
  quién anuncia las comandas), el mapa total, el oráculo del dinero, `configurar-produccion.mjs` y
  `pnpm dia-cero` (RUNBOOK §8). Decisiones DP-D146 a DP-D152.
- **Cómo llegó:** tres agentes Sonnet (ramas `dp-22-b19`, `dp-22-b19b`, `dp-22-lote3`), cada uno
  revisado, con sus pruebas corridas por la sesión principal y mutantes propios; unidos en
  `dp-22-arranque` con el arranque y el Hallazgo 1.
- **Lo que cazó la verificación completa del lote** (`verify-lote1`, 23:16 y 23:22): un error de
  lint (`Number()` de más, `6ce290a`) y 19 unitarias en rojo que las corridas por zona no habían
  visto (la base falsa de las pruebas no sabía `in` dentro de un `or`; un texto partido en dos
  renglones rompía el contrato de los destinos de Configuración). Arreglo: `7a51e29`. Ninguna
  llegó a `main`.
- **Lista de despliegue (skill `engineering:deploy-checklist`, ajustada a este repo):**
  - Antes: la CI del PR en verde (10 trabajos); sin migraciones (nada que ensayar en la base); el
    diff revisado por la sesión principal; ningún PIN ni secreto (revisión de PIN en cada commit).
  - Línea base de Vercel (23:41): **0 errores de ejecución en las últimas 24 h**; producción en
    `63977e1` (despliegue `dpl_367dry…`, candidato a regreso).
  - Plan de regreso: «Instant Rollback» de Vercel al despliegue `dpl_367dry…` (sin migraciones, el
    regreso es sólo de código) y después un PR que revierta la unión.
  - Disparadores del regreso: el humo falla; la entrada (`/login-pos`) no responde 200; una clase
    nueva de error en Vercel durante la hora siguiente.
  - Después: humo sin sesión y sin cobrar (`/d/mpos-tmp/dp22/humo-produccion.sh 1`), lectura de
    producción por la 5432 (nada cambió en los datos) y Vercel en la hora siguiente.
- **La CI:** la primera corrida completa (`7a51e29`) quedó en 9 de 10: «Jornada completa» falló en
  `pruebas/e2e/sonidos.spec.ts` por una suposición vieja de la prueba (la dueña en Cocina esperaba
  el timbre; con DP-D151 sólo anuncia el puesto de cocina). Se corrigió la prueba (`64bb750`), se
  corrió en local en los tres aparatos con su mutante, más las tres suites que la CI no alcanzó.
  Segunda corrida: **10 de 10** (17-11, 05:59).
- **Despliegue (17-11):** unido a `main` como `ff03687` a las 05:59; producción ya servía el lote a
  las 06:01 (la ruta nueva `/api/registros/resumen` pasó de 404 a 403).
- **Humo sin sesión y sin cobrar** (`humo-produccion.sh 1`, 06:01): 38 revisiones, 0 fallas: las
  entradas responden, sin sesión todo contesta 401 o 403, las rutas nuevas existen, las de siempre
  siguen en pie, cabeceras de seguridad, el portal y «Hecho por MORPHIQ» en la entrada.
- **Producción, sólo lectura (05:50):** las mismas 9 cuentas de prueba (A-1 a A-9), 1 caja cerrada,
  0 abiertas, 10 mesas libres, migraciones hasta la 193. El lote no lleva migraciones.
- **Vercel:** 0 errores de ejecución al desplegar y **0 en la hora siguiente** (revisado a las
  07:12, ventana de 2 h). **Lote 1 cerrado.**

### Lote 2 · PR #38 (`dp-22-lote2-pr` → `main`) · sin migraciones

Rama `dp-22-lote2-pr` (checkout principal, sobre `main` ya con el lote 1). Lleva:

- **El arnés táctil** (`dp-22-arnes`: 14 aparatos, toque real, revisiones automáticas; 45 de 45 en
  tres perfiles; tres mutantes del arnés tumban su autoprueba) y los tres agentes de prueba de
  Playwright (`.claude/agents/`, `model: sonnet`) con su semilla en el arnés.
- **La Fase D** (rama `dp-22-ajustes`, agente C, revisada): las ternas del dinero y los pares de
  ajustes contra el oráculo, los 11 cambios a media operación, y tres arreglos que salieron de ahí
  (hallazgos 8, 9 y 10).
- **El Bloque 18, lado POS** (rama `dp-22-b18`, agente B, revisada): el PDF del corte se guarda en
  la carpeta de la app de Windows 1.0.2.
- **Lo que cazó la CI antes de unir** (nada llegó a `main`): (1) `verify:primitivas`: dos botones
  del cierre con alto fijo (`min-h-11`) en vez del token (`1206b4c`); (2) dos contratos de la suite
  unitaria completa: los ayudantes de las pruebas de la Fase D escribían en la base fuera de una
  carpeta `pruebas/` (se movieron a `packages/app/src/qa-final/pruebas/`) y el folio que se vuelve
  nombre de archivo no estaba declarado en `folio.contrato.test.ts`. Lección: antes de abrir un
  PR se corren TODAS las puertas estáticas y la suite unitaria COMPLETA, no sólo las zonas.
- **La app 1.0.2** (repo de las apps, rama `exe-1.0.2`, PR morphiq-pos-apps#2): construida; humo de
  la app EMPAQUETADA 10 de 10 (carga el POS de producción, la capacidad `archivos` a la vista, un
  no-PDF rechazado sin escribir nada). Sin publicar todavía.
- **La CI:** tercera corrida (`9965fb8`), **10 de 10** (07:52), con la integración contra Postgres,
  la construcción y las puertas de mutación.
- **Despliegue (17-11):** unido a `main` como `829b13d` a las 07:53; el despliegue de producción
  quedó «READY» a las 07:55 (`dpl_2W6ZV4…`). Regreso previsto: el despliegue del lote 1
  (`dpl_3JDNeS…`); sin migraciones.
- **Humo sin sesión y sin cobrar** (`humo-produccion.sh 2`, 07:56): 38 revisiones, 0 fallas.
- **Vercel:** 0 errores al desplegar y **0 en la hora siguiente** (revisado a las 09:00, ventana
  de 2 h). **Lote 2 cerrado.**
- **En local**, sobre la rama del lote: las puertas de mutación, la construcción, el modo
  compatible, la cobertura y la integración completa contra Postgres en verde (08:47); la suite
  unitaria completa (las 4 que se pasaron de tiempo con la máquina cargada pasan solas); tipos,
  lint y formato de lo tocado. `verify:cabeceras` no alcanzó a arrancar su servidor en 30 s con la
  máquina cargada (igual que en la línea base) y repetida sola pasa.
- **La app 1.0.2, publicada y vista llegar (17-11, 08:03 a 08:07):** PR morphiq-pos-apps#2 unido
  (`37ec070`); release `don-poncho-v1.0.2`; canal `canal-don-poncho` con `latest.yml` en 1.0.2. En
  la laptop: la 1.0.1 publicada (misma suma) instalada y abierta a las 08:04:11; a las 08:04:44 ya
  había bajado la 1.0.2; salió el aviso «POS Don Poncho tiene una actualización · La versión 1.0.2
  ya está lista» (`D:\mpos-tmp\dp22\aviso-actualizacion.png`); «Reiniciar ahora» a las 08:06:14 y
  a las 08:07:11 lo instalado era la 1.0.2. Esa primera vez la app no se volvió a abrir sola: la
  había lanzado esta consola, no una persona.
- **Los dos caminos de la actualización, repetidos abriendo la 1.0.1 desde el Explorador (10:03 a
  10:14, `D:\mpos-tmp\dp22\prueba-actualizacion.sh`):** con «Reiniciar ahora», el aviso salió a
  los 24 s de abrir y 22 s después estaba instalada la 1.0.2 y la app ABIERTA OTRA VEZ sola; con
  «Al cerrar», al cerrar la app con normalidad quedó instalada la 1.0.2 en 25 s (y la app,
  cerrada, como debe). No hay defecto.
- **Lo que no se puede probar aquí** (DP-D162): el POS dentro de Electron contra el servidor local
  (la app sólo acepta `https://` y el dominio exacto de producción, a propósito: se queda el
  Chromium 156 del arnés más el humo de la app empaquetada) y guardar el PDF de un corte de punta
  a punta en la app instalada (haría falta cerrar una caja en producción con un PIN real). Lo
  segundo va a la lista física de Miguel.

El barrido de servicio y los hallazgos 2 a 6 (agente A, rama `dp-22-lote2` en `.work\dp20-lab`) y
lo de salón y cocina (agente D1, rama `dp-22-salon`) van en el lote siguiente.

### Lote 3 · PR #39 (`dp-22-tercer-lote` → `main`) · migración 194 (aditiva)

Rama `dp-22-tercer-lote` (checkout principal, sobre `main` ya con el lote 2). Lleva:

- **Salón y cocina** (rama `dp-22-salon`, agente D1, revisada): el hallazgo 7 (la comanda que se
  quedaba en «nuevo» al quitar el otro platillo), «Pasar la mesa a otro mesero» (DP-D156), el
  teléfono opcional en para llevar (DP-D157, **migración 194**), A7 y A9 con el dedo en tableta
  (H5), y dos sobras de DP-21 (la tarjeta de propinas del Tablero suma en el servidor; «Imprimir
  prueba» con el plazo de 20 s de la Caja).
- **Inventario** (rama `dp-22-inventario`, agente D2, revisada): el aviso de insumo bajo en el
  Tablero (DP-D159), «Lo más vendido» en Registros (DP-D160) y el hallazgo 15 (la regla del mínimo
  con existencia en negativo). De la Parte 5, lo hecho por pantallas está en `qa/simulador/parte5/`.
- **Lo que cazó la CI antes de unir** (nada llegó a `main`): (1) al unir `dp-22-inventario` quedó
  un conflicto sin resolver en `scripts/aspecto-permitido.json` (la lista de conflictos se cortó
  con `head`); el JSON dejó de leerse y fallaron `format:check`, `verify:aspecto` y «Contratos y
  mutaciones» (`e33e2d9`). (2) `verify:cobertura`: los dos imports de «Pasar la mesa» empujaron la
  etiqueta `PANTALLA · restaurante · mesa-activa` de la línea 60 a la 62 y la puerta sólo lee 60;
  el comentario de cabecera sube a justo debajo de `'use client'` (`6931ff1`). Lecciones: tras una
  unión con conflictos, lista completa y `git grep` de marcas antes de confirmar; y
  `revisar-rama.sh` ya corre `verify:cobertura`, `verify:tsconfig`, `verify:entorno`,
  `verify:historico` y `verify:modo-compatible`, que antes no corría.
- **En local**, sobre la rama: todas las puertas estáticas, formato, tipos, la suite unitaria
  completa, la integración contra Postgres (restaurante, registros, inventario, qa-final, compras y
  caja) y lint, en verde (`D:\mpos-tmp\dp22\revision-lote3.log`).
- **La galería de la CI:** regenerada para esta rama (81 retratos); 8 difieren en ruido de
  antialias y no se cambiaron: la comparación de la CI pasó con los retratos que ya estaban.
- **La CI:** segunda corrida (`6931ff1`), **10 de 10**.
- **La migración 194 en producción (17-11, 15:02):** lectura de antes igual a la línea base (9
  cuentas de prueba A-1 a A-9, 1 caja cerrada, 0 abiertas, migraciones hasta la 193); ensayo
  (`migrar-produccion.sh ensayo`: aplica y revierte) correcto; aplicada con `pnpm db:migrate` por
  la conexión de sesión (5432). Es una columna nueva que admite nulo y su `check`: ninguna fila
  cambia y el código anterior no la nombra.
- **Despliegue (17-11):** unido a `main` como `e4c45f5` a las 15:03; el despliegue de producción
  quedó «READY» a las 15:05 (`dpl_5tVaqE…`). Regreso previsto: el despliegue del lote 2
  (`dpl_2W6ZV4…`); la columna nueva puede quedarse (el código anterior no la usa).
- **Humo sin sesión y sin cobrar** (`humo-produccion.sh 3`, 15:05): el humo de siempre 27 de 27,
  las rutas de los lotes 1 y 3 existen y exigen sesión (`inventario/insumos-bajos` y
  `registros/lo-mas-vendido` contestan 403), una ruta inventada contesta 404. **0 fallas.**
- **Lectura de producción después (15:06):** idéntica a la de antes salvo las migraciones (126
  aplicadas, la última la 194). Ninguna cuenta, caja ni ajuste cambió.
- **Vercel:** 0 errores al desplegar. Falta la revisión de la hora siguiente (a partir de las
  16:05).
