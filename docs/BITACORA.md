# BITÁCORA · POS Don Poncho

Para retomar si se corta la sesión. Lo más reciente arriba. Sin secretos ni PIN.

## Cómo está montada la cadena local (máquina de Miguel)

- `source "/d/MIS PROYECTOS/MORPHIQ POS/.work/env.sh"` antes de `pnpm` (cachés en D:).
- Postgres 18 local de `.work/pg/data`, puerto **55433**, usuario `morphiqpos` / `postgres`.
  Arranque: `pg_ctl -D ".work/pg/data" -l ".work/logs/pg.log" start`.
- Base desechable nueva y migrada desde cero:
  `createdb` (o `psql -c "create database <n> owner morphiqpos"`) y
  `DATABASE_URL=postgres://morphiqpos:…@127.0.0.1:55433/<n> pnpm --filter @morphiqpos/data migrate`.
- Integración: `DATABASE_URL_PRUEBAS=<url> DATABASE_URL=<url> pnpm test:integracion`.

## 2026-10-25 · DP-0 y DP-1

### Origen

`M1gu3hb/MorphiqPOS` en `origin/main` = `5f4534c` (merge PR #18), confirmado con `git fetch`.
Copia por `git archive` (ver `ORIGEN.md`). Repo `M1gu3hb/POS-Don-Poncho`: **público**; Miguel
decidió seguir así («no te detengas»). Consecuencia: nada de PIN ni secretos en el repo.

### Decisiones de Miguel (chat, 25-10)

- 10 mesas en «Salón» (pendiente confirmar la distribución real).
- Barbacoa por peso ($795/kg) con atajos ¼, ½ y 1 kg. Licores y vinos por copa.
- Tarros: extra con precio sobre TODAS las cervezas. Pulques: producto por categoría y tamaño,
  sabor como opción; Natural $70 = litro.
- Ticket: sólo nombre y dirección (teléfono y RFC pendientes).
- Tabla del menú (103 productos) aprobada tal cual.

### Línea base ANTES de podar (`5f4534c` + `ORIGEN.md`)

Base desechable `dp_linea_base` en el Postgres 18 local, migrada desde cero con las 117
migraciones del repo (12 s).

| Paso | Resultado | Tiempo |
| --- | --- | --- |
| `pnpm format:check` | verde | 43 s |
| `pnpm lint` | verde | 329 s |
| `pnpm typecheck` | verde | 72 s |
| `pnpm test:unit` | verde · 409 archivos · 4,559 pruebas (3 omitidas, heredadas) | 118 s |
| `pnpm test:integracion` | verde · 48 archivos · 179 pruebas | 135 s |

No corrido en la línea base (se corre al cerrar DP-2): `pnpm verify` completo (incluye build,
puertas contra base viva y navegador). Cualquier rojo posterior en estos cinco pasos es de la poda.

### Mapa de alcance (herramienta)

Script de alcanzabilidad (grafo de imports + enlaces entre páginas + rutas `/api` del cliente),
desde las entradas del restaurante: login, `(modelos)/restaurante/*`, las doce pantallas
heredadas del menú real (D-52), portal QR, `middleware`, CLIs. Resultado: ~768 de 1,425 archivos
fuente los alcanza el restaurante; el resto es de los otros cuatro giros, del modo presentación y
de las demos. Las URL que el cliente arma con funciones (portal QR) no las ve el detector: la API
se decide por dominio y se confirma con grep, tipos y pruebas.

## 25-10-2026 · DP-2 cerrada

Siete commits (`DP-2a` … `DP-2g`). Lo que quedó fuera y lo que se conservó está en
`DECISIONES.md` (DP-D03 a DP-D10).

| Paso | Resultado | Tiempo |
| --- | --- | --- |
| `pnpm verify` reducido, sin las tres puertas que miran la base viva | verde (`rc=0`) | ~20 min |
| · `test:unit` | 285 archivos · 3,335 pruebas (3 omitidas, heredadas) | 84 s |
| · `build` | verde | 3 min |
| `pnpm test:integracion` (base desechable `dp_integ`) | 32 archivos · 111 pruebas | 82 s |
| Jornada del restaurante en navegador (`dp_e2e`): escritorio, tablet y teléfono | 3/3 | 5 min |

- `verify:esquema`, `verify:rls` y `verify:acople` están atadas al proyecto vivo y se corren en
  sólo lectura contra la base compartida en DP-4 (para Fase B/C: parametrizarlas, ver FASES).
- `verify:entorno` pide Postgres 17 para la base de pruebas y aquí hay 18: la cadena completa en
  17 corre en GitHub (`workflow_dispatch`).
- El servidor de la jornada registra «The destination stream closed early» cuando el navegador
  cambia de pantalla a media respuesta. No es un 5xx ni un error de consola (la jornada vigila
  ambos y pasó); se revisa en producción en DP-7.

### Dos decisiones de Miguel del 25-10 (chat)

- Credenciales de la base compartida y del almacenamiento: el `.env` del maestro apunta a la base
  LOCAL, así que se leen del proyecto Vercel `morphiqpos` (producción, sólo lectura) a un archivo
  temporal fuera del repo.
- Tarros: en el restaurante los modificadores viajan como nota y no cobran (E9-3 del maestro).
  Cada tarro es un **producto extra** en Cerveza. El menú queda en 107 productos.

## 25-10-2026 · DP-3 · La marca de la casa

- Estilo `don-poncho` (DP-D11), el predeterminado. Contraste AA en claro y oscuro por la auditoría
  (`verify:estilos`, 9 estilos × 2 modos) y la prueba de contrato; colores de gráfica a ≥ 0.12 en
  OKLab entre sí y ≥ 4.9:1 contra la superficie.
- Logo de la casa en el acceso, la barra lateral, el ticket, el corte y el portal QR (vector en
  pantalla, PNG en lo que se imprime). Favicon, `apple-touch-icon` y app instalable
  (`app/manifest.ts`). Se fueron los logos de Morphiq del repositorio.
- Morphiq firma una vez: «Sistema por Morphiq» en el acceso. Ticket del comensal: logo, nombre y
  dirección. Una prueba lo comprueba contra los archivos y su mutación se detecta.
- El acceso dejó el degradado azul y los resplandores (excepción de `verify:aspecto` declarada con
  sus 80 testigos). Los botones flotantes del mesero dejaron el azul de Morphiq fijo: ahora son el
  primario y el acento del estilo, planos.
- El restaurante de prueba usa ya `don-poncho`: la jornada y la galería prueban el estilo real.
- **Quedan con degradado** las tarjetas del tablero y otras ~70 piezas del heredado: son el diseño
  protegido del maestro (`verify:aspecto`, guía §7: no se toca el heredado). Recomponerlas es otra
  etapa, si Miguel la quiere.
- Resto de DP-2 que apareció al correr el portal en local: la suite esperaba «Restaurante MH».
  Ahora sale del contrato de negocios de prueba.
- **Hallazgo para DP-4/DP-6:** las variables del Vercel del maestro son *sensibles* (ilegibles por
  diseño), así que la decisión de leerlas de ahí no se puede cumplir (DP-D13). Hace falta que
  Miguel entregue `DATABASE_URL` y `STORAGE_*`.

## 25-10-2026 · DP-5 · El menú, la receta pendiente y lo que apareció al ensayar

- `scripts/cargar-menu.mjs` y `scripts/preparar-negocio.mjs`: por los comandos de la aplicación,
  idempotentes. Ensayo en base desechable (`dp_ensayo`) con Don Poncho y su ID real: la primera
  vuelta crea 2 estaciones, 17 categorías y 107 platillos (34 a cocina, 73 a barra), 10 mesas en
  «Salón» y 7 personas; la segunda no cambia nada. 107 con receta pendiente; barbacoa por kilo a
  $795.00 con ¼, ½ y 1 kg.
- Tres defectos heredados encontrados al ensayar, cada uno con prueba antes del arreglo: los
  arreglos hacia `jsonb` (DP-D15), las zonas fijas del salón (DP-D16) y el área de preparación con
  la que nace un producto (DP-D17).
- Las pantallas `/restaurante/recetas` y `/restaurante/productos` enseñaban costo $0.00 y margen
  100 % «sano» a un platillo sin receta: ahora «Costo desconocido» y «Sin costo».

## 25-10-2026 · Portal QR completo y menú personalizado (DP-D18)

- Pedido de Miguel: portal «con todo» y el menú personalizado diseñado con botones de pedir.
- Hecho: el menú público publica las opciones de cada platillo; cada página del menú subido lleva
  sus platillos con «Agregar»; 8 páginas diseñadas desde el menú; el marcador de platillo sin
  foto, plano en la pizarra de la marca; el cargador deja el portal encendido, las 8 páginas y la
  asignación de mesas. Ensayo en base desechable y prueba de navegador en verde.

## 25-10-2026 · DP-7 · Verificación local y en la CI

- Primera CI completa a mano (`40261424207`, Postgres 17): 14 de 16 trabajos verdes, la jornada
  incluida. Dos rojos: la auditoría de dependencias (Next 16.3.8 con ejecución remota de código,
  DOMPurify y Zod, heredados) → DP-7a; y la suite del restaurante en el estilo `don-poncho`, que
  cambiaba la plantilla por la ruta que DP-2b quitó → DP-7b exige la plantilla en vez de ponerla.
- Al ensayar la mudanza de dominio de las páginas del menú, ir y volver (A → B → A) no escribía la
  segunda A: la clave de idempotencia repetía la de la primera. Ahora lleva el `updated_at` de la
  fila (DP-5h).
- La galería se regeneró en la segunda corrida (`40263378355`): en la primera su paso iba detrás de
  la suite roja y se saltó. 72 retratos cambian por la marca y entran 9 del estilo `don-poncho`.
- En esa segunda corrida la jornada cayó en escritorio: la cocina regresaba a «Nuevos» una comanda
  cuyo toque iba en camino y el segundo «Listo» cayó sobre la misma. Defecto heredado de la
  pantalla, no de la prueba: prueba de navegador determinista que lo reproduce y arreglo (DP-D19).

## 25-10-2026 · DP-4 y DP-6 · Don Poncho en la base compartida y en producción

- Credencial: la `DATABASE_URL` vigente de `morphiqpos_app` (6543) estaba en una copia anterior
  del maestro; probada con una lectura y copiada al archivo privado. Nada rotado ni cambiado.
- Huella antes; `verify:esquema` y `verify:rls` verdes; alta con el ID declarado; dueño inicial;
  preparación y menú (segunda vuelta sin cambios); 10 QR de mesa (paso nuevo del guion); huella
  después, dos veces: idéntica.
- Vercel `pos-don-poncho`, variables por la entrada estándar, despliegue desde `main` (READY en
  `cle1`). Humo público en verde. `verify:acople`: 10 pendientes heredados de la poda, ninguno del
  despliegue (reporte 001 §6).

## 26-10-2026 · DP-7 · `verify:acople` en verde, y la segunda carrera de la cocina

- `verify:acople` ajustada al producto (DP-D21): consulta de seguridad única, suites y pantallas
  derivadas del producto, 7 comandos de otros giros declarados contra `MODELOS`, el «mesa» a mano
  de la cancelación y un falso positivo de prefijo. Seis mutaciones de la puerta, todas atrapadas.
- La CI de ese commit dio dos rojos: el banco de mutaciones apuntaba a la consulta en su lugar
  viejo (se movió a `rls.ts`), y la jornada en tableta: un «Listo» tocado con su «Preparar» en
  camino llegó primero. Defecto heredado de la cocina; prueba determinista y fila por comanda
  (DP-D19, segunda parte).

## 26-10-2026 · DP-9 · Paquete 1 de cambios del cliente

- DP-9.0: plan enviado a Miguel con el estado comprobado de cada cambio (dos búsquedas de sólo
  lectura en paralelo). `main`: 9.1, 9.2, 9.3, 9.4, 9.7, 9.8. `fase-b`: 9.5 y 9.6.
- DP-9.1 (DP-D22): Recetas y Platillos ya no pisan el área ni la visibilidad; el servidor aprende
  el área de un platillo nuevo de su categoría. Apareció además que Recetas no guardaba un
  platillo sin foto (`imagen_url: ''`). Producción revisada en sólo lectura: nada movido.
- DP-9.2 (DP-D23): el portal funciona sin asignación de mesas; la cuenta del comensal es del
  mesero que la atiende (al atender su aviso o al tomar la mesa), nunca de otro. Globos de
  solicitud sobre cada mesa en la pantalla del mesero. Ayudante e2e `prepararElPortalDelComensal`
  acepta `mesero: null`.
- DP-9.3 (DP-D24): vista «Solicitudes» dentro de Mesas (estación recordada por aparato); la voz
  de las solicitudes sólo suena ahí (antes sonaba en todas las pantallas del mesero); la caja ya
  no las lee ni las atiende en el servidor. Sale el modal viejo de solicitudes.
- DP-9.4 (DP-D25): cocina en el teléfono. QR por estación firmado para el día y revocable, API
  pública estrecha, voz, Wake Lock y botonera (`docs/cliente/BOTONERA.md`). Sin migración. De
  paso: el guardado de Configuración bloquea la fila antes de reescribirla.
- DP-9.7 (DP-D26, supera DP-D18): botones sobre las páginas del menú QR (editor con arrastre,
  platillo y grupo, precio vigente, vista previa) y aspecto del portal por tokens. Las 8
  páginas de Don Poncho, con 97 botones medidos de sus imágenes. Sin migración. En producción
  (b338ea2): los botones se escribieron con `preparar-negocio.mjs` (las 24 claves de
  configuración ya eran idénticas: sólo cambió `portal_qr_botones`); el portal publica 8 páginas
  con 15·12·9·11·19·13·11·7 botones; humo verde; huella de las otras 10 organizaciones idéntica.
- Demo local (DP-D27): `scripts/demo-local.mjs` + `docs/DEMO-LOCAL.md`; probada desde cero en la
  IP de la PC. Las cookies llevan `Secure` sólo si `APP_URL` es https (`cookiesSeguras`): antes,
  los teléfonos de la red local no podían entrar a la aplicación compilada.
- DP-9.8 (DP-D28): QR de las mesas con diseño. Motor de Morphiq-QRs portado a TypeScript (por un
  subagente en su worktree, revisado aquí: 487 casos, idéntico al original), diseño general y por
  mesa en `configuracion` (sin migración), y exportación PNG/SVG/PDF en mm que sólo sale si cada
  QR se lee con jsQR. De paso: instalar `jsqr` falló a medias con «Acceso denegado» y dejó
  `node_modules` sin su almacén virtual; `pnpm install --frozen-lockfile` lo repuso (7 min) y el
  segundo intento entró limpio.
- DP-9.5 (DP-D29, rama `fase-b`, migración 186): el pedido compartido de la mesa. Un carrito por
  mesa en el servidor, sondeo de 2.5 s con latido, «personas conectadas», «¿Ya pidieron todos?» y
  un solo envío aunque dos lo manden a la vez. Las bases locales `dp_integ` y `dp_e2e` quedaron
  con la 186 (desechables); la compartida, sin tocar.
- DP-9.6 (DP-D30, rama `fase-b`, migración 187): unir mesas desde el mapa. Arrastre con imán y
  efecto líquido, «¿Qué número queda?», las demás ocultas y su QR a la principal, la unión del
  salón que sobrevive al cobro y «¿Separar mesas o dejarlas unidas?» al limpiar. D-2 y D-3
  arreglados: sus pruebas dejan de ser `fixme`. Apareció que el cliente heredado tiraba los
  `datos` del error del servidor (la mesa de meseros y la caja no podían preguntar): corregido.
  `dp_integ` y `dp_e2e` con la 187 (desechables); la compartida, sin tocar.
- DP-9.6, revisión: un revisor independiente (sólo lectura) encontró cinco defectos reales —una
  principal ya cobrada absorbía cuentas vivas, «Cambiar de mesa» llevaba cuentas a mesas ocultas,
  `posiciones` movía mesas ajenas, sin candados, y la pregunta del grupo antes que «cuenta sin
  cobrar»—; cada uno con su prueba en rojo contra Postgres y luego en verde. Las pruebas de
  navegador encontraron otro: el modo unir abierto antes de que llegaran las mesas quedaba vacío.
- Arnés de mutaciones: los bancos que llamaban `subprocess.run(['bash', …])` desde Python
  (DP-9.5, DP-9.6 y DP-9.8) corrían el lanzador de WSL —System32 va antes que Git Bash— y
  marcaban «muerta» sin correr la prueba. Ahora usan Git Bash por ruta y una línea base que debe
  pasar sin mutar antes de mutar nada; los tres bancos se volvieron a correr con el arnés bueno
  (resultados en el reporte 002). Los bancos de DP-9.1 a DP-9.4 y DP-9.7 usaban `shell=True`
  (cmd) y no tenían el problema.

  segundo intento entró limpio. En producción (408fb69, 26-10): CI `40447773811` verde, acople verde contra
  producción, humo sin dinero verde, licencia de jsQR servida en `/licencias/`; ninguna escritura
  en la base (el diseño por omisión es el de siempre); huella de las otras 10 organizaciones
  idéntica. Sus 17 mutaciones se repitieron el 27-10 con el arnés corregido (ver reporte 002):
  17 de 17 atrapadas.

## 27-10-2026 · DP-10 · Dejar el funcionamiento listo para operar

- DP-10.0: plan enviado a Miguel. `main`: 10.1, 10.2, 10.3 y las herramientas de la mudanza;
  `fase-b`: la fusión de `main` y la migración 188. Los PIN reales los teclea Miguel (no se
  meten contraseñas en producción desde aquí).
- DP-10.1 (DP-D31): la sesión trae la estación del empleo desde el servidor (PIN y
  `/api/catalogo/sesion`); Cocina decide con ella cuando el servidor contesta; aviso al cocinero
  sin estación; voz y aviso de pedido por estación. El portal QR mandaba comandas sin estación con
  las estaciones apagadas: ahora sigue la cadena del mesero. `restaurante.marcar_estacion_general`
  («Hacer general»). `preparacionEstacionUtils.js` era código muerto. `preparar-negocio.mjs`
  (datos v2) probado contra la base de demo de DP-9: general, Cocina a su estación, alta de
  Bebidas, bandera; la segunda corrida no cambia nada.
- DP-10.2 (DP-D32): la última caja de la sucursal no cierra con cuentas de mesa vivas (dice
  cuáles); con otra abierta, cierra y avisa. El cierre bloquea las cajas de la sucursal en orden
  antes de decidir (probado con el candado observado en `pg_stat_activity`).
- DP-10.3 (DP-D33): el QR de una mesa miembro de una unión abierta usa la principal («Esta mesa
  está unida a la mesa N»); D-2 («Separar mesas» en la principal) y D-3 (al unir, las comandas
  de la unida pasan a la cuenta del grupo) dejan de ser `fixme`.
- DP-10.5 (DP-D34), lo que va a `main`: `exportar-negocio.mjs` (sólo lectura, tablas del
  catálogo, salida en `..\_PRIVADO\mudanza\`), `importar-negocio.mjs` (una transacción sin
  disparadores, llaves a mano, filas y md5 comparados antes del `commit`), `listar` del almacén,
  las puertas con `MORPHIQPOS_PROYECTO_VERIFICADO` y `docs/infra/MUDANZA-FASE-B.md`. Ensayo con
  los datos reales contra las migraciones de `main`: exportar 16,9 s (132 tablas, 950 filas, el
  bucket vacío), migrar 8 s, importar 1,4 s, idénticos. Una llave `NOT VALID`
  (`movimientos_stock_motivo_conocido`) no la cumple ni el origen: no se exige.
- DP-10.4 (en `fase-b`): `main` fusionado con un commit de merge (sin rebase ni fuerza). Los
  conflictos se resolvieron a favor de la unión de la fase B (DP-9.6): `AccionesDeLaMesa`,
  `MesaActiva`, el hook de la unión, `sala-escrituras` y la e2e de operaciones son los suyos; el QR
  de la mesa unida sigue por `mesas.unida_a_mesa_id` y conserva el aviso «Esta mesa está unida a
  la mesa N». Decisiones, índice, bitácora, aspecto y CI llevan lo de los dos lados.
- De paso: `open(p, 'w')` de Python en Windows escribe CRLF; los guiones de edición usan
  `newline=''`.
- Ensayo contra las migraciones de `fase-b` (hasta la 188): migrar 7 s, importar 2,2 s,
  idénticos; las demostraciones de la 042 quedan apagadas y Don Poncho activo. En los dos
  ensayos la app compilada, con la pimienta de producción, lista al personal y entra con PIN (un
  gerente de ensayo dado de alta sólo en la copia) y pasa la jornada completa.
- Banco de mutaciones de DP-10.1 a 10.3: 35 mutantes más uno a mano sobre la clave del portal,
  todos muertos por una prueba que falla (el de la respuesta del PIN no lo veía el navegador,
  porque la pantalla vuelve a preguntar a `/api/catalogo/sesion`: lo mata la prueba de la ruta).
- La e2e del pedido compartido en `fase-b` destapó que el portal fundía cocina y barra en una
  comanda cuando había estaciones (la clave del grupo no llevaba el área): arreglado en `main`
  (`d1d6b01`). La jornada de concurrencia cerraba la última caja con dos mesas vivas: con
  DP-10.2 ya no se deja; la prueba lo exige y luego cancela esas cuentas.
- `main` (d1d6b01, 27-10, 20:20 UTC): CI `40573919299` verde (16 trabajos), acople verde contra
  producción, Production lista a las 20:21. Escrito en producción con `preparar-negocio.mjs`
  (datos v2), entre las 20:22:54 y las 20:22:58 UTC: la bandera
  `estaciones_preparacion_activas`, «Cocina» como general, el usuario Cocina a la estación
  Cocina y el alta de Bebidas (cocina, estación Bebidas, PIN al azar sólo en `_PRIVADO`); la
  apariencia se volvió a fijar con los mismos valores. Comparado contra una exportación de
  antes: sólo cambiaron esas filas y su auditoría (950 → 964 filas). La pantalla de acceso lista
  9 personas. Almacén: un PNG de prueba subido, leído, listado y borrado (el bucket quedó
  vacío). Humo verde antes y después; huella de las otras 10 organizaciones idéntica
  (20:21:43 → 20:25:18 UTC); sin cajas, cobros ni cuentas.
- `fase-b`: `main` fusionado otra vez (`42fc58a`); puertas, unidad (4 231) e integración (209)
  verdes; concurrencia 18 de 18 en los tres aparatos y pedido compartido 3 de 3. Banco de la 188:
  5 de 5. Subida (sólo avance); CI del PR #1 `40578188619` verde (8 trabajos). Descripción del PR
  al día con la 188, las fusiones y el ensayo.
- Limpieza: las dos bases locales del ensayo con datos reales (`dp_ensayo_main`,
  `dp_ensayo_faseb`) se borraron; las exportaciones se quedan en `..\_PRIVADO\mudanza\`. Reporte
  en `docs/reports/003-funcionamiento.md`.

## 29-10-2026 · DP-11 · Morfi, modo espera, sonidos y el diseño nuevo

Encargo DP-11 + extensión «Retro». Regla de esta etapa (arranque, manda sobre el encargo): todo a
`main` y a producción en cuanto queda verificado; no hay rama `diseno` (DP-D35). Rama de trabajo:
`dp-11` desde `main`.

### Para retomar

- Postgres de desarrollo: `pg_ctl -D ".work/pg/data" start` (55433). Bases desechables de DP-11:
  `don_poncho_demo_main` (migraciones de `main`, para medir) y `don_poncho_demo_faseb` (la demo de
  Miguel). En las dos las 10 mesas se acomodaron en cuadrícula 5×2 de 160 × 220 puntos (en producción están todas en
  100,100: ver el inventario).
- Los secretos y PIN de las demos van en `%LOCALAPPDATA%\Temp\pos-don-poncho-demo\demo.json`.
  **Ojo:** `.work/env.sh` cambia `TEMP` a `D:\mpos-tmp`, donde hay OTRO `demo.json` (otra
  pimienta): las bases de DP-11 se prepararon con `TEMP` de Windows, la que usa PowerShell.
- Demo de `fase-b` para Miguel: worktree desprendido en `.work/demo-fase-b` (sobre `origin/fase-b`)
  y el lanzador `.work/demo-fase-b.ps1` (arranca Postgres, enseña los PIN de demo y sirve en
  `http://<IP>:3300`). Fuera del repositorio.
- Medir: `node scripts/medir-fluidez.mjs --url http://localhost:3400 --secretos <demo.json>`
  contra `demo-local.mjs servir --puerto 3400` sobre `don_poncho_demo_main`.
- Morfi: `M1gu3hb/Morfi-pet` en `c61aab2` (rama `claude/compassionate-cori-xn0xjj`), clonado en el
  scratchpad, sólo lectura.

### DP-11.0 · Inventario, línea base y plan

- Inventario y plan en `docs/diseno/INVENTARIO-DP-11.md`. Hallazgo: lo que cada puesto usa es
  heredado o mixto; las gemelas recompuestas de `(modelos)/restaurante/*` no están en el menú
  (DP-D36: el diseño va a las pantallas reales).
- **Subagentes:** dos Sonnet en paralelo, sólo lectura, sin worktree porque no escribieron nada
  (uno con `git archive` de `fase-b` en el scratchpad): «inventario del menú real» e «inventario
  de `src` y `fase-b`». Resultado revisado y condensado aquí; 202 llamadas, ~17 min.
- Línea base de rendimiento (CPU 4×): desplazarse 55–60 cuadros; abrir una mesa 16–20 cuadros
  (el diálogo monta los 107 platillos). `docs/reports/evidencia-004/fluidez-antes.json`.
- Producción, sólo lectura: Don Poncho con 0 órdenes y 0 pagos (aún no opera en el sistema); las
  10 mesas en la misma posición (100, 100).
- Al probar la demo de `fase-b` por la IP, el portal del comensal no cargaba:
  `crypto.randomUUID` no existe por http. Arreglo en `main` (DP-D37, `idAlAzar`, seis mutaciones
  muertas); el sitio de `fase-b` (carrito compartido) se arregla al fusionar `main`, y el contrato
  lo exige.
- Morfi en Safari: WebM con alfa no; APNG pesa 5.5 MB (a media escala); WebP animado con alfa
  2.7–3.0 MB a escala completa, 1.4 MB a media. El `ffmpeg` de esta PC no codifica HEVC con alfa.

### DP-11.1 · Morfi en el POS

- Clips 03, 07 y 11 (partido en dormido 1–76 y despertar 77–164, por medida de diferencia entre
  cuadros). WebM, WebP a 15 cuadros para WebKit y fija, en `apps/web/public/morfi/` (DP-D38).
- `PantallaDeCarga` nueva en `@morphiqpos/ui/sistema`; `verify:adopcion` la reconoce como espera.
  Morfi en `AppLayout` (carga al entrar), el portal (carga del menú y QR sin mesa) y el 404.
- «Mascota Morfi» en `configuracion.valores.experiencia`, leída por el servidor al pintar; el
  interruptor en Configuración → Apariencia.
- Mutaciones: 15 de la lógica (dos sobrevivieron al principio y destaparon un hueco real: los
  navegadores dentro de apps del iPhone y el iPad no dicen «Safari/»; dos casos nuevos los
  matan) y 3 del servidor contra Postgres: 18 de 18.
- `scripts/huella-ajena.mjs` (sólo lectura) en el repositorio: sólo tablas, no vistas
  (`fila_barra` calcula con `now()` y su md5 cambia con el reloj).
- **Ojo, base desechable en Windows:** `base-desechable.mjs subir` se queda esperando después de
  `pg_ctl start` (el postgres hijo hereda las tuberías). Con el clúster ya arriba, matar el guion
  y correrlo otra vez: se salta el arranque y termina.
- Publicación de DP-11.0: `main` = `cc8cf91` (avance sin fusión), CI `40975902351` verde,
  Production lista; humo verde; huella IDÉNTICA (119 tablas, 10 organizaciones). `fase-b`:
  fusión `1d803f9` + carrito con `idAlAzar` `38a94f2`, CI del PR `40979195835` verde (8).

### Las mesas de producción, a la cuadrícula (decisión de Miguel, 29-10)

- `scripts/acomodar-mesas.mjs` (`21637fa`): las mesas encimadas (sin posición o en el mismo punto
  que otra) van a `sala.plano` del archivo de datos (5 por fila, 160 × 220 desde (30, 40)), por
  número; lo ya acomodado no se toca. `puente.escribir` de `Mesa`, firmado por «Miguel · Morphiq».
  Ensayo en `don_poncho_demo_main` (dos vueltas: la segunda no hace nada) y mutaciones 3 de 3.
- Producción, 01:06:21–01:06:29 UTC del 30-10: ensayo antes (10 de 10), escritura, ensayo
  después (0 por acomodar). Exportaciones antes y después (`_PRIVADO\mudanza\dp11-mesas-*`):
  972 → 992 filas; sólo cambian `mesas` (las 10 posiciones), `auditoria` +10 y
  `comandos_ejecutados` +10. Humo verde antes y después; huella de las otras 10 organizaciones
  IDÉNTICA (01:02:07 → 01:07:15 UTC).

### Subagentes de DP-11.1 y DP-11.2 (todos Sonnet, sólo lectura, sin commit)

- «Exploración del modo espera» (2 en paralelo): qué despierta a Cocina y a Caja, ajustes por
  aparato, PIN al despertar, Wake Lock y dónde montar. Resultado en el scratchpad
  (`exploracion-dp11-2.md`); decisiones tomadas en DP-11.2.
- «Revisión de DP-11.1» (code-reviewer): aprobado sin críticos ni altos; un medio y tres bajos,
  atendidos o anotados en el reporte 004.
- Navegador local: `base-desechable.mjs subir` (ver el «Ojo» de arriba) y, como el servidor de
  pruebas tarda más de 5 min en compilar en esta PC, compilar antes con
  `pnpm turbo run build --filter=@morphiqpos/web` y luego `pnpm test:e2e …` (lo reusa del caché).

### DP-11.2 · El modo espera

- `apps/web/src/espera/` (reglas, preferencia del aparato, reloj, despertador, cambios de la
  lista, el gancho, la capa, el PIN) y dos piezas de configuración: «Este aparato» (pestaña nueva)
  y «Pedir PIN al despertar» junto a «Mascota Morfi» (`MascotaDelNegocio` pasó a
  `ExperienciaDelNegocio`).
- Cocina avisa por `despertador.ts` (comanda nueva; con pendientes la mantiene despierta); la Caja
  escucha en la caché de consultas la lectura `ventas_pendientes_caja` que ya hace cada 2 s.
- **Ojo, pruebas con `page.clock`:** adelantar el reloj ANTES de que la pantalla se monte no
  prueba nada (el modo espera empieza a contar después del salto). Esperar el `h1` primero.
- **Ojo, la cocina de la demo:** una comanda que deja una prueba sigue pendiente y, con
  pendientes, la cocina no se duerme. La prueba cancela la cuenta de su mesa al empezar y al
  terminar.
- Mutantes de navegador que no compilaban (una variable que queda sin usar rompe el build por
  `noUnusedLocals`): reescritos como mutantes que compilan y corridos en un segundo banco.
- **Ojo, una capa encima de un diálogo de Radix:** con el diálogo abierto, Radix marca con
  `aria-hidden` todo lo demás y deja el `body` sin toques; y se cierra si ve el foco, un toque o
  Escape fuera de él. La capa va en un portal al `<body>`, con `pointer-events-auto`, y no deja
  salir foco, toques ni teclas (DP-D39).
- Subagentes: «revisión del modo espera» (Sonnet, sólo lectura, sobre una copia limpia: cuatro
  altos corregidos), «motor de Sound Lab con TypeScript estricto» (Haiku, en el scratchpad, sin
  repo) y «dónde suenan los momentos del POS» (Sonnet, sólo lectura), estos dos para DP-11.3;
  y el flujo «re-revisión del modo espera» (dos Sonnet a la vez, más quien refuta cada hallazgo).

- **Ojo, `vercel ls` en un bucle de fondo:** sin terminal se queda colgado y no imprime nada. Para
  esperar la fila Production, correrlo en primer plano cada vez.
- **Ojo, la galería:** un cambio visible en una pantalla retratada (una pestaña nueva) pone roja la
  galería. Se declara corriendo el flujo a mano con `actualizar_galeria`, bajando el artefacto y
  subiendo SÓLO los retratos que cambian de verdad (medir los píxeles: los demás difieren por
  ruido de compresión, dentro de la tolerancia).

### DP-11.3 · Los sonidos de la interfaz

- Sound Lab entró como código: el motor (1,084 líneas) partido en siete módulos de menos de 300,
  con las lecturas por índice guardadas para el TypeScript estricto (subagente Haiku en el
  scratchpad, 41 errores, sin cambiar lo que calcula), y las 25 recetas del registro. Licencia en
  `licencias/`.
- Los momentos se encontraron con un subagente Sonnet de sólo lectura (dónde se agrega, se cobra,
  se envía a cocina; que entrar y salir RECARGAN la página y cortan el audio: por eso esperan
  300 ms si de verdad va a sonar; que la voz de Cocina es Web Speech y su cola es privada: el
  gestor mira `speechSynthesis.speaking` y `pending`).
- **Ojo, pruebas de sonido:** no hay tarjeta de audio que oír; el gestor deja `data-ultimo-sonido`
  en el documento. Y el primer toque desbloquea: una prueba que sólo teclea no oye nada.
- **Ojo, la mesa del mapa:** el mapa abre en «Interior»; la mesa 7 está en «Terraza». La prueba del
  mesero usa la 1 y la deja como estaba.
- **Ojo, sonar antes de recargar:** `login()` y soltar la sesión ya hacen navegar a la pantalla. Un
  `await` de 300 ms DESPUÉS de cambiar la sesión deja que esa navegación arranque y la recarga le
  cae encima (la prueba del PIN, en tablet y teléfono, veía `ERR_ABORTED` en el siguiente
  `goto`). El sonido va antes de tocar la sesión; el contrato lo exige y dos mutantes de orden lo
  prueban.
- **Ojo, la cabecera de 60 líneas:** `verify:cobertura` busca `PANTALLA · modelo · pantalla` sólo en
  las primeras 60 líneas. En `MesaActiva.tsx` la etiqueta estaba justo en la 60 (también en
  `fase-b`); un `import` más la sacó y la CI lo cazó. La etiqueta pasó a la primera línea de su
  comentario.
- **Ojo, los worktrees de los subagentes viven dentro del repo** (`.claude/worktrees/`): mientras
  existen, `verify:pruebas` ve sus pruebas de integración como huérfanas. El `verify` local se corre
  cuando ya no hay ninguno.
- Reconocimiento de DP-11.4 con dos lectores Sonnet de sólo lectura, cada uno en su worktree (el
  sistema de diseño; los pilotos, la navegación y lo que exigen las pruebas). Sin cambios.

## 31-10-2026 · PAR-1 · `fase-b` en `main` (fase 4) y lo que ya no se puede pedir del carrito

Sesión local en la laptop, en un worktree aparte (`.work/dp-main`, rama
`claude/carrito-producto-oculto`): la carpeta de Don Poncho se quedó en `dp-11` con su
`.claude/launch.json` sin tocar.

- **Antes:** el maestro aplicó la 186 y la 187 a la base compartida con su guion (ledger 117 → 119,
  huella de 11 negocios IDÉNTICA) y puso su PR #21 en producción. A las 19:07, Don Poncho sin caja ni
  ventas; las únicas entradas del día, de «Miguel · Morphiq».
- **PR #1 (`fase-b` → `main`) fusionado con merge** (`6ade1d9`); CI a mano sobre `main` (corrida
  41259830541) 16/16; Production `READY`. `verify:esquema` contra la compartida: verde.
- **Humo** (sin crear cuentas ni comandas; el PIN lo tecleó Miguel, con el suyo): unir la 3 a la 2 en
  el mapa y separarlas; el QR de la Mesa 1 en dos pestañas, agregar sin enviar y vaciar. Huella de
  los otros 10: IDÉNTICA. Detalle en `docs/reports/005-par-1-fase-4.md`.
- **Lo que ya no se puede pedir del carrito** (DP-D43): el mismo cambio que el maestro, con las
  pruebas primero en rojo, 7 mutaciones muertas y la base desechable `dp_par1_oculto`.
- **Ojo, el carrito exige una cuenta abierta** («Abre la mesa antes de pedir»): para probarlo sin
  crear cuentas sólo sirve una mesa que ya tenga una.
- **Ojo, unir dos mesas libres no tiene vuelta en la pantalla:** la principal dice «Unida con 3» y
  sólo ofrece «Abrir la mesa». Se separaron con `restaurante.separar_mesas` (el comando del botón).

## 01-11-2026 · DP-12 · Correcciones y funcionamiento final

Encargo en el chat de Miguel (el orquestador). Trabajo en el worktree `.claude/worktrees/dp12`,
rama `dp-12` sacada de `main` @ `4b00f9e` (la carpeta de Don Poncho sigue en `dp-11`, que no se
toca). `pnpm install` en el worktree tarda ~11 min.

### Para retomar DP-12

- Todo DP-12 está en `dp-12` y en el PR #3 (subido hasta `8b2417f`): 12.1 a 12.6, la galería
  declarada (27 retratos) y el reporte `docs/reports/006-correcciones.md`. 12.7 no se rescata.
  Integración completa 59/278 y unidad en verde en local; navegador de DP-12 en verde en los tres
  aparatos; reauditoría limpia.
- Falta: la CI del PR #3 en verde → fusionar con merge (sin squash ni rebase) → esperar la fila
  Production de Vercel → humo sin PIN (entrada 200, 404 con Morfi, cabeceras) → huella de los otros
  10 negocios contra `_PRIVADO\mudanza\huellas-dp12\antes-despliegue-dp12.json` (IDÉNTICA desde
  12.1). Los PIN reales los teclea Miguel (sección 3 del reporte).
- Los subagentes de 12.4 y 12.6 ya se integraron; sus worktrees (`agent-aae7355ccdfa9cbb4`,
  `agent-a2dba111da2fb3b4b`) se pueden borrar. El encargo de 12.5 para un tercero (`brief-s3.txt`)
  no se usó: 12.5 se hizo aquí.
- Pendiente para después de DP-12: el margen «sin receta» en el Cierre del día, el corte y Caja.
- Servidor de pruebas: `next start -p 3200` sobre la base desechable 5435
  (`export $(node --conditions=react-server scripts/base-desechable.mjs entorno | grep -v "^$" |
  xargs)`). Si `TaskStop` no lo mata, el PID del 3200 sigue vivo: detenerlo antes de reconstruir.
- **Ojo, integrar un subagente:** su parche sale de `git diff HEAD` (no de `git diff`: lo que
  dejó en su índice, como un borrado, no viene). Correr TODAS las puertas `verify:*` antes de
  subir: la CI las corre y una sola roja cuesta otra vuelta de 20 minutos.

### DP-12.1 · Datos de prueba fuera y mantenimiento sólo para plataforma

- Decisiones de Miguel (01-11): marca en `configuracion.valores.plataforma` (DP-D44) y que la mesa
  abierta del POS enseñe el carrito pendiente del portal (DP-12.2).
- `scripts/limpiar-ventas-de-prueba.mjs` (se niega si hay pagos, cajas u otra cuenta) y
  `scripts/marcar-plataforma.mjs`. Ensayo: exportación de producción importada a
  `dp12_ensayo` en la base desechable (135 tablas, 1171 filas, idénticas); ahí el dueño del
  restaurante recibe `SIN_PERMISO` y el de plataforma purga.
- **Producción, 20:43:27–20:43:36 UTC:** marca de «Miguel · Morphiq»; la cuenta de la Mesa 1
  (`e8074bb7…`, $145, «Conejo al pastor», 31-10 12:02) cancelada con «Prueba» y la mesa libre;
  `purgar_ventas` sin revertir inventario (1 orden, 1 línea, 1 comanda, 1 renglón de comanda).
  Exportaciones `_PRIVADO\mudanza\antes-dp12` y `despues-dp12-1` (1171 → 1174 filas): sólo
  cambian `auditoria` +3, `comandos_ejecutados` +3, `configuracion`, `eventos_mesa` +1, `mesas`
  (la 1, libre) y lo purgado. Huella de los otros 10 negocios IDÉNTICA (20:36:32 → 20:43:55 UTC,
  `_PRIVADO\mudanza\huellas-dp12`).
- **Ojo, el guion corre con el código del worktree:** con la guarda ya escrita, la purga desde el
  guion también exige la marca. Por eso se marcó antes de purgar.
- **Ojo, base desechable:** si `subir` se cuelga, NO matar la tarea (mata al postgres hijo y queda
  a medias): `pg_ctl -D "D:\mpos-tmp\morphiqpos-base-desechable" stop -m fast`, arrancarlo con
  `pg_ctl ... -o "-p 5435" -w start < /dev/null > /dev/null 2>&1` y correr `subir` otra vez (se
  salta el arranque). Su superusuario es `morphiqpos`. Integración:
  `DATABASE_URL_PRUEBAS=postgres://morphiqpos@localhost:5435/morphiqpos_desechable`.
- Subagentes: flujo «dp12-mapa», 7 Sonnet de sólo lectura, dos a la vez (mapa del código de cada
  punto del encargo).

### DP-12.2 · El portal: los comensales arman, el mesero confirma (DP-D45)

- Servidor: `portal/quien-envia.ts`, `carrito-llamar.ts`, los cambios de `carrito*.ts`;
  `restaurante/carrito-del-salon.ts` (olvidar al cerrar la cuenta, al cobrar y al cerrar la última
  caja; mover al unir o cambiar de mesa) y `carrito-del-mesero*.ts` (cuatro comandos y dos lecturas
  POST). `pedido.ts` expone `comandarLasLineas` (el cuerpo de `enviar_pedido`).
- Pruebas contra Postgres: `carrito-sin-cuenta` (12), `carrito-doce-telefonos` (3),
  `restaurante/carrito-del-mesero` (7); las de DP-9.5 siguen en verde (la de «cuenta anterior»
  se reemplazó por la regla nueva: se conserva lo de antes de abrir y se olvida al cerrar).
- **Ojo, `mesaConPortal`:** por omisión envían los comensales (las pruebas de DP-9.5 hablan de
  eso); el negocio real nace con el mesero. `envian: 'mesero'` para las nuevas.
- **Ojo, el camino del mesero exige estación** (regla 10): una prueba que lo use siembra la general.
- **Ojo, e2e:** `prepararElPortalDelComensal` con `pedidosDelComensal` y sin `envian` deja
  «También los comensales» y que abran su mesa (como antes de DP-12). `enviarElPedidoDeLaMesa`
  abre la mesa desde el carrito cuando el botón es «Abrir la mesa y enviar».
- **Ojo, la CI del PR #3:** `auth-entrar-cuota.test.ts` simula la entrada sin base; leer
  `es_plataforma` en la ruta pide su doble (`vi.mock('@morphiqpos/app/mantenimiento')`). Correr
  `pnpm test:unit` entero antes de subir.
- **Ojo, la galería de retratos:** Configuración (sin «Mantenimiento» para el dueño), Portal QR
  (la sección «Pedidos desde el portal») y Mesas («Escanear QR») cambian a propósito: se declaran
  con el flujo `actualizar_galeria`.
- Ojo, un `next build` local puede fallar por la red al bajar Inter de Google Fonts: reintentar.

### DP-12.3 · Unir mesas (DP-D46)

- Dominio: `sala/forma-de-la-union.ts` (`formaDeLaUnion`, `vecinaQueLlama`). Servidor:
  `restaurante/notas-de-la-union.ts` (alergias y celebración a la principal), la guarda de limpieza
  en `union-de-mesas.ts`, `sinCabezaViva` en la guarda del puente (`puente/tipos.ts`, `escribir.ts`,
  `mapa.ts`) y «vaciar el mapa» con uniones vivas.
- Pantalla: `apps/web/src/restaurante/unir-mesas/` (`MesaQueTiembla`, `use-arrastre-de-mesas`,
  `AvisoDeMesasOcupadas`, `UnirMesasEnElMapa` rehecho), `MesaShape.jsx` con `caja`, y `Mesero.jsx`
  (la unión fundida en el mapa, «Separar mesas» en el globo, `?unir=` limpio).
- Pruebas: `union-con-gente.integracion.test.ts` (5), `forma-de-la-union.test.ts` (7),
  `union-dp12-3.test.ts`; e2e `unir-mesas-al-tacto.spec.ts` (tacto real por CDP; la distancia
  dedo-mesa cuadro por cuadro) con sus ayudantes en `pruebas/e2e/ayudantes/tacto.ts`.
- Resultados: mutaciones 16 de 16 (servidor, dominio y pantalla); `unir-mesas-al-tacto` en tableta
  1280 × 800, teléfono y PC; las vecinas de 12.2 y 12.3 en verde en los tres (10 en tableta, 8 en
  teléfono y PC). El aviso con gente no nombra la mesa desde la que se entró a unir (la propia).
- Ojo, `restaurante-operaciones` 6 y 6b: unir dos mesas con cuenta pasa por «¿Unir de todos
  modos?» antes de «¿Qué número queda?» (`unirPorLaPantalla`).
- **Ojo, la prueba de tacto usa el salón de la demo tal cual:** Interior 1 y 2 (cuadradas), 3 y 6
  (redondas chicas, una sobre otra) y Terraza 7 y 8 (redondas). Si se reacomoda la demo, se
  reacomoda la prueba.
- **Ojo, el temblor es `transform`:** lo que mueve la mesa (arrastre, vecina, asentarse) va en
  `translate`/`scale`. Ponerlo en `transform` apaga el temblor.
- **Ojo, el aviso con gente lee el total de la cuenta por el puente** (`Venta`): si el rol no la
  lee, el aviso sale sin importe; nunca se une sin preguntar.

### DP-12.4 · El mesero cancela, y el corte lo dice (DP-D48)

- Hecho por un subagente (Sonnet, en su worktree `agent-aae7355ccdfa9cbb4`, base 5436, puerto
  3201; sin commit): servidor, pantalla, corte, Registros y pruebas. Integrado aquí con
  `git apply -3` sobre `dp-12` (sin conflictos); las matrices de permisos y aislamiento se
  regeneraron sobre lo integrado y coinciden.
- Pruebas: integración partida en `cancelacion-del-mesero` (quién puede) y
  `cancelaciones-del-corte` (el corte y Registros), con el salón sembrado en
  `restaurante/pruebas/cancelacion-real.ts` (el original pasaba de 300 líneas); unidad y contrato
  `cancelaciones-heredado`; navegador `cancelacion-del-mesero.spec.ts` (ayudantes en
  `pruebas/e2e/ayudantes/cancelar-desde-la-mesa.ts`), verde en tableta, teléfono y PC en el
  worktree del subagente. Mutaciones: 28 de 28 (S11 sobrevivió y se agregó el caso de dos
  platillos en una comanda; S14 y W7 no compilaban y se rehicieron).
- **Ojo, el corte heredado y el de Cierre diario pintan las cancelaciones con el MISMO código**
  (`corte/cancelaciones.ts`, `SeccionPintada`): cambiar uno cambia los dos.
- **Ojo, `CancelarDelMesero` relee qué platillos siguen en la cuenta:** el puente sirve también los
  anulados en `DetalleVenta`.
- Lo que el subagente no verificó: mutantes del spec de navegador (cada uno pediría un build) y
  una captura visual de Registros y los cortes (se miraron por texto).

### DP-12.5 · Estaciones de punta a punta (DP-D47)

- Prueba nueva `pruebas/e2e/estaciones-de-punta-a-punta.spec.ts` (ayudantes en
  `pruebas/e2e/ayudantes/estaciones.ts`): en Configuración → Negocio se crean cuatro estaciones,
  una se renombra y otra se desactiva (su categoría vuelve a la general); cada estación recibe su
  categoría y su cocinero; el mesero manda un platillo de cada una y salen 5 comandas, una por
  estación; cada Cocina ve y ANUNCIA (voz espiada) sólo lo suyo y la dueña ve las 5; cada estación
  conecta sólo su teléfono y el de Parrilla ve lo suyo; el pedido del comensal desde el portal
  también se parte. Verde en tableta, teléfono y PC; `estaciones-de-cocina` sigue verde.
- Arreglo: `EstacionesPreparacionSection.jsx` ya no traga el error al mover las categorías de la
  estación que se apaga (contrato `estaciones-heredado.contrato.test.ts`, visto en rojo).
- **Ojo, el reseteo de la demo no borra las estaciones que crea una prueba:** la prueba usa nombres
  propios por corrida y al final apaga las suyas.
- **Ojo, la pregunta «¿Desactivar estación?» se cierra al tocar «Sí, desactivar»:** lo del
  servidor se espera con `expect.poll`.
- Hecho aquí, sin subagente (el lugar de un tercero no se había liberado y así se ahorraba su
  instalación y su build).

### DP-12.6 · Las pantallas (DP-D49)

- Hecho por un subagente (Sonnet, en su worktree `agent-a2dba111da2fb3b4b`, base 5437, puerto
  3202; sin commit) salvo el punto 6 (25 mesas, `df8827d`, hecho aquí). Integrado con
  `git apply -3`: sólo chocó `scripts/aspecto-permitido.json` (12.4 y 12.6 agregaron entradas; se
  conservan las dos). **Ojo:** los dos borrados del sonido viejo estaban en el ÍNDICE del
  subagente y `git diff` no los trae: se borraron a mano (usar `git diff HEAD` la próxima vez).
- Pruebas: unidad y contratos (nombre de mesa, margen, sonido, pantallas sin estorbos),
  integración `limpieza-de-solicitudes` (10) y `comando.sin-novedad`; navegador
  `pantallas-sin-estorbos.spec.ts` (teléfono 5 de 5; en tableta y PC dos pasan y tres se saltan
  por ser de teléfono) y las vecinas (sonidos, menú QR, solicitudes, portal, teléfono de cocina).
  Mutaciones 61 de 61 (12 de navegador contra `next dev`).
- **Ojo, la galería:** `heredado-mesero` cambia en todos los estilos (sale «Activar sonidos»), y
  también Configuración, Portal QR y Ventas: declararla con `actualizar_galeria`.
- **Ojo, una tableta de cocina recargada sin tocar** no suena hasta el primer toque (ya no hay
  botón «Activar sonidos»); el teléfono de cocina conserva «Toca para activar el sonido».
- Lo que el subagente no verificó en el navegador: el margen en tablero, Registros, PDF, gráfica y
  CSV (unidad y contratos), la insignia «Vista general» de Cocina y Ventas después de quitar la
  pastilla.

## 02-11-2026 · DP-13 · Que funcione, la auditoría de DP-12 y QA

Encargo en el chat de Miguel (el orquestador). Mismo worktree (`.claude/worktrees/dp12`), rama
`dp-13` sacada de `dp-12` @ `d1021fb`.

### DP-13.1 · DP-12 a producción

- CI manual del PR #3 sobre `d1021fb` en verde; fusión con merge (`bb06497`, por la API de GitHub:
  `gh pr merge` falló con un error de GraphQL). Production de Vercel lista a las 15:28 (la fila
  Production, no el preview).
