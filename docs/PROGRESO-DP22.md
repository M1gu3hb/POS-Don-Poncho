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
- **Vercel:** 0 errores al desplegar y **0 en la hora siguiente** (revisado a las 16:06, ventana
  de 2 h). **Lote 3 cerrado.**

### Lote 4 · PR #40 (`dp-22-cuarto-lote` → `main`) · migración 195 (aditiva)

Rama `dp-22-cuarto-lote` (checkout principal, sobre `main` ya con el lote 3). Lleva, cada cosa
leída y con mutantes propios encima de los del agente que la hizo:

- **El costo exacto de los insumos** (agente D3; hallazgo 14, DP-D165, **migración 195**): el costo
  por gramo, mililitro o pieza en diezmilésimas de centavo, con un solo redondeo. Siete compras de
  $12,000.00 valían $11,948.50 en «Valor de inventario»; ahora, $12,000.00.
- **El barrido de servicio en 14 aparatos** (agente A; DP-D154): 29 revisiones por aparato; los
  hallazgos 2, 3 y 4 arreglados (nombres accesibles, contraste, 44 px con el dedo por componente),
  el 5 y el 6 descartados; el aviso de Cocina para quien no la anuncia.
- **Configuración comprobada** (agente E, dos tandas; DP-D163, DP-D164 y DP-D166): 77 puntos con su
  prueba; los hallazgos 18 y 19 arreglados; el 20 (el cierre en el iMin) y el 21 descartados al
  reproducirlos; el aviso del PDF del corte dice que la caja sí se cerró.
- **Inventario** (agente G, primera tanda; DP-D167 a DP-D170): la merma manual, el traspaso y la
  devolución copian el costo (hallazgo 23); el consumo interno funciona (22); la Caja relee
  también con `PROPINA_VIGENTE` (12); el 13 no se reproduce; el 16 no se construye; el 17
  descartado.
- **Lo que cazó la CI antes de unir** (nada llegó a `main`): (1) **la migración 195 no corría en
  una base nueva:** ahí todas las migraciones van en una transacción y su `update` tocaba las
  filas de demostración de la 042 y la 043, que llevan un motivo escrito a mano; Postgres vuelve a
  comprobar la llave `movimientos_stock_motivo_conocido` y rechaza. Ahora `movimientos_stock` se
  rellena reescribiendo la columna (`ae66054`); en producción no habría fallado (no tiene esas
  filas y la 195 se aplica sola), pero la CI migra desde cero. (2) 8 errores de lint en guiones
  nuevos de la Parte 5 (uno escondía una expresión que no distinguía «Mesa 4» de «Mesa 41»).
  (3) Una constante declarada dos veces al unir las dos tandas de Configuración. (4) Las pruebas
  viejas encontraban dos botones «Cerrar» en la precuenta y el ticket desde que la «X» de los
  diálogos heredados dejó de llamarse «Close» (`04c3875`). (5) La galería: 18 retratos
  regenerados y mirados (`1023576`). Lecciones: tras unir un parche, `tsc` de `pruebas/` y del
  simulador y lint de lo tocado, mirando el código de salida; y una migración con relleno se
  prueba TAMBIÉN desde cero (`node /d/mpos-tmp/dp22/crear-base.mjs dp22_<algo> --recrear` y
  `migrate`).
- **En local:** las 30 puertas estáticas, formato e integración contra Postgres (restaurante,
  registros, inventario, qa-final, compras, caja, portal, venta, puente) en verde; las 127
  migraciones desde cero; la suite unitaria completa se pasó de tiempo en 8 archivos con la
  máquina cargada (solos pasan) y en la CI pasa entera.
- **La CI:** quinta corrida (`1023576`), **10 de 10**, con «Jornada completa» entera y la galería.
- **La migración 195 en producción (17-11, 20:35):** lectura de antes idéntica a la del cierre del
  lote 3; ensayo (`migrar-produccion.sh ensayo`: aplica y revierte) correcto; aplicada con
  `pnpm db:migrate` por la conexión de sesión (5432). Con la migración puesta y el código
  ANTERIOR todavía desplegado, el humo siguió en 0 fallas (lo aditivo primero).
- **Despliegue (17-11):** unido a `main` como `6b76050` a las 20:37; el despliegue de producción
  quedó «READY» (`dpl_H1Z697…`). Regreso previsto: el despliegue del lote 3 (`dpl_5tVaqE…`); las
  columnas nuevas pueden quedarse (el código anterior no las nombra y el disparador las completa).
- **Humo sin sesión y sin cobrar** (`humo-produccion.sh 4`): el de siempre 27 de 27 y las rutas de
  los lotes anteriores en pie. **0 fallas.**
