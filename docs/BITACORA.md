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