- Humo sin PIN: entrada 200, 404 con Morfi, cabeceras (CSP con nonce, HSTS, `X-Frame-Options`,
  `Permissions-Policy` de DP-12).
- Huella de los otros 10 negocios contra `antes-despliegue-dp12.json`: IDÉNTICA (122 tablas, 275
  conteos), guardada en `_PRIVADO\mudanza\huellas-dp12\despues-despliegue-dp12.json`.

### Los agentes de DP-13

| Agente | Modelo | Encargo | Resultado |
| --- | --- | --- | --- |
| A · `agent-a7406910ce51d2c86` (base 5439, puerto 3204) | Sonnet | 13.4: 18, 19, 20, 22, 23 | Hecho. Spec nuevo `menores-dp13` 9/9 en los tres aparatos; 67 de 67 mutantes muertos. Integrado aquí (ver abajo). |
| B · `agent-a32802749101128cd` (base 5440, sin navegador) | Sonnet | 13.3: 8 (plataforma), 9 (purgas) y 13.4.25 | Hecho. Candado único del documento de configuración, `mantenimiento.quitar_plataforma`, la purga de un día real (uniones, bitácora de cuentas, carritos, avisos, lista de espera). Integración completa 63/305; 53 de 53 mutantes destructivos muertos. Se cortó una vez por el límite de uso y se retomó con su archivo de progreso. Integrado aquí. |
| Revisión · workflow `wf_7eb1b5de-d5e` (2 a la vez, cada hallazgo con su verificador) | Sonnet | Revisar 13.2 en servidor/SQL y en permisos/pantallas | 8 hallazgos confirmados de 12; los 8 arreglados con su prueba primero (ver abajo). Se cortó por el límite de uso y se retomó con `resumeFromRunId`. |
| C · `agent-a2283480c75286caa` (base 5441, puerto 3205) | Sonnet | 13.3: 11 (id del teléfono firmado), 12 (el comensal se entera), 13 (abrir y enviar en una transacción), 15 (cuenta pedida) | Hecho. Pruebas primero; 63 de 63 mutantes; e2e nuevo `portal-dp13` 9/9. Sus 3 fallos de navegador en teléfono (`restaurante-menu-personalizado`, dos de `restaurante-portal-qr`) salen igual SIN su cambio: el ayudante busca el mapa de Configuración → Mesas y el teléfono enseña una lista (el CI corre en escritorio). Integrado aquí; un solo choque (`aspecto-permitido.json`, las dos declaraciones). |
| QA-1 · `agent-a2a8d854a29952e9f` (copia en el 5442, app en el 3210) | Sonnet | 13.5: un día intenso en Playwright con tabletas, teléfonos y la PC a la vez | Hecho (3 h 40 min, 512 herramientas). 8 specs en `pruebas/e2e/qa/`, 48 comparaciones esperado/real; ningún alto; medios QA1-4, 5, 8 y 9 (QA1-9 resultó del guion). `docs/qa/HALLAZGOS.md` y `JORNADA-2026-11-03.md`. |
| QA-2 · `agent-aa4b8b81f5faa575c` (la misma copia, sólo lectura; su sandbox en el 5499) | Sonnet | 13.5: que cuadre por la app y por la base; huérfanos, uniones, carritos y avisos; sondeos de seguridad | Hecho. Ningún alto; 8 medios y 3 bajos, todos arreglados con su prueba. `docs/qa/HALLAZGOS-QA2.md` y `consultas-qa2.sql` (sólo lectura). |

