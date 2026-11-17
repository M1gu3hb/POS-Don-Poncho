# ESTADO · DP-22 · La auditoría final

> **Si la sesión se compactó, lee esto primero.** Luego `PLAN.md`, `HALLAZGOS.md` y
> `docs/PROGRESO-DP22.md`. Sin secretos ni PIN aquí: viven en `..\_PRIVADO\`.

Última puesta al día: 16-11-2026, 22:20.

## Dónde voy

- **Fase A (preparar):** hecha, salvo cerrar la línea base de `verify` (va en las puertas que
  mutan; las unitarias marcaron 4 tiempos agotados por la carga de la laptop: repetirlas solas).
- **Fase B (el mapa total):** el generador está en el repo (`scripts/qa-final/`) y generó
  `MATRIZ.md` sin huecos (34 pantallas, 96 ajustes, 104 flujos, 124 comandos, 26 entidades). Falta
  ir llenando `qa/qa-final/datos/efectos.json` con la prueba de cada ajuste (Fase D).
- **Fase G (pendientes conocidos):** el Bloque 19 A ya está consolidado en su rama; el B y el lote 3
  están con agentes.
- **Fase I (producción):** los guiones están escritos y ENSAYADOS en clones locales de la copia
  (`configurar-produccion.mjs`, `dia-cero.mjs`, `lib/estado-de-arranque.mjs`). Falta unirlos por PR
  y correrlos en producción al final.

## Ramas y árboles

| Quién             | Árbol                 | Rama             | Qué hace                                                                                          | Estado                                                         |
| ----------------- | --------------------- | ---------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Sesión principal  | `POS Don Poncho`      | `dp-22-arranque` | preparar, mapa, plan, guiones de producción, unir                                                 | sin commit todavía (espera a que termine `verify`)             |
| Agente 1 (Sonnet) | `.work\dp18-integrar` | `dp-22-b19`      | Bloque 19 A: H2, A24, devolución por peso, X4                                                     | **terminado, revisado y consolidado en `6b580f5`** (sin subir) |
| Agente 2 (Sonnet) | `.work\dp20`          | `dp-22-b19b`     | Bloque 19 B: H3, A23, A5, A6, A10, X5                                                             | trabajando                                                     |
| Agente 3 (Sonnet) | `.work\dp20-lab`      | `dp-22-arnes`    | el arnés táctil (Parte 3) y su autoprueba                                                         | trabajando (desechable 5438, servidor 3210)                    |
| Agente 4 (Sonnet) | `.work\dp18-integrar` | `dp-22-lote3`    | `PUBLICOS` recortada, sin cola de sincronización, «Hecho por MORPHIQ», quién anuncia las comandas | trabajando                                                     |

Ningún agente hace commit. Al terminar cada uno: revisar su diff, correr yo sus pruebas y un
mutante, correr `pnpm verify:aspecto` y `node scripts/verificar-heredado.mjs` en su árbol (los
agentes se los saltan), revisar PIN (`node /d/mpos-tmp/dp21/revisar-pines.mjs <árbol>` con lo
agregado al índice) y consolidar en su rama. Las ramas se unen después en la rama del lote.

## En curso (de fondo)

- `bash /d/mpos-tmp/dp22/verify-todo.sh` sobre `main` → `D:\mpos-tmp\dp22\verify-base.log` y un
  `.log` por puerta en `D:\mpos-tmp\dp22\verify-base\`. Mientras corre: **nada de commits ni
  `git add -A`** en el checkout principal, y no correr guiones del repo que importen el servidor
  (los mutantes escriben en el árbol).

## Qué sigue (en orden)

1. Cerrar la línea base: repetir solas las 4 unitarias que se pasaron de tiempo
   (`portal/avisos-caducados`, `sonidos/sonidos`, `validacion/cuerpo-inerte.contrato`,
   `venta/categorias-de-gasto.contrato`) y anotar el resultado en `PROGRESO-DP22.md`.
2. Primer commit de `dp-22-arranque`: documentos, mapa, `verificar-heredado.mjs` (y meterla en
   `verify` y en la CI), `configurar-produccion.mjs`, `dia-cero.mjs` (y `pnpm dia-cero` en
   `package.json`), `.gitignore`. Antes: mutar un archivo real de `heredado/` para ver fallar la
   puerta y restaurarlo; volver a ensayar los guiones de producción con el árbol quieto.
3. Recibir al agente 2 → **Lote 1** = `dp-22-b19` + `dp-22-b19b` + la puerta de `heredado/` → PR →
   CI → producción → humo sin cobrar → Vercel sin errores en la hora.
4. Recibir al agente 4 → **Lote 3**. Recibir al agente 3 → **Lote 2** (arnés) y `init-agents`.
5. Agente nuevo para el Bloque 18 (app 1.0.2) cuando haya un árbol libre.
6. Fase D (cada ajuste, solo y combinado), Fase E (inventario y recetas de cero), Fase F (barrido y
   lo que falta), Fase H (día de bots), Fase I (producción) y el informe 013.

## Hechos que ya no hay que volver a averiguar

- Producción hoy (sólo lectura, 21:15): 9 cuentas pagadas A-1 a A-9 (11-11 y 15-11), 1 caja cerrada
  («Caja 33»), 0 cajas abiertas, 35 terminales «Caja N», cupo 1, 0 almacenes, 0 insumos, 0 recetas,
  107 productos, 10 mesas libres, 10 personas, `impuesto` vacío, sin prefijo de folio, migraciones
  hasta la 193. Guion: `D:\mpos-tmp\dp22\revisar-produccion.mjs`.
- **La copia con el catálogo real:** `qa_dp22_base` (clúster 5460), idéntica a producción a las
  21:36 (135 tablas, 1,873 filas, mismos md5), con PIN de prueba en `D:\mpos-tmp\qa-dp22-base\`.
  Trae además tres negocios de demostración que siembran las migraciones: las consultas se filtran
  por la organización de Don Poncho. Se clona con `create database X template qa_dp22_base`.
- **El ensayo de la Parte 11 en clones** (`qa_dp22_config`, `qa_dp22_ceros`): configurar (5
  comandos, la segunda corrida no escribe), el primer folio se niega con cuentas, dejar en ceros
  (`--desde 2026-11-11 --ventas 9`), primer folio 1001 y 101, 35 aparatos renombrados, y el día
  cero de un jalón; y se niega (sin borrar nada) con otro número de cuentas, con cuentas anteriores
  a `--desde`, con una caja abierta y con el negocio ya operando.
- Electron 45.3.2 trae **Chrome 156**; Playwright 1.63 trae Chromium 153. El arnés usa Chrome for
  Testing 156 (`D:/mpos-tmp/chromium-electron/156/`).
- La escala real de la pantalla del iMin no está documentada: se prueban 1920×1080 a escala 1 y
  1280×720 a escala 1.5.
- Skills externas leídas e instaladas en `.claude/skills/` (fuera de git): `webapp-testing`,
  `verification-before-completion`, `systematic-debugging`, `test-driven-development`, `browser-qa`.
- La puerta nueva `scripts/verificar-heredado.mjs` pasa sobre `main` (248 archivos) y se prueba
  contra sí misma en cada corrida; tarda de 1 a 3 minutos.

## Decisiones tomadas en esta sesión (pasarlas a `DECISIONES.md`)

- **DP-D146** (ya escrita, en la rama `dp-22-b19`): candados en un solo orden; la merma se registra
  con existencia en negativo; el negativo vale cero en «Valor de inventario»; el primer 429 del
  laboratorio deja rastro.
- La sesión principal trabaja en el checkout principal; los agentes, en los árboles de `.work`.
- Las skills externas se clonan con `git` y se leen antes de usarse (no se corre `npx skills`).
- El mapa total no es puerta de `verify` (sus `archivo:línea` cambian con cada edición);
  `--verificar` sólo exige que no haya huecos.
- **`silenciar_notificaciones_admin` se queda ENCENDIDO en producción:** quien atiende las llamadas
  del portal son los meseros (sus aparatos siempre suenan); el puesto de mando conserva el aviso
  visual. El guion de configuración lo comprueba y no lo escribe.
- **Quién anuncia las comandas:** quien entra con puesto de cocina anuncia por omisión y se le
  pregunta una sola vez; los demás puestos no anuncian salvo que lo enciendan en Este aparato; el
  teléfono de cocina, como hoy. Sin estado en el servidor.
- **`PUBLICOS`** se recorta a lo que el portal lee; la Caja deja de encolar la cola de
  sincronización (el comando se queda, sin pantalla); el crédito dice «Hecho por MORPHIQ».
- **`pnpm dia-cero`** ensaya por omisión; `--en-serio` lo hace, y para borrar la prueba física pide
  `--ventas <n>` igual al número que dijo el ensayo.

## Trampas de esta etapa

- **`pnpm install` SIEMPRE con `. "/d/MIS PROYECTOS/MORPHIQ POS/.work/env.sh"` cargado.** Sin él,
  pnpm cambia de almacén, quiere rehacer `node_modules` y falla a medias con «Acceso denegado»
  (pasó al arrancar: 16 minutos de reinstalación).
- Nunca ejecutar `electron.exe` ni `chrome.exe` para preguntar la versión: abren ventana y cuelgan
  la orden. La versión de Chrome de Electron se lee del binario (`grep -a "Chrome/"`).
- En esta herramienta los `heredoc` de Bash se comen las barras invertidas: los archivos de código
  se escriben con la herramienta de archivos.
- El checkout principal tiene un `.env`: los guiones del repo lo cargan si `DATABASE_URL` no viene
  en el entorno. **Fijar siempre `DATABASE_URL` a mano** antes de correr un guion contra una copia.
- Con `psql` en Windows, `export PGCLIENTENCODING=UTF8` o los textos con «·» fallan.
- Con la laptop cargada (tres agentes), `pnpm lint` tarda 16 minutos y las unitarias se pasan de
  tiempo: los rojos por «Test timed out» se repiten solos antes de creerlos.
- Los agentes no corren `verify:aspecto`: un cambio de clases o textos en `heredado/` se declara en
  `scripts/aspecto-permitido.json`.

## Cómo se corre aquí (laptop de Miguel, sin Docker)

- Entorno: `. "/d/MIS PROYECTOS/MORPHIQ POS/.work/env.sh"` (cachés en D:).
- `verify` por puertas, sin detenerse: `bash /d/mpos-tmp/dp22/verify-todo.sh [raíz] [desde] [salida]`
  (sin `verify:esquema`, `verify:rls` ni `verify:acople`, que leen la base compartida; la CI
  tampoco los corre).
- Integración: `DATABASE_URL_PRUEBAS="$(cat /d/mpos-tmp/dp22-url.txt)"`.
- e2e: base desechable en el 5437 y servidor en el 3200 (`scripts/base-desechable.mjs`).
- Un guion del repo contra una copia local: cargar el entorno de la desechable
  (`scripts/base-desechable.mjs entorno`), fijar `DATABASE_URL` a la copia y `ORGANIZACION=don-poncho`.
- Copias con el catálogo real: clúster 5460 (`qa_*`). Chromium viejo: `D:/mpos-tmp/chromium-viejo/`.