- **Lectura de producción después:** idéntica a la de antes salvo las migraciones (127 aplicadas,
  la última la 195). Ninguna cuenta, caja ni ajuste cambió.
- **Vercel:** 0 errores al desplegar y **0 en la hora siguiente** (revisado a las 21:43, ventana
  de 2 h). **Lote 4 cerrado.**

### Lote 5 · PR #41 (`dp-22-quinto-lote` → `main`) · sin migraciones

Rama `dp-22-quinto-lote` (checkout principal, sobre `main` ya con el lote 4). Lo armó y lo llevó
hasta la CI en verde el agente de entrega; el costo por medida lo hizo el agente I y el de entrega
lo auditó con mutantes propios. Lleva:

- **El día de bots** (DP-D175 y DP-D176).
- **La Parte 5 completa por pantallas**, 62 de 62 contra el libro, con sus arreglos: el hallazgo 12
  (corregido de verdad, DP-D172), el 24 (la merma de Ajustar se anota como merma, DP-D171), el 29
  (el portal ya no enseña lo oculto del POS, DP-D174), el 30 (la merma con existencia negativa se
  registra, DP-D173) y el 36 (nombre accesible en el editor de receta).
- **La Parte 7 en la app:** el hallazgo 31 (arqueo por billetes y monedas, DP-D178), el 32 (quién
  autorizó una cancelación, DP-D179), el 33 (búsqueda sin acentos, DP-D178) y el tiempo de la mesa
  (DP-D177).
- **El costo de lo vendido por medida** (hallazgo 27, DP-D180) y el botón y el aviso de compras
  (hallazgo 28, DP-D181).
- **Lo que cazó la CI o la auditoría antes de unir** (nada llegó a `main`): (1) `verify:aspecto`
  falló porque dos archivos heredados (Ajustar stock y el editor de receta) habían cambiado sin
  declararse: se declararon (`66fe3c9`). (2) En la auditoría del costo por medida, uno de los
  cuatro mutantes propios SOBREVIVÍA: la prueba de «receta igual» era vacía porque los insumos de
  la receta tenían costo 0; se reforzó dándoles costo exacto y el mutante murió (4 de 4 como se
  esperaba). (3) Una línea sin formato de `scripts/venta/mutaciones.mjs` (prettier). (4) La
  galería: 9 de 81 retratos regenerados y mirados (Compras, Inicio, Inventario y Platillos), sin
  texto cortado, encimado ni desbordado.
- **La CI:** 10 de 10 en el commit `0f107d1`, con «Jornada completa» y los rastreos.
- **Despliegue (17-11):** unido a `main` como `e4e0a70` a las 23:45; el despliegue de producción
  quedó «READY» (`dpl_CdXRHVCo…`) hacia las 23:48. Regreso previsto: el del lote 4 (`dpl_H1Z697…`).
- **Humo sin sesión y sin cobrar** (`humo-produccion.sh 5`, 23:49): **0 fallas.**
- **Lectura de producción después:** idéntica a la del lote 4 (no hubo migración).
- **Vercel:** 0 errores al desplegar; la hora siguiente se revisó a las 00:50 del 18-11 (ventana
  de 2 h, que cubre también las escrituras de la Parte 11): 0 errores. **Lote 5 cerrado.**

### Lote 6 · PR #42 (`dp-22-sexto-lote` → `main`) · sin migraciones

Rama `dp-22-sexto-lote`, sobre `main` ya con el lote 5. Lo llevó el agente de entrega (informe
`r-lote6.md`). Lleva:

- **«Cambiar de mesa» en la hoja del pedido del teléfono del mesero** (hallazgo 37, DP-D182): la
  página calcula la regla una vez (`puedeCambiarDeMesaAqui`, con `puedeMoverLaCuenta`: dirección
  siempre, el mesero sólo en sus mesas, nunca una mesa unida) y la comparten el panel de la tableta y
  la hoja del teléfono. No toca dinero ni inventario. Prueba de contrato 3 de 3; auditado con 3
  mutantes propios, uno sobrevivía (el botón sin llamar a `alCambiarDeMesa`: la prueba sólo buscaba el
  nombre) y se reforzó.
- **Los arreglos del simulador** que dejó el día de bots (DP-D183) y la bitácora del lote 5, la Parte
  11 y el día de bots.
- **La CI:** 10 de 10 en el commit `3a102d4`. Galería: 12 de 81 retratos difieren sólo por ruido de
  dibujo (2 a 125 píxeles, diferencia máxima 17/255); abiertos Configuración (papel) e Inventario
  (noche), idénticos a la vista; no se copiaron.