- **Ojo, integrar con `git apply -3`:** si un archivo del parche tiene cambios sin preparar aquí,
  `-3` se niega («does not match index») y no aplica NADA. Se aplicó el resto sin `-3`
  (`--exclude`) y el archivo compartido (`CorteTicket.jsx`) con `git add` + `-3 --include` +
  `git reset -q`. Los nuevos del agente se exportan con `git add -N` antes de `git diff HEAD`.

### DP-13.2 · Los bloqueantes (DP-D50 a DP-D55)

- **Cámara (DP-D54):** `Permissions-Policy` por ruta (`apps/web/permisos-del-navegador.mjs`); la
  puerta de cabeceras en vivo lo exige. Sin cámara, «Elegir la mesa» de una lista (antes un campo
  numérico); «Pedido del portal» en la pulsación larga. e2e `escanear-qr-con-camara` con cámara
  simulada y con el permiso negado: 3 de 3 aparatos. **Ojo:** en el mapa, `hasText: '4'` también
  atrapa la capacidad de otra mesa: filtrar por el número al inicio.
- **Carrito fantasma y avisos (DP-D55):** integración `carrito-fantasma` (4) y `aviso-del-pedido` (7).
- **Sonido (DP-D53):** unidad y contrato del proveedor; e2e `sonido-bloqueado` en tableta. **Ojo:**
  en Playwright `navigator.userActivation` ya viene activo (la sesión se hizo con clics): la voz
  falsa cuenta el primer gesto de la página por su cuenta.
