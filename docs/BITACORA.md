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