- **Despliegue (18-11):** unido a `main` como `ca7e6f1` a las 10:48; producción «READY»
  (`dpl_C3cYV8xD…`) a las 10:52. Regreso previsto: el del lote 5 (`dpl_CdXRHVCo…`).
- **Humo sin sesión y sin cobrar** (`humo-produccion.sh 6`, 10:53): **0 fallas.**
- **Lectura de producción después:** idéntica a la de después de la Parte 11 (`produccion-final.txt`).
- **Vercel:** 0 errores al desplegar y 0 en la hora siguiente (revisado a las 11:55, ventana de 2 h).
  **Lote 6 cerrado.**

### Lote 7 · PR #43 (`dp-22-septimo-lote` → `main`) · sin migraciones

Rama `dp-22-septimo-lote`, sobre `main` con el lote 6 (`ca7e6f1`). Lo armó el agente de entrega con
el trabajo de cuatro agentes y el informe 013. Lleva:

- **Lo visual (agente V, DP-D186 a DP-D188):** los hallazgos 34 (la barra flotante se esconde mientras
  se escribe), 38 (con la cuenta pedida la barra se queda con «Cuenta pedida» y «Cambiar de mesa»), 35
  en parte («Imprimir otra hoja de la precuenta»; el «—» del total se queda: es de rol caja), 26
  («Entregar el turno» y «Retirar» a la misma altura) y el resto del 5 (el menú lateral avisa que hay más).
- **Configuración comprobada (agente C, DP-D190):** el arnés táctil de Configuración; 88 de 113 puntos
  comprobados, 1 por ver y 3 por comprobar. Su prueba de «Borrar todos los datos» está en rojo (no
  demostrado).
- **Los flujos (agentes M y T, DP-D194):** la matriz con 0 flujos sin prueba y 2 «no aplica»; pruebas de
  cantidades del carrito, cortesía y calificación de la visita; el estado «no aplica» del generador.
- **El simulador (B4):** el guion y el árbitro tras el cuarto día de bots (D22-081, 055 y 036).
- **El informe 013** (auditoría final, veredicto «NO todavía») y esta bitácora.
- **Hallazgos nuevos** (39 a 43), anotados y sin arreglar.
- **Auditoría de la entrega:** 2 mutantes propios sobre lo visual del mesero sobrevivían a la prueba de
  contrato; se reforzó y mueren.
- **Galería (corrida 44432190548, success):** los 81 retratos de Linux difieren, y **sólo en la barra
  lateral** (nada cambia fuera de sus 250 px de la izquierda): el degradado y la flecha al pie del menú
  porque en 1280×720 «Portal QR» queda cortado. Abiertos Portal QR (bloque) y mesero (don-poncho),
  nuevo contra guardado: el último elemento se desvanece bajo una flecha y se lee «hay más»; nada
  cortado ni encimado. Se copiaron los 81.
- **Comprobado en local (códigos reales):** `comprobar-lote5.sh` todo `=0` y `eslint-errores=0`;
  `test:unit` 680 archivos y 7,307 pruebas (3 omitidas); `verify:residuos`, `estructura`, `venta`,
  `estilos` y `adopcion` en 0; `qa:matriz` y `--verificar` en 0; prettier en 0.

### Lote 8 · PR #44 (`dp-22-octavo-lote` → `main`) · sin migraciones

Rama `dp-22-octavo-lote`, sobre `dp-22-septimo-lote` (lote 7), hecho la noche del 18-11. Cinco cosas chicas, cada una con su
prueba que fallaba antes y pasa después:

- **El mapa de mesas de Configuración a 1366×768 al 125 % (hallazgo 39, DP-D195):** el lienzo se reduce al ancho
  disponible (`data-escala`) y guarda coordenadas lógicas; ninguna mesa cortada en Windows, iMin ni tableta.
- **La hoja del carrito del teléfono (40, DP-D196):** se cierra sola al quedar vacío el carrito.
- **El aviso «Solicitud enviada» del portal (41, DP-D197):** ya no se pinta sobre la valoración.
- **`experiencia.sonidos_en_el_portal`:** corrida y demostrada en sus dos estados (necesita el servidor con
  `ORGANIZACION=<slug>`, como en un despliegue de un negocio).
- **«Reiniciar sistema» → «Borrar todos los datos»:** demostrado contando filas (qué borra y qué conserva, el otro
  negocio intacto, la app usable). Hallazgo 44 (bajo): la pantalla prometía resetear la configuración y el comando
  no lo hace; se corrigió el texto (DP-D198). La falla de la prueba del lote 7 era el límite de tasa (tres por hora y
  un nombre mal escrito cuenta), no la app.