- **Corte (DP-D50):** integración `cancelaciones-por-caja` (6) y la vieja; unidad del corte.
- **Margen (DP-D52):** integración `margen-sin-receta` (3), contrato de las seis pantallas
  heredadas. **Ojo:** el resumen de Caja sin caja abierta no traía `economia` y la página se caía
  (lo cazó la e2e de cancelar, no la unidad).
- **Cancelar (DP-D51, D-5):** integración `cancelar-con-permiso` (11); e2e de D-5 sin `fixme`.
- **Lo que cazó la revisión (8, cada uno con su prueba primero):**
  - El carrito caducado revivía al abrir la mesa (se mide hasta la apertura; abrir lo caduca).
  - Vaciar el carrito por la caja, el cierre del día o la caducidad dejaba vivo «Pedido listo para
    confirmar».
  - Cancelar la cuenta volvía a anular las líneas ya anuladas.
  - Agregar o quitar del carrito no tomaba el candado; enviar no caducaba.
  - **Unir mesas borraba el «ya se pidió / ya se imprimió»** de la absorbida y el mesero cancelaba
    sin PIN; y el mesero que unía a la suya la mesa de otro se volvía su dueño. Ahora la cuenta que
    queda carga con sus absorbidas (también ya separadas): `codigo_caja` dice que se pidió.
  - **La cámara sólo servía con carga completa:** `Permissions-Policy` es del documento y Next
    navega sin cargar (la mesera que abre `/caja` cae en `/mesero` con `camera=()`). Abrir el
    escáner en un documento sin cámara recarga una vez con `?escanear=1`
    (`apps/web/src/cliente/escaner-del-documento.ts`). e2e: entrar por `/caja` y escanear.
  - Al cajero (no ve márgenes) le salía «—, sin receta»: ahora no se le pinta ni costo, ni
    utilidad, ni margen (`seVeElMargen`), tampoco en el detalle de Ventas.
