# 003 · Dejar el funcionamiento listo para operar (DP-10)

Fecha: 27-10-2026. Estado: **DP-10.1, 10.2 y 10.3 viven en producción (`main`,
https://pos-don-poncho.vercel.app), con las escrituras de DP-10.1 hechas y la huella de las otras
10 organizaciones idéntica. `fase-b` tiene `main` fusionado y la migración 188, con su CI en
verde. La mudanza (DP-10.5) tiene herramienta, guion y dos ensayos con los datos reales; no se
ejecutó.** Falta que Miguel entre con el PIN de cada puesto (lista en §2). Sin secretos ni PIN en
este documento: los accesos viven en `..\_PRIVADO\`.

## 1 · Cada punto

| Punto   | Qué                                                    | Dónde    | Commits                                    | Ficha | Decisión |
| ------- | ------------------------------------------------------ | -------- | ------------------------------------------ | ----- | -------- |
| DP-10.1 | Estaciones Cocina y Bebidas                            | `main`   | `dd945a2`, `0f19720`, `f7cfc38`, `d1d6b01` | 09    | DP-D31   |
| DP-10.2 | La última caja no cierra con cuentas vivas             | `main`   | `542382a`, `1d4a7e4`                       | 10    | DP-D32   |
| DP-10.3 | Puente de las mesas unidas hasta la mudanza; D-2 y D-3 | `main`   | `37dc6bb`, `1eff34a`                       | 11    | DP-D33   |
| DP-10.4 | `main` fusionado en `fase-b`                           | `fase-b` | `cbb80f5`, `42fc58a`                       | —     | —        |
| DP-10.5 | Herramienta y ensayo de la mudanza (Fase B)            | ambas    | `0d10464`, `c53fcb8`, `076a5d1`            | 12    | DP-D34   |
| DP-10.6 | Humo en producción después del despliegue              | —        | —                                          | —     | —        |

Fichas en `docs/para-el-maestro/` (índice `00-INDICE.md`); decisiones en `DECISIONES.md`;
bitácora en `docs/BITACORA.md`; el guion de la mudanza en `docs/infra/MUDANZA-FASE-B.md`.

### DP-10.1 · Estaciones (bloqueante) — HECHO, en producción

- **La sesión trae la estación desde el servidor.** `leerEstacionDeLaSesion` (el empleo → su
  estación activa del mismo negocio) va en la respuesta del PIN y en `/api/catalogo/sesion`.
  Dueño, administrador y gerente ven todas; un cocinero marcado «ve todas», también; los demás,
  la suya.
- **Cocina** decide con lo que dice el servidor (lo guardado en la pestaña ya no manda): cada
  cocinero su estación; quien dirige, la «Vista general»; el cocinero sin estación ve «Tu usuario
  no tiene estación asignada; pide al administrador que te asigne una» y ninguna comanda. La voz
  y el aviso de pedido nuevo suenan sólo en la estación del pedido; el teléfono de cocina sólo
  conecta la suya.
- **Todos los caminos que crean comandas** asignan la estación en el servidor con la misma
  cadena (categoría → su estación activa → la general). El mesero ya lo hacía; el portal QR no:
  con las estaciones apagadas mandaba comandas sin estación, y con estaciones fundía cocina y
  barra en una sola comanda. Ahora arma una comanda por estación y área, como el mesero. El pedido
  compartido de `fase-b` pasa por el mismo camino.
- **`restaurante.marcar_estacion_general`** («Hacer general» en Configuración → Estaciones), con
  candado, auditoría (también cuando no cambia nada) y sólo para dueño, administrador y gerente.
- **Producción:** «Cocina» es la general, el usuario Cocina está en la estación Cocina, Bebidas
  está dado de alta (rol cocina, estación Bebidas, PIN de 4 dígitos al azar y sin patrón) y
  `estaciones_preparacion_activas` está encendida (§2).
- **Pruebas:** unidad (la estación de la sesión, el alcance de la cocina), integración contra
  Postgres (la estación de la sesión; la estación de cada comanda por mesero, QR y pedido
  compartido, con estaciones encendidas y apagadas; la estación general) y navegador en
  escritorio, tableta y teléfono (`estaciones-de-cocina.spec.ts`).

### DP-10.2 · Cierre de caja con cuentas vivas — HECHO, en producción

- `caja.cerrar` bloquea en orden las cajas abiertas de la sucursal y cuenta las cuentas vivas
  (órdenes cobrables con mesa, o partes de una dividida). Si es la **última** caja y quedan
  cuentas, rechaza: «Quedan cuentas sin cobrar en las mesas 1 y 2: cóbralas antes de cerrar la
  última caja abierta.» Con **otra caja abierta**, cierra y avisa que las cobrará la otra (aviso
  en pantalla y en la auditoría). Otra sucursal no cuenta.
- **Pruebas:** unidad, 7 de integración (entre ellas el candado observado en
  `pg_stat_activity`) y la jornada de concurrencia del navegador, que ahora exige el rechazo
  antes de cerrar.

### DP-10.3 · Puente de mesas unidas, D-2 y D-3 — HECHO, en producción

- El QR de una mesa miembro de una unión abierta usa la cuenta de la principal y dice «Esta mesa
  está unida a la mesa N»; nunca abre una cuenta aparte. Con la unión cerrada, el QR vuelve a
  ser de su mesa; un QR apagado no sirve aunque la principal tenga el suyo encendido.
- **D-2:** «Separar mesas» en la mesa activa de la principal. **D-3:** al unir, las comandas de
  la mesa absorbida pasan a la cuenta del grupo, y «Marcar entregado» desde la principal las
  entrega. Los dos dejaron de ser `test.fixme`.
- **Pruebas:** 6 de integración (`union-puente-del-qr`), `qr-de-mesa-unida.spec.ts` (tres
  aparatos) y D-2 y D-3 en `restaurante-operaciones.spec.ts`.
- **Pendiente:** D-5 sigue en `test.fixme` (fuera de alcance).

### DP-10.4 · `main` en `fase-b` — HECHO

- Dos fusiones con merge, nada reescrito: `cbb80f5` y `42fc58a`. Los conflictos se resolvieron
  a favor de `fase-b` (filas de adopción y excepciones de aspecto, y la prueba del puente con las
  mesas pegadas en el mapa).
- El pedido compartido y la unión desde el mapa respetan las estaciones (integración y
  navegador).
- **En `fase-b`:** las 16 `verify:*` que no comparan con la compartida, formato, lint, tipos,
  unidad (4 231) e integración (209 en 49 archivos) en verde; navegador: `pedido-compartido`
  (3), `restaurante-concurrencia` (18), `restaurante-operaciones` (17), `qr-de-mesa-unida` (3),
  `estaciones-de-cocina`, `unir-mesas-en-el-mapa` y la jornada completa, en verde. CI del PR
  [#1](https://github.com/M1gu3hb/POS-Don-Poncho/pull/1): `40578188619` sobre `42fc58a`, 8 de
  8 en verde.
- Banco de la 188: 5 de 5 mutantes muertos (§3).

### DP-10.5 · La mudanza (no se ejecutó) — HERRAMIENTA, GUION Y ENSAYO HECHOS

- `scripts/exportar-negocio.mjs`: sólo lectura, una transacción `repeatable read read only`,
  las 132 tablas del negocio (por `organizacion_id` y por llave foránea), el md5 de cada tabla y
  el bucket; la salida va fuera del repositorio (`..\_PRIVADO\mudanza\`); `--exigir-cerrado`
  para el día.
- `scripts/importar-negocio.mjs`: se niega con la compartida, con una base que no es nueva o con
  una migración que falte; una sola transacción con los disparadores apagados (como la
  restauración oficial de Supabase), los mismos ID, los ledgers insertados tal cual, las
  secuencias al máximo, y llaves foráneas y md5 comparados ANTES del `commit`; copia el bucket y
  lo vuelve a leer.
- **En `fase-b`:** la migración **188** apaga las tres demostraciones de la 042 sólo en una base
  que no tiene más negocios que ésos y Don Poncho (en la compartida no hace nada), con su prueba
  contra Postgres. Las puertas que comparan con un proyecto toman su ID de
  `MORPHIQPOS_PROYECTO_VERIFICADO` (sin ella, el de la Fase A).
- `docs/infra/MUDANZA-FASE-B.md`: el guion del día, cómo se regresa y la lista de puestos. **El
  7 y el 8 de noviembre de 2026 caen en sábado y domingo**: si son días fuertes, la ventana va
  el lunes 9 o el martes 10.
- No se creó ningún proyecto ni se tocó ninguna variable de Vercel.

#### Tiempos reales (datos reales de Don Poncho, en esta PC)

| Paso                                         | Contra `main` (185) | Contra `fase-b` (188)  |
| -------------------------------------------- | ------------------- | ---------------------- |
| Exportar de producción (sólo lectura)        | 16,9 s              | (la misma exportación) |
| Migrar desde cero una base nueva             | 8 s                 | 7 s                    |
| Importar (132 tablas, 950 filas, 0 archivos) | 1,4 s               | 2,2 s (3 s de reloj)   |
| Filas y md5                                  | idénticos           | idénticos              |
| Entra con PIN y pasa la jornada              | sí                  | sí                     |

La entrada con PIN se probó con la app compilada y la `PIN_PEPPER` de producción, con un
gerente de ensayo dado de alta sólo en la copia (ningún PIN real). Dos exportaciones más, antes y
después de escribir en producción (16,0 s y 16,6 s), sirvieron para comprobar lo escrito (§2).
Con un origen de demostración local: 948 filas idénticas, volver a importar se niega, una fila
alterada la detecta la verificación y las secuencias quedan bien.

### DP-10.6 · Humo en producción — HECHO, salvo las entradas con PIN (las hace Miguel)

- **Después del despliegue** (Production con `d1d6b01`, 20:21 UTC): humo sin sesión verde antes
  y después de escribir: portada, acceso, manifiesto, marca, una página del menú QR, el QR de la
  mesa 1 y su API (8 páginas del menú), y la API de datos se niega sin sesión.
- **La pantalla de acceso de producción** lista a las 9 personas, con Bebidas.
- **Lo que el servidor le contesta a cada puesto** al entrar (las mismas funciones que
  `/api/auth/entrar` y `/api/catalogo/sesion`, leído sin PIN): Cocina → `/cocina`, estación
  Cocina; Bebidas → `/cocina`, estación Bebidas; Miguel, el dueño y el gerente → inicio, ven
  todas las estaciones; Caja → `/caja`; Mesero 1 y 2 → `/mesero`; Almacén → su menú.
- **Archivos:** `humo-archivos.mjs` del repositorio entra con PIN a una demostración, así que en
  producción se usó el mismo conductor de la aplicación con las llaves del almacén: un PNG de
  prueba subido, leído (md5 igual), listado y borrado; el bucket quedó con 0 archivos, como
  estaba.
- **Sin caja, sin cobros y sin cuentas:** Don Poncho sigue con 0 sesiones de caja, 0 pagos y 0
  órdenes.
- **Entrar con el PIN de cada puesto lo hace Miguel** (desde aquí no se teclean PIN reales en
  producción). Los PIN están en `..\_PRIVADO\ACCESOS-DON-PONCHO.md`; en
  https://pos-don-poncho.vercel.app/n/don-poncho/login-pos:

| Puesto           | Cae en             | Debe ver                                                           |
| ---------------- | ------------------ | ------------------------------------------------------------------ |
| Dueño Don Poncho | Inicio             | Todo; en Cocina, «Vista general» con comida y bebidas              |
| Gerente          | Inicio             | Igual que el dueño                                                 |
| Caja             | Caja               | La caja (no abrirla: es sólo para ver que entra)                   |
| Mesero 1 y 2     | Mesero             | Su mapa de mesas                                                   |
| Cocina           | Cocina             | Arriba, la estación Cocina; nada de Bebidas                        |
| Bebidas          | Cocina             | Arriba, la estación Bebidas; nada de Cocina                        |
| Almacén          | Su menú de almacén | Existencias, entradas, conteo, compras y recetas; no la caja       |

## 2 · Lo escrito en producción

Todo por los comandos de la aplicación, con `scripts/preparar-negocio.mjs` (datos v2) firmado por
«Miguel · Morphiq», entre las 20:22:54 y las 20:22:58 UTC del 27-10-2026. Antes, el mismo guion
con `--ensayo` (no escribe) dijo exactamente esto:

| Comando                                 | Qué                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `puente.escribir` (configuración)       | `estaciones_preparacion_activas`: sin valor → `true` (lo único que cambió del renglón) |
| `configuracion.fijar_apariencia`        | Los mismos valores de siempre (no cambió nada; queda su auditoría)                    |
| `restaurante.marcar_estacion_general`   | «Cocina» pasa a ser la estación general                                               |
| `identidad.guardar_empleado`            | El usuario Cocina, a la estación Cocina (su PIN no se tocó)                           |
| `identidad.guardar_empleado`            | Alta de Bebidas: rol cocina, estación Bebidas, PIN nuevo al azar                      |

Comparado contra exportaciones de Don Poncho de justo antes y justo después: 950 → 964 filas
(+5 en `auditoria`, +5 en `comandos_ejecutados` y +1 en `personas`, `identidades`, `empleos` y
`credenciales_pin`); cambian además un renglón de `configuracion`, uno de
`estaciones_preparacion` y uno de `empleos`. Nada más. El PIN de Bebidas se entregó sólo en el
chat y en `..\_PRIVADO\ACCESOS-DON-PONCHO.md`.

Del almacén: el PNG de prueba (`humo/…`) se subió y se borró. Una consulta a la lista de acceso,
la misma que hace la pantalla de entrada.

**Huella** de las otras 10 organizaciones (119 tablas con `organizacion_id`; 276 conteos y 143
md5 comparados): **IDÉNTICA**, de las 20:21:43 a las 20:25:18 UTC.

## 3 · Las pruebas con mutación

Arnés con Git Bash por ruta (desde Python, `bash` a secas llega a WSL), una línea base que pasa
antes de mutar y el motivo de cada muerte. Un mutante que no compila no cuenta como muerto.

| Punto                    | Mutantes | Muertos por una prueba que falla |
| ------------------------ | -------- | -------------------------------- |
| DP-10.1 · estaciones     | 21       | 21                               |
| DP-10.2 · cierre de caja | 8        | 8                                |
| DP-10.3 · puente, D-2/3  | 7        | 7                                |
| 188 · demostraciones     | 5        | 5                                |
| **Total**                | **41**   | **41**                           |

Dos casos de DP-10.1 merecen nota: los mutantes «la sesión no trae la estación» y «el PIN no trae
la estación» primero no compilaban (no contaban). Se reescribieron: el primero lo mata el
navegador; el segundo el navegador no lo ve (las pantallas vuelven a preguntar a
`/api/catalogo/sesion` al cargar), así que se añadió la prueba de la ruta del PIN (`0f19720`), que
lo mata. El de la clave del portal (cocina y barra en una comanda) se hizo a mano y lo mata su
prueba de integración.

## 4 · Lo que apareció en el camino

- **El portal QR fundía cocina y barra en una sola comanda** cuando había estaciones (la clave
  del grupo no llevaba el área). Lo destapó la e2e del pedido compartido en `fase-b`; se arregló
  en `main` (`d1d6b01`) con su prueba de integración.
- **La jornada de concurrencia cerraba la última caja con dos mesas vivas**: con DP-10.2 eso ya
  no se deja. La prueba ahora exige el rechazo, cancela esas cuentas y cierra.
- **D-3 contaba comandas de pruebas anteriores**: ahora cuenta sólo las nuevas.
- **Una llave foránea `NOT VALID`** (`movimientos_stock_motivo_conocido`) no la cumple ni el
  origen: el importador no la exige.
- **La jornada del ensayo contra `main` falló una vez** porque un elemento se desprendió de la
  página a media acción; pasó en la segunda corrida, sin cambiar nada.
- `open(p, 'w')` de Python en Windows escribe CRLF: los guiones de edición usan `newline=''`.

## 5 · Pendientes (fuera de este encargo)

- **Las entradas con PIN** de cada puesto (§1, DP-10.6): las hace Miguel.
- **D-5:** la autorización de supervisor no va atada a la cuenta (`test.fixme`).
- **El monitor de recogida:** acepta cualquier cookie de aparato de caja como ficha y no tiene
  límite de peticiones.
- **La rotación de PIN** y la visibilidad del repositorio.
- **La mudanza misma** (7 al 10 de noviembre), con el proyecto que crea Miguel
  (`docs/infra/MUDANZA-FASE-B.md`, «Antes del día»).

## 6 · CI usada

Repositorio público: GitHub Actions no cobra minutos. Aun así, lo consumido por este encargo
(minutos de trabajo; los trabajos corren en paralelo):

| Corrida       | Rama     | Sobre     | Resultado  | Trabajos | Minutos de trabajo | Reloj    |
| ------------- | -------- | --------- | ---------- | -------- | ------------------ | -------- |
| `40560057606` | `dp-10`  | `0d10464` | cancelada  | 16       | 90,2               | 7,9 min  |
| `40561149118` | `dp-10`  | `c53fcb8` | fallida    | 16       | 178,5              | 24,9 min |
| `40566361306` | `dp-10`  | `0f19720` | cancelada  | 16       | 37,3               | 4,1 min  |
| `40566842476` | `dp-10`  | `f7cfc38` | cancelada  | 16       | 179,9              | 20,3 min |
| `40569913552` | `dp-10`  | `1eff34a` | verde      | 16       | 195,3              | 24,1 min |
| `40573919299` | `dp-10`  | `d1d6b01` | verde      | 16       | 178,5              | 19,6 min |
| `40578188619` | `fase-b` | `42fc58a` | verde (PR) | 8        | 49,2               | 18,2 min |

**909 minutos de trabajo** en 7 corridas. La fallida destapó la jornada de concurrencia
cerrando la última caja con mesas vivas, y la cancelada sobre `f7cfc38` ya traía la jornada en
rojo por D-3 (§4); las otras dos se pararon al subir un arreglo encima. A eso se suma la corrida que valida este reporte antes de entrar a `main`.

## 7 · Commits

Todos a nombre de `M1gu3hb <118588634+M1gu3hb@users.noreply.github.com>`. Cero líneas
`Co-Authored-By` y cero «Generated with» (comprobado commit por commit con
`git log -1 --format='%an <%ae>%n%b'`).

En `main` (producción):

| Commit    | Qué                                                                                       |
| --------- | ----------------------------------------------------------------------------------------- |
| (éste)    | DP-10: reporte del funcionamiento (003), bitácora y ensayos en el guion de la mudanza     |
| `d1d6b01` | DP-10.1: el portal arma una comanda por estación y área, como el mesero                   |
| `1eff34a` | DP-10.3: D-3 cuenta sólo las comandas de su grupo                                         |
| `f7cfc38` | DP-10.1: el doble de la estación de la sesión lleva su tipo                               |
| `0f19720` | DP-10.1: la respuesta del PIN trae la estación que el servidor leyó para ese empleo       |
| `1d4a7e4` | DP-10.2: el corte de la jornada de concurrencia cancela antes las mesas que siguen sentadas |
| `c53fcb8` | DP-10.5: la prueba del proyecto verificado usa vi.stubEnv (lint)                          |
| `0d10464` | DP-10.5: exportar e importar un negocio para la mudanza; puertas por proyecto             |
| `37dc6bb` | DP-10.3: puente de mesas unidas — el QR de la unida usa la principal; D-2 y D-3           |
| `542382a` | DP-10.2: la última caja no cierra con cuentas vivas; con otra abierta, cierra y avisa     |
| `dd945a2` | DP-10.1: estaciones Cocina y Bebidas — la sesión trae la estación del servidor            |

En `fase-b` (PR [#1](https://github.com/M1gu3hb/POS-Don-Poncho/pull/1), borrador, sin fusionar),
además de los de `main`:

| Commit    | Qué                                                                          |
| --------- | ---------------------------------------------------------------------------- |
| `42fc58a` | DP-10.4: vuelve a fusionar main (DP-10.1 a 10.3, lint y pruebas) en fase-b   |
| `076a5d1` | DP-10.5: migración 188, las demostraciones de la 042 archivadas en una base nueva |
| `cbb80f5` | DP-10.4: fusiona main (DP-10.1 a 10.5) en fase-b                             |