- **Efectos:** 90 comprobados, 0 por ver en navegador, 2 por comprobar (impresora y cajón, laboratorio: aparato real).
- **Galería (corrida 44443693460, success):** 9 de los 81 retratos de Linux difieren de los guardados por ruido de pintado (de 11 a 120 píxeles por imagen, diferencia máxima de 17 niveles en un canal, en pantallas que este lote no toca); el de Configuración muestra «El negocio», no el mapa. No se copió ninguno.
- **Mutantes:** 5 de contrato mueren y 1 inocuo pasa (`lote8-mapa-carrito-aviso.contrato.test.ts`); el código anterior
  es el mutante de las pruebas e2e (fallan sobre la compilación sin los arreglos).

## Parte 11 · Producción configurada y en ceros (17-11)

De las 23:50 a las 23:58, con `bash /d/mpos-tmp/dp22/parte11.sh`:

- **Antes:** 9 cuentas de prueba (A-1 a A-9, del 11 al 15-11, todas cobradas), 1 caja cerrada, 0
  abiertas.
- **`configurar`** (ensayo y luego de verdad; 5 comandos firmados, con auditoría): IVA «Sin IVA»;
  prefijo de folio «DP»; dos cajas a la vez, «Caja 1» y «Caja 2»; «Almacén principal». Ya estaban:
  la propina la eligen comensales y Caja; el ticket y la precuenta con todos sus renglones;
  «silenciar notificaciones del administrador» encendido.
- **`ceros 9`** (el ensayo confirmó que sólo había lo de prueba): 9 cuentas purgadas, 16 comandas, 2
  carritos, 5 solicitudes del portal, 1 caja con sus movimientos; folios reiniciados. La auditoría
  se queda.
- **`primer-folio`:** 1001 (cuentas) y 101 (cortes). **`aparatos`:** 35 «Caja N» → «Aparato N».
- **Verificación de sólo lectura** (`produccion-final.txt`): 0 cuentas, 0 cajas, 0 comandas, 0
  carritos, 0 pagos, 10 mesas libres, siguiente folio DP-01001 (A=1001, CC=101), 35 aparatos sin
  ningún «Caja N», «Almacén principal», impuesto 0 puntos base, migraciones hasta la 195.
- **`pnpm dia-cero`** (ensayo, no escribe): «nada que borrar». Lo único que falta es el bloqueo
  del arranque (H1), que **no** se activó en esa sesión a propósito: lo activa
  `pnpm dia-cero -- --en-serio` después de la prueba física de Miguel.

## El día de bots (Parte 10)