- Integración completa: 70 archivos, 358 pruebas (con 13.3). Mutaciones: web 26 de 26; servidor
  41 de 42 (el vivo es equivalente: ninguna línea queda hoy con menos piezas hechas que su
  cantidad). Los mutantes que sobrevivieron al principio eran protecciones redundantes del
  carrito (abrir la mesa lo borra y la lectura mide hasta la apertura): cada una tiene ya su
  prueba sola.
- Navegador contra `next start` (build 3): `escanear-qr-con-camara` 3/3 (con entrar por `/caja`),
  `cancelacion-del-mesero` 3/3, D-5 de `restaurante-operaciones`, `unir-mesas-al-tacto` 3/3,
  `pedido-compartido`, `portal-modo-mesero` 6/6, `restaurante-portal-qr` 2/2. **Ojo:** el 422 de
  «sin PIN» es la respuesta esperada; el vigilante de fallos la perdona sólo mientras se espera
  (`sondeando`). La limpieza del D-5 cancela con la dueña: la cajera ya necesitaría el PIN.

### DP-13.3 · Plataforma, purgas, unir y separar, el sonido y la merma (DP-D56, DP-D57)

- **8, 9 y 25 (agente B):** su diff se revisó entero y se aplicó sin conflictos (ningún archivo en
  común). Se agregó `eventos_mesa` a la purga de ventas (prueba primero: quedaban 17 filas del día)
  y el lector nuevo de configuración de 13.2.7 a su inventario.