Cinco días de 8:00 a 19:00 (×4, árbitro cada hora), semillas 2211 a 2215, con la máquina sola. Los tres
primeros sobre el commit `b1d630d` (más los arreglos que se le fueron sumando); el 2214 y el 2215 sobre
el código del lote 6 (`957f143` en la rama local de pruebas) y, el 2215, con tres arreglos del guion y
del árbitro. Informes en `D:\mpos-tmp\dp22\informes\`: `b-dia.md` (los tres primeros) y `b-dia-4.md`
(el 2214 y el 2215). Entre medias hubo dos arranques cortados a propósito (2212 a las 10:30 y a las
9:30) para arreglar y recompilar; no cuentan.

| Semilla | Duración | Cobros                    | Importe    | Lo que dijo el árbitro                                                                                                                                         | Incidentes                              |
| ------- | -------: | ------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 2211    |  188 min | 171 (50 mesa, 121 llevar) | $64,878.10 | 0 diferencias en 11 horas y cierre (1,533 comparaciones), 0 5xx, 0 consola                                                                                     | 289 (2 «críticos» de dinero, del guion) |
| 2212    |  169 min | 154 (62 mesa)             | $84,528.20 | 0 en el cierre; 2 «críticos» a las 14:00 (guion del árbitro)                                                                                                   | 139                                     |
| 2213    |  168 min | 174 (68 mesa, 106 llevar) | $69,641.50 | 0 diferencias en las 11 horas y el cierre (1,562 comparaciones), 0 5xx, 0 consola sin explicar                                                                 | 76: 0 críticos, 0 altos, 0 «dinero»     |
| 2214    |  188 min | 177 (65 mesa, 112 llevar) | $63,425.44 | 0 diferencias de 9:00 a 17:00; 1 «crítica» a las 18:00, 19:00 y en la última revisión (Shot de tequila: libro 6/7, base 8/9, error del árbitro); cierre: 0 de 1,640. 0 5xx, 0 consola | 1 crítico, 0 altos, 24 medios           |
| 2215    |  168 min | 163 (57 mesa, 106 llevar) | $67,947.72 | 0 diferencias en las 11 horas y el cierre (1,523 comparaciones); 0 5xx; 0 consola sin explicar                                                                 | 0 críticos, 0 altos, 17 medios          |

- **2211** (código sin arreglos): 33 mesas, 17 portal, 6 unidas, 7 cambios de mesa, 1 dividida, 8
  cancelaciones; 9,277 toques, 0 clics. **2212** (tras DP-D182): 36 mesas, 8 unidas, 21 cambios, 3
  divididas, 13 cancelaciones; 10,644 toques. **2213** (con todos los arreglos de guion): 44 mesas,
  13 pedidas por portal (32 pedidos), 10 unidas, 27 cambios de mesa, 8 divididas, 17 cancelaciones,
  3 cortes; 11,036 toques, 0 clics. **2214:** 40 mesas, 18 por portal, 8 unidas, 29 cambios de mesa, 5
  divididas, 11 canceladas; 11,917 toques, 0 clics de ratón. **2215:** 18 por portal (37 pedidos), 6
  unidas, 23 cambios de mesa, 3 divididas, 13 canceladas; 11,025 toques, 0 clics de ratón.
- **Lo juzgado.** De la app, uno: «Cambiar de mesa» no se ofrecía al mesero en el teléfono (hallazgo 37,
  DP-D182, lote 6). Del guion: «Marcar entregado» (13 de 13 casos fueron una entrega ajena de
  segundos antes), zonas y selectores del teléfono, la pregunta «¿Separar mesas o dejarlas
  unidas?» sin contestar (encadenó ~200 fallos), tres «críticos» de dinero (la propina que la Caja
  eligió quedaba fijada tras red caída o recarga y el libro no la sabía) y, en el 2214, el diálogo
  «Mesa 8 · cuenta 2 de 2» que la Caja no halló (la guarda del rótulo): la cuenta 2 ($2,007) quedó sin
  cobrar y arrastró alertas de cierre (D22-055, 089, 090 y 092); en el 2215, S1r (la 14 vive en la
  Terraza y el guion contaba la mesa antes de que React la pintara; D22-036, **sin verificar en un
  día**). Del árbitro (sin relajar el oráculo): al dividir una cuenta la pieza nueva entra a la misma
  comanda con otra hora y el corte por fila contaba una menos (DP-D183); y en el 2214 (D22-081, crítico)
  una línea de 3 «Shots» cobrada en 3 partes que la división parte en 3 filas, dos nacidas a las 17:52
  contra la comanda de las 17:40: contaba filas, 8 contra 6, con el dinero cuadrado; ahora cuenta por
  porción (`hora.ts`, con prueba y mutante). De medición: la Caja «abre la cuenta pendiente» medía
  2.9 s, ~1.5 s de toques del bot.
- **Caos.** En la 2213 se ejecutaron todos menos R1 (traslado de la Caja 2): el plan lo ponía al
  minuto 420 y caía a las 19:40; se arregló el perfil. **En el 2214 corrieron los 30 eventos, R1
  incluido** (a las 15:00); **en el 2215, 29 de 30** (falló S1r).
- **Dos juicios del 2214.** *Modo espera con un cobro abierto:* ningún día perdió un cobro ni lo
  tecleado; es una capa encima de un puesto que sigue montado (DP-D39): diseño, no defecto (no se
  probó a propósito con un cobro a medio teclear). *Lentitud* (merma, retiro, compra y cierre de caja,
  de 3 a 11 s): no se pudo sacar del registro del servidor, que no guarda la duración por petición;
  el indicio es que se mide el bot.
- **Veredicto, tal cual lo da el informe:** ¿hay un día limpio? **No, estrictamente.** Los cinco días
  cuadraron en el cierre (0 diferencias del árbitro en el cierre de los cinco), 0 5xx y 0 consola, y todo
  el caos se ejecutó entre el 2214 y el 2215, **pero ningún día reunió todo a la vez**: el 2214 tuvo la
  diferencia por hora del árbitro y la cuenta sin cobrar del guion; el 2215 no ejecutó S1r. **Un sexto día
  sobre el código final corre la noche del 18-11** (informe previsto: `b-dia-6.md`).
- **Sin arreglar y anotado:** el modo espera durante el cobro; la lentitud de formularios sin causa
  demostrada; la sesión de la Caja de 12 h fijas (por diseño). El hallazgo 38 (la barra del teléfono con
  la cuenta pedida) lo cierra el lote 7.