- **10 (DP-D56):** prueba escrita antes del código; integración 5/5; mutaciones 10 de 10.
- **14:** «Sonido de este aparato» junto a «Salir»; e2e nuevo en `sonidos`.
- **16 (DP-D57):** `motivos_merma` es global (de los 11 negocios): se guarda con `platillo_rehecho`
  y se reconoce por la referencia; el corte dice «Por cancelación». Integración 5/5 (incluye la
  pieza anulada y el costo del insumo); mutaciones 9 de 10 (el vivo es redundante:
  `lineasDeOrden` ya deja fuera lo anulado).
- **Ojo, la base falsa de unidad no conoce `eb.fn.countAll`:** contar filas con `select('id')`.
- **Ojo, `python -I` ignora `PYTHONIOENCODING`:** el banco imprimía «→» y se caía; `-X utf8`.
- **Ojo, en el teléfono el menú es un cajón `z-[80]`:** un diálogo abierto desde él (`z-50`) queda
  debajo. El de «Sonido de este aparato» vive fuera del cajón y tocar el botón lo cierra. El botón
  mide lo que «Salir» (con la primitiva la barra crecía y la galería lo cazó).
- `pnpm verify` local: la cadena sin las cuatro puertas que miran Postgres 17 o la base viva
  (`entorno`, `esquema`, `rls`, `acople`), como en DP-2; la completa corre en el CI del PR. Verde;
  dos archivos de integración se cortaron por «Connection terminated» con la máquina cargada y
  pasaron al repetirlos.
- e2e con el build final: `sonidos` 19/19 (1 omitida de antes), `cancelacion-del-mesero` 3/3 (ya
  con la merma), `menores-dp13` 9/9, `unir-mesas-al-tacto`.

### Parte A a producción (03-11)

- PR #4 (`dp-13` → `main`): CI completo en verde (10 de 10) tras regenerar la galería en CI
  (`workflow_dispatch` con `actualizar_galeria`, corrida 41580477442; 45 retratos, sólo el pie de
  la barra). Fusión con merge `2896f4c` (por la API de GitHub), a nombre de M1gu3hb.
- Production de Vercel lista (la fila Production). Humo sin PIN: `/`, `/login-pos`, `/qr/…` 200,
  404 con Morfi; cabeceras en vivo con la puerta (`camera=(self)` sólo en `/mesero` y `/pos`).
- Huella de los otros 10 contra la de antes del QA: IDÉNTICA
  (`_PRIVADO\mudanza\huellas-dp13\despues-despliegue-a.json`).

### Parte B a producción (03-11)

- PR #5: CI completo en verde (10 de 10). Fusión con merge `7b36dd0`, a nombre de M1gu3hb.
- e2e antes de subir (build con la parte B): `portal-dp13` 9/9, `portal-modo-mesero` 6/6,
  `pedido-compartido`, `restaurante-portal-qr`, `botones-del-menu-qr`, `restaurante-menu-personalizado`
  y `portal-sin-asignacion` en escritorio. Integración completa 75/397 (una de carrera se cortó con
  la máquina compilando y pasa sola); portal 17/112.
- Production lista; humo sin PIN y cabeceras en vivo en verde; huella de los otros 10 IDÉNTICA
  (`despues-despliegue-b.json`).

### Producción antes del QA (sólo lectura, 03-11)

- Huella de los otros 10: `_PRIVADO\mudanza\huellas-dp13\antes-qa.json` (122 tablas, 275 conteos).
- Exportación de `don-poncho` (`_PRIVADO\mudanza\dp13-antes-qa`, 135 tablas, 1174 filas): 0 cuentas,
  0 cajas abiertas, 10 mesas libres, 0 carritos, 0 avisos vivos, «sólo el mesero envía», y **sin
  fila en `folios`**: el primer ticket real sale como el 1.
- La copia del QA: clúster propio en el 5442 (`morphiqpos_qa`), importada idéntica (filas y md5), con
  PIN de prueba propios (el mapa sólo en `_PRIVADO\qa-dp13`).


### DP-13.5 · El QA intensivo (03 al 05-11)

- **La copia:** clúster propio en el 5442 (`morphiqpos_qa`), importada idéntica a producción, con
  PIN de prueba de 4 cifras (el teclado de acceso toma 4; los de 6 de la primera preparación no se
  podían teclear: QA1-1, descartado). La app en el 3210, compilada de `dp12`.
- **Ronda 1:** QA-1 (la jornada) y QA-2 (las cuentas), en paralelo; ningún alto. Se arreglaron
  todos los medios y los bajos que se reprodujeron, cada uno con su prueba escrita antes y su
  mutación, en cinco tandas (`b1af7d9`, `724550c`, `7e18f8e`, `74918b3`, `8faf28c`; ver
  `docs/qa/` y `docs/reports/007-qa.md`). QA1-9 resultó del guion: comparaba en minúsculas un
  título que el CSS pinta en mayúsculas (`innerText` devuelve lo que se ve).
- **El hallazgo que más pesa (QA1-4):** el mesero mandaba a cocina los platillos con opción
  obligatoria sin ella. En el menú real son la quesadilla, todos los pulques, los jugos y los
  licuados. El puente no trae `modificadores` (son tres tablas); ahora los da
  `restaurante.opciones_de_los_platillos`, y el editor de Productos ya no abre vacío un juego que
  al guardar se reemplaza entero.
- **Ronda 2 (05-11):** los mismos guiones con todo arreglado: la jornada 8 de 8 y las consultas de
  QA-2, 34 de 34 sin filas sobre un día sin purgar. Cazó dos errores de mis arreglos: el CSV de
  cortes perdió las ventas por método (el puente las agrega en `adjuntarTotalesDeCaja`, fuera del
  mapa) y la guarda de QA1-4 perdía el toque si las opciones no habían llegado
  (`restaurante-concurrencia`). Los dos con su prueba.
- **Ojo, la máquina se reinició el 04-11:** los clústeres desechables no arrancan solos. `pg_ctl
  start` desde Git Bash con la salida a un tubo se queda colgado: lanzarlo en segundo plano con la
  salida a `/dev/null`.
- **Ojo, `innerText` y `text-transform`:** un título con `uppercase` sale en mayúsculas en
  `innerText`; comparar sin distinguir mayúsculas (o con `textContent`).
- **Ojo, la tarjeta de acceso:** el nombre es el primer párrafo y el puesto el segundo; buscar el
  texto exacto en cualquiera casaba a «Cocina» (persona) con todos los cocineros. El ayudante busca
  ya en el primero (`pruebas/e2e/ayudantes/sesion.ts`).
- **Observación de las purgas:** después de una purga de mantenimiento el kardex ya no explica el
  saldo y quedan mermas que citan una anulación purgada. Es lo que hace la purga de datos de
  prueba (sólo plataforma); un día real no lo produce.

### Parte C a producción (05-11)

- PR #6 (`dp-13` → `main`): CI completo en verde (26 de 26, la galería sin cambios: no hubo que
  regenerarla). Fusión con merge `187c172` (por la API de GitHub), a nombre de M1gu3hb.
- Production de Vercel lista (`dpl_3Esss…`, `READY`). Humo sin PIN: `/`, `/login-pos`, `/mesero`,
  `/caja`, `/registros` 200 y 404 en una ruta que no existe; cabeceras en vivo con la puerta (6 de 6,
  `camera=(self)` sólo en `/mesero` y `/pos`); la ruta nueva contesta 403 sin sesión.
- **Observación:** un POST a una ruta que no existe pinta «no encontrada» con 200 (el GET da 404).
  Es de Next, de antes; no se tocó.
- Huella de los otros 10: IDÉNTICA contra la de antes del QA (`despues-despliegue-c.json`).
- Exportación de `don-poncho` antes de la parte C (`_PRIVADO\mudanza\dp13-antes-c`): idéntica, tabla
  por tabla, a la de antes del QA (el QA corrió entero sobre la copia). Después del despliegue:
  `dp13-despues-c`, también idéntica (y `--exigir-cerrado` pasó: 0 cuentas vivas y las cajas cerradas).

## 06-11-2026 · DP-14 · Correcciones del 6-11, descuentos con clave, dos cajas y la mudanza del lunes 9

Encargo: corregir todo lo de la auditoría del 6-11 sobre `main@ea47ed0`, lo que decidió Miguel
(dos cajas, descuentos con clave) y mudar a Don Poncho a su propio proyecto de Supabase el lunes
9-nov (instalación el sábado 14). El documento `AUDITORIA-2026-11-06.md` no está en el proyecto:
se trabajó con la lista del encargo. Rama `dp-14`, desde `ea47ed0`.

### Agentes

| Agente | Modelo | Encargo | Resultado |
| --- | --- | --- | --- |
| A (worktree `dp14-a`, base 5446, web 3241) | Sonnet | 14.1-5 · la barbacoa por kilo de punta a punta | Entregado. Una línea por peso es una pieza indivisible al dividir; «½ kg» en comanda, teléfono, cobro, ticket y portal. Integración 14 casos, navegador 15 de 15 (3 aparatos × 5 specs), mutaciones 13 de 13. Revisión (Sonnet): «listo», 3 hallazgos bajos. |
| B (worktree `dp14-b`, base 5447, web 3242) | Sonnet | 14.1-3 · la mesa limpia no borra a la familia nueva; 14.1-4 · el mesero agrega aunque falle la lectura de opciones | Entregado. Limpiar borra sólo lo anterior al cierre de la cuenta; opciones con 8 s, «Reintentar» y la última lectura guardada. Integración (rojo visto), navegador 6 de 6, mutaciones 19 de 19. Revisión (Sonnet): «listo», 4 hallazgos bajos. Queda el arranque en frío: lo cierra el puente (sesión principal). |

Cada uno con revisión adversarial (Sonnet, sólo lectura) y corrección. Ninguno hace commit, push
ni toca producción: integro su diff, verifico y hago el commit.

### 14.1 y 14.2 (sesión principal)

- **Lo quitado (14.1-1, DP-D62):** `DetalleVenta` sólo sirve lo que se sigue cobrando; lo quitado,
  en `RenglonQuitado` (sin importes), tachado en Ventas. Prueba de integración antes del código
  (`puente/renglones-quitados`, 3 casos: el ticket, el cobro y cada parte de la división suman su
  total) y de navegador (`quitado-en-la-caja.spec.ts`).
- **La Caja descuenta y cancela (14.1-2):** `DescuentoDeLaCuenta` y `CancelarLaCuenta` en el
  cobro de `Caja.jsx` (también en las partes, por `Venta.orden_padre_id`).
- **Descuentos con clave (14.2, DP-D61):** «Permitir descuentos»; todo descuento con PIN (la
  gerente vuelve a teclear el suyo); la firma lleva el monto; uso único con el nonce en la
  auditoría y un candado consultivo; tope de quien autoriza; respaldo por puesto; el corte y el
  Cierre del día los listan con quién y por qué. 9 casos de integración
  (`restaurante/descuento-con-clave`), 1 del corte (`caja/corte/descuentos-del-corte`), 4 de
  unidad de la firma; las pruebas que descontaban sin clave, al día.
- **Dos cajas (14.2, DP-D60):** «Cajas abiertas a la vez» 1 o 2; «Ya se cobró en Caja 1»; «Ya hay
  2 cajas abiertas: cierra una». 6 casos de integración (`caja/dos-cajas`), con dos cobros a la vez.

### 14.3 · preparar la mudanza

- Inventario (sólo lectura, 06-11): sin funciones Edge ni webhooks; `pg_cron` con la tarea de la
  053; el bucket `pos-don-poncho` con 0 archivos; 9 variables en Vercel Production (cambian 5).
  Región: `us-east-2`.
- Exportación de hoy para el ensayo (`_PRIVADO\mudanza\ensayo-dp14`): 135 tablas, 1,174 filas,
  0 archivos, 20 s, con `--exigir-cerrado`.
- Guías: `docs/infra/MUDANZA-FASE-B.md` al día y `docs/infra/MUDANZA-LO-QUE-HACE-MIGUEL.md`.

### La parte B, integrada (los agentes, revisados)

- Los parches de los dos agentes se aplicaron sobre `dp-14` (sólo chocó `aspecto-permitido.json`:
  se quedaron las dos entradas). Revisados por mí además de su revisor:
  - **B, hueco del arranque en frío:** la «existencia» del puente (`ProductoTerminado.tiene_opciones`,
    un `exists` sobre `producto_modificadores`) y `pideOpciones` con la pista primero; si la pista
    dice «tiene» y la lectura guardada no se los conoce, se relee en vivo; cerrar el diálogo cancela
    el toque (hallazgos bajos de su revisor). Prueba de integración en rojo antes; banco 3 de 3.
  - **A:** tres declaraciones de `cantidad_variable_snapshot` como `number | string` (el puente sirve
    `number`): corregidas, `verify:tipos-de-pantalla` verde.
- La CI del PR #8 (parte A sola) dio dos rojos esperables: `restaurante-operaciones` leía lo anulado
  de `DetalleVenta` (ahora lo lee también de `RenglonQuitado`) y la galería de `/configuracion` (las
  pestañas nuevas): se regenera con el trabajo de CI a mano y viaja en el mismo PR.
- `pnpm verify` local de todo junto: verde (unidad 396 archivos / 4859 pruebas; integración 92 / 453).
