# DECISIONES · POS Don Poncho

Cada decisión estructural con sus alternativas y su consecuencia. Una decisión superada no se borra:
se marca y se apunta a la nueva. Las del maestro siguen en su repositorio (`M1gu3hb/MorphiqPOS`,
`DECISIONES.md` y `docs/fase-2/05-DECISIONES.md` en `5f4534c`).

---

## DP-D01 · Origen: `MorphiqPOS@5f4534c` · 25-10-2026

- **Contexto:** el encargo pide copiar el restaurante y el núcleo del maestro, no reescribir.
- **Alternativas:** fork con su historia; paquetes versionados del maestro; copia por
  `git archive` con historia nueva.
- **Elección:** `git archive 5f4534c` (merge del PR #18, `origin/main` confirmado con `git fetch`),
  historia nueva. `ORIGEN.md` registra qué viajó y qué no.
- **Consecuencia:** nada de `.env`, `historico/`, `.work/` ni los siete worktrees sin integrar del
  maestro. Las correcciones se rastrean contra `5f4534c`.

## DP-D02 · El repositorio es público · 25-10-2026

- **Contexto:** el encargo pedía detenerse si `M1gu3hb/POS-Don-Poncho` era público. Lo era.
- **Decisión de Miguel:** «no te detengas, ignora esa parte».
- **Consecuencia:** cero PIN, secretos, llaves o datos personales en el repo; los accesos van a
  `..\_PRIVADO\ACCESOS-DON-PONCHO.md`. Los minutos de Actions de un repo público no se cobran,
  pero la CI igual corre sólo en PR y a mano (DP-D08).

## DP-D03 · Poda por alcanzabilidad, no por nombre de carpeta · 25-10-2026

- **Método:** un grafo de imports, enlaces entre páginas y rutas `/api` del cliente, desde lo que
  abre cada puesto del restaurante (las doce pantallas heredadas del menú real —D-52 del maestro—,
  «Cierre del día», las vistas `restaurante/*`, el login y el portal QR). Las URL que el cliente
  arma con funciones no las ve el detector, así que la API se clasifica por el MÓDULO de comandos
  que importa cada ruta, y se confirma con tipos, pruebas y navegador.
- **Se va:** los módulos `abarrotes`, `cafeteria`, `ferreteria`, `salon` y el dominio `agenda`; sus
  161 rutas y pantallas; la venta de mostrador (suspender, retomar, apartadas, búsqueda, más
  vendidos); los cortes de los otros giros; el repo de tomas de inventario (sin llamadores).
- **Se queda, aunque hoy no tenga pantalla:** el núcleo y el dominio del restaurante completos
  —p. ej. lista de espera, separar mesas, marchar tiempos, kardex, valuación, traspasos—, con sus
  pruebas. Son del restaurante y del núcleo, no de otro giro; quitarlos perdería capacidad probada
  que el cliente puede pedir mañana.
- **Alternativa descartada:** quitar todo lo que no tenga pantalla hoy. Rompía la matriz de
  permisos del núcleo y perdía funciones del restaurante ya probadas.

## DP-D04 · Las migraciones no se tocan: el esquema es un superconjunto · 25-10-2026

- **Consecuencia:** siguen las tablas de otros giros, sin código que las escriba. El contrato de
  «estado ⇒ columna» exige ahora que NADIE escriba los estados de esas tablas
  (`SIN_ESCRITOR_EN_DON_PONCHO`): un hueco nombrado, no una regla ablandada.
- **Para la Fase B:** la migración 042 siembra tres organizaciones de muestra (Don Chuy, La Broca,
  Jacaranda) en cualquier base nueva. En la base propia se tratan con OK de Miguel (ver
  `docs/infra/FASES.md`).

## DP-D05 · Fuera el modo presentación, el dueño general y el selector de modelos · 25-10-2026

- **Alternativas:** desactivar (sin ruta ni menú, el servidor niega) o quitar.
- **Elección:** quitar. El contexto espejo, su historial, el cambio de negocio, la contraseña y el
  cambio de plantilla se fueron con sus rutas, pantallas y pruebas. La sesión dejó de leer la
  presentación (cuatro columnas y un `join` menos por petición).
- **Lo único que queda desactivado y no borrado:** `Ambito.presentador` en contratos (opcional,
  nunca se llena). El resolvedor de sesión rechaza cualquier cookie que traiga una delegación.
  Quitarlo del contrato tocaba la auditoría y el formato del token sin ganar nada.

## DP-D06 · Restaurantes de prueba en vez de demostraciones · 25-10-2026

- **Contexto:** «sin demos», pero las jornadas e2e, la matriz de permisos y el aislamiento
  necesitan un restaurante sembrado.
- **Elección:** dos restaurantes de prueba (`prueba-restaurante`, `prueba-restaurante-dos`) con ID
  propios que no existen en la base compartida; su siembra es la del restaurante del maestro, sin
  los otros giros. Su reseteo (`/api/pruebas/resetear`) tiene DOS guardas: por ID y por base (se
  niega si `DATABASE_URL` es de un proyecto intocable).
- **Consecuencia:** en producción ese reseteo contesta 403 siempre.

## DP-D07 · Don Poncho con ID fijo, alta idempotente y primer acceso único · 25-10-2026

- **Elección:** `NEGOCIO_DON_PONCHO.id` se declara antes del alta. `db:alta-negocio` lo crea con ese
  ID sólo si ni el slug ni el ID existen (con su fila de auditoría) y, si ya existe, no toca nada.
  `db:bootstrap` da el PRIMER acceso y se niega si ya hay dueño con PIN. Los negocios ajenos se
  niegan antes de abrir la base.
- **Consecuencia:** el mismo ID viaja a la Fase B y a la C.

## DP-D08 · CI en `pull_request` y a mano · 25-10-2026

- Sin `push` a `main` durante el arranque (se trabaja directo en `main`). Jobs reducidos al
  restaurante (ver DP-2 en `docs/BITACORA.md`).

## DP-D09 · El renombre `@morphiqpos/*` → `@donponcho/*` queda como deuda · 25-10-2026

- Son 1,089 archivos. No es barato y no lo ve nadie fuera del código; el encargo lo pide sólo si es
  barato. Queda anotado.

## DP-D10 · Los pisos anti-vacío de los contratos se recalibran · 25-10-2026

- Los contratos que escanean el código tenían pisos «al menos N» calibrados para cinco giros
  (p. ej. más de 250 comandos). Se bajan al alcance del restaurante con su razón escrita junto al
  número; siguen atrapando un cargador roto que devuelva unos cuantos.

## DP-D11 · El estilo `don-poncho` y la marca de la casa · 25-10-2026

- **Contexto:** el encargo daba una paleta de partida (naranja barro y rojo chile) y decía que, si
  el logo traía otros colores, mandaban los del logo. El logo trae tres: crema `#F3F1BF`, dorado
  `#AC8A5F` y negro `#161614`.
- **Elección:** un noveno estilo, `don-poncho`, y es el predeterminado (sistema de diseño, servidor
  y guion de arranque dicen lo mismo). Modo claro: el letrero —papel crema, marco dorado, letra
  negra—; modo oscuro: la madera del local. La barra lateral es negra en los dos, con el dorado
  exacto del logo en lo activo (5.64:1 con letra negra). El botón usa el dorado **oscurecido** a
  `34 35% 38%` con letra crema (5.26:1): en modo claro los ocho estilos del maestro ponen letra
  clara sobre el primario y el acceso, el escáner y los mosaicos de ícono lo dan por hecho. Los
  semánticos son los del sistema, sin tocar. Perillas: densidad cómoda, esquina sutil, sombra,
  movimiento sutil. Los ocho del maestro siguen construidos.
- **El acceso** deja su degradado azul y sus resplandores y se pinta con los tokens de la barra
  (la pizarra negra con letra crema); el logo de la casa va grande, sin sombra.
- **Morphiq** firma UNA vez: «Sistema por Morphiq», discreto, en el acceso. El ticket del comensal
  lleva logo, nombre y dirección; el corte y la barra firman «POS Don Poncho». Una prueba lo
  comprueba contra los archivos.
- **Íconos:** favicon 16 y 32, `apple-touch-icon` y los de la app instalable (192, 512 y 512
  `maskable`) salen del logo. A 16 px el letrero es una silueta: si Miguel quiere un monograma
  para el favicon, es un archivo y una línea.

## DP-D12 · Los tarros, como producto extra · 25-10-2026

- **Contexto:** en el restaurante el modificador viaja como nota y no cobra (los de pago son la
  tarea E9-3 del maestro).
- **Elección (de Miguel):** cada tarro es un producto en Cerveza —«Michelado (extra)» $15,
  «Cubano (extra)» $20, «Con clamato (extra)» $30, «Con clamato cubano (extra)» $35— que el
  mesero agrega junto a la cerveza. El menú queda en 107 productos.

## DP-D13 · Las credenciales compartidas salen del Vercel del maestro · 25-10-2026

- **Contexto:** el `.env` del maestro apunta a su base LOCAL, no a Supabase.
- **Elección (de Miguel):** leer `DATABASE_URL` (pooler), `STORAGE_*` y `MORPHIQPOS_DB_POOL_MAX` del
  proyecto Vercel `morphiqpos` (producción, sólo lectura) a un archivo temporal fuera del
  repositorio.
- **Resultado:** no se puede. Las 22 variables del maestro son de tipo **sensible**: ni el CLI ni la
  API devuelven su valor (la descarga las trae vacías; el archivo temporal se borró). Queda la otra
  vía que se le ofreció: que Miguel las deje en `..\_PRIVADO\` y el guion las lea de ahí.

## DP-D14 · La barbacoa por kilo descuenta su RECETA por kilo · 25-10-2026

- **Contexto:** el alta de producto exigía que un producto por medida descontara un insumo base.
  Con eso la barbacoa tendría que nacer con un insumo «Barbacoa» y su costo saldría en $0 (el
  insumo sin compras), contra la regla de la receta pendiente.
- **Elección:** un producto `variable_medida` acepta `insumo_base` **o** `receta`. El dominio ya lo
  soportaba: `consumoDeReceta` multiplica la receta por la cantidad vendida (0.25 kg incluido) y el
  cobro no descuenta nada mientras la receta no tenga líneas. La receta se captura por kilo.
- **Prueba:** `productos.test.ts` acepta el kilo de barbacoa por receta y sigue rechazando un
  variable con `sku`.

## DP-D15 · Los arreglos del puente llegan a su columna `jsonb` · 25-10-2026

- **Defecto heredado del maestro:** `pg` convierte un arreglo de JS en un arreglo NATIVO de
  Postgres, y una columna `jsonb` lo rechaza (`22P02`). No se podían guardar los atajos de peso de
  un producto (`presets_variable_qr`) ni las líneas de una plantilla de compra, tampoco desde sus
  pantallas.
- **Elección:** conversión nueva `jsonb`, que manda texto JSON, sólo en los campos escribibles de
  columnas `jsonb`. `json` se queda para lo que sólo se lee y para los arreglos nativos
  (`dia_visita int[]`, donde mandar el arreglo tal cual es lo correcto).
- **Prueba:** unidad (la conversión y qué campos la usan) e integración contra Postgres real.

## DP-D16 · Las pantallas del salón usan las zonas DEL NEGOCIO · 25-10-2026

- **Defecto heredado:** el mapa del mesero, el editor de mesas y su diálogo sólo conocían una lista
  fija (`Interior, Exterior, Terraza, Barra, Otro`). Las 10 mesas en «Salón» no se veían y una mesa
  nueva nacía en «Interior», que Don Poncho no tiene, y no se podía guardar.
- **Elección:** `zonasDelNegocio`: las zonas dadas de alta, por su orden, más las de sus mesas; la
  lista fija sólo si no hay ninguna. El diálogo propone la primera zona del negocio.

## DP-D17 · «Receta pendiente», derivada · 25-10-2026

- Un producto con `estrategia_consumo = 'receta'` y cero líneas activas. Sin columna ni DDL: se
  deriva al leer (`receta-pendiente.ts`) y se borra sola con el primer ingrediente. Se vende y no
  descuenta; su costo se enseña «desconocido» (nunca el cero guardado) y su margen «Sin costo».
  Rótulo y filtro en Recetas y Platillos; aviso «N platillos sin receta» en el tablero.
- **El área de preparación:** el cargador pone a cada platillo el área de su estación (comida →
  cocina, bebidas → barra). En `ninguno`, con el que nace un producto, no se genera comanda.

## DP-D18 · El menú personalizado del portal QR también pide · 25-10-2026

> **Superada por DP-D26 (26-10-2026):** la regla del título ya no liga platillos a la página; los
> botones van encima de la imagen y la lista de abajo se fue. Se deja como registro.

- **Contexto:** Miguel pidió el portal «con todo», el menú default y uno personalizado «como si lo
  hubieran subido ellos», con los botones de pedir. En el maestro el modo «menú subido» sólo
  enseñaba imágenes: no se ligaba a platillos, el servidor ni mandaba el catálogo, y el menú
  público no publicaba las opciones de un platillo (desde el QR no se elegía el sabor del pulque).
- **Elección, sin DDL:**
  - Una página se liga a las categorías que **nombra su título**, separadas por «·»
    («Pa’ empezar · Las sopas»). Debajo de su imagen van esos platillos con «Agregar», que abre el
    mismo diálogo que el menú default. Un título que no nombra ninguna sigue siendo sólo imagen; la
    pestaña «Menú QR» dice de cada página qué pide.
  - El menú público lleva las opciones de cada platillo, con nombres y sin precio.
  - En «menú subido» el servidor manda el catálogo cuando el comensal puede pedir.
  - El diseño: 8 páginas con el aspecto del letrero, generadas desde los datos del menú
    (`scripts/generar-menu-qr.mjs` → `apps/web/public/menu-qr/`), servidas por el propio sitio.
  - Don Poncho queda con el portal encendido en «menú subido», pedidos, cuenta, ayuda y propina del
    comensal. Pedir desde el QR exige la **asignación de mesas** (la comanda tiene responsable):
    queda encendida, con las mesas 1–5 a «Mesero 1» y 6–10 a «Mesero 2»; el dueño la cambia en
    Configuración.
- **Pendiente (Fase B):** una columna explícita página → categorías reemplazaría la regla del
  título; requiere migración, que la base compartida no admite.
- **Prueba:** unidad (ligado de páginas, opciones públicas sin precio) y navegador
  (`restaurante-menu-personalizado.spec.ts`: el comensal pide desde una página con su opción y el
  servidor lo registra).

## DP-D19 · Un toque de la cocina en camino no lo deshace la lectura de otro · 25-10-2026

- **Defecto heredado del maestro:** la cocina (`heredado/pages/Cocina.jsx`) pintaba cada toque
  escribiéndolo en la caché de la lectura y releía al contestar cada uno. Con dos toques seguidos,
  la relectura del primero llegaba con el segundo todavía viejo y la comanda regresaba a «Nuevos»
  hasta la siguiente lectura. El cocinero podía tocar la equivocada; en la CI el segundo «Listo»
  cayó otra vez sobre la misma comanda y la de la barra se quedó en el fuego. El maestro lo
  rodeaba en la prueba (`cocinaDejaLista` reintenta), no en la pantalla.
- **Elección:** lo tocado se pinta ENCIMA de lo leído, no dentro (`toques-en-camino.ts`), y se
  suelta sólo después de una relectura que salió tras la escritura, y sólo si nadie volvió a tocar
  esa comanda mientras tanto. Los avisos y el aspecto de la pantalla no cambian.
- **Prueba:** unidad con mutación, y navegador determinista (`cocina-toques-en-camino.spec.ts`:
  la segunda respuesta se frena tres segundos y su comanda no puede volver a «Nuevos»; falla sin
  el arreglo).
- **Segunda parte (26-10-2026), el mismo defecto en UNA comanda:** como la pantalla pinta
  «Preparar» al instante, el cocinero puede tocar «Listo» antes de que el «Preparar» llegue a la
  base. Se mandaban juntos y llegaban en desorden: el servidor aceptaba `nuevo → listo` y luego
  rechazaba el «Preparar» como retroceso (422), o al revés. La CI lo vio en la tableta. Ahora los
  toques de una comanda salen en fila (`crearFilaPorClave`): cada uno cuando contestó el anterior
  de esa comanda; las demás no esperan y un fallo no traba la fila. Prueba de unidad con mutación
  y un segundo caso determinista en la misma suite, que falla sin el arreglo.

## DP-D20 · Cómo quedó Don Poncho en Vercel · 25-10-2026

- **Proyecto `pos-don-poncho`** en `mh-astral-systems`, conectado a `M1gu3hb/POS-Don-Poncho`:
  `main` despliega producción. La misma forma que el del maestro (raíz `apps/web`, Next.js,
  Node 24) con las funciones en `cle1`, junto a la base (Supabase en `us-east-2`).
- **Variables sólo en Production**, por la entrada estándar del CLI; `DATABASE_URL`,
  `SESSION_SECRET`, `PIN_PEPPER` y `STORAGE_SECRET_KEY` como *sensibles*. La fuente es
  `..\_PRIVADO\fase-a.env`; Vercel ya no las deja leer.
- **Vistas previas protegidas y sin variables.** En el maestro una vista previa sirve demos de la
  misma base; aquí no hay negocio de prueba en la base compartida y una vista previa nunca debe
  servir a Don Poncho. Un PR construye en rojo en Vercel hasta que exista uno.
- **Protección:** Vercel creó el proyecto protegiendo también el dominio `*.vercel.app` de
  producción; se dejó como el maestro, sólo vistas previas. Si no, ni el personal ni el comensal
  del QR entraban.
- **QR de las mesas:** `preparar-negocio` los genera por `restaurante.rotar_qr` sólo donde faltan.

## DP-D21 · `verify:acople` ajustada al producto de sólo restaurante · 26-10-2026

La puerta vino idéntica del maestro y contra producción daba 10 pendientes. Ninguno era del
despliegue; cada uno se resolvió en su causa, sin bajar una exigencia:

- **Defecto de la puerta (heredado):** su consulta de seguridad era una copia vieja de la de
  `verify:rls` sin los disparadores, y nunca veía el sustituto de la 179. Ahora hay UNA consulta,
  `CONSULTA_SEGURIDAD` en `packages/data/src/verificacion/rls.ts`, para las dos puertas.
- **Defecto de la pantalla:** el ejemplo del motivo de cancelación decía «mesa» a mano; ahora usa
  el término del negocio con su concordancia.
- **Listas que se quedaron en cinco modelos:** las suites de cobro salen de `MODELOS`; las dos
  pantallas sin menú de la cafetería se quitaron de `EXCEPCIONES-COBERTURA.md`.
- **Comandos de los giros que el producto no tiene** (`COMANDOS_DE_GIROS_QUE_ESTE_PRODUCTO_NO_TIENE`):
  7 comandos de mostrador y crédito de abarrotes, cafetería y ferretería cuyas rutas se fueron en
  DP-2. No se borraron porque sus pruebas cubren reglas de dinero que el restaurante también usa.
  Cada fila dice a qué modelos servía y vale sólo mientras ninguno esté en `MODELOS`; la puerta
  falla si una fila sobra (el comando no existe, ya tiene ruta o su modelo volvió).
- **Falso positivo:** una cadena que termina en «/» es un prefijo al que se le pega algo; vale
  contra un segmento dinámico (`/api/archivos/[...ruta]`) y sólo contra eso.
- **La CI:** la puerta exige checks de GitHub sobre el commit, y aquí la CI corre a mano. No se
  afloja: antes de `verify:acople` se lanza la CI sobre ese commit.

Probado por mutación: quitar una fila, declarar un comando inexistente, uno con ruta o uno de un
modelo presente, volver a la lista de suites a mano y un prefijo que no lleva a ninguna ruta; la
puerta los denuncia todos.

## DP-D22 · Recetas y Platillos no pisan el área ni la visibilidad · 26-10-2026

- **Defectos heredados del maestro:**
  - Recetas (`RecetaFormDialog.jsx`) mandaba SIEMPRE `area_preparacion: 'cocina'` y
    `visible_en_menu_digital: true`, también al editar: una bebida dejaba de ir a la barra y un
    platillo escondido del QR reaparecía.
  - Platillos (`ProductoSimpleDialog.jsx`) mandaba `ninguno` al crear y al EDITAR: le quitaba la
    comanda a un platillo que la tenía. La importación hacía lo mismo si el archivo no traía área.
  - Recetas mandaba `imagen_url: ''` y el puente lo rechaza («debe ser una URL»): **no se podía
    guardar la receta de un platillo sin foto**, y Don Poncho no tiene fotos.
  - Ninguna pantalla dejaba escoger el área.
- **Elección:**
  - Campo «Área de preparación» en los dos diálogos (`AreaDePreparacionSelect`): al editar, el
    área que tiene; al crear, «Según su categoría». La visibilidad en el menú digital no viaja.
  - El servidor (`completarAreaAlCrear`, en `puente.escribir`): un `ProductoTerminado` creado sin
    área la aprende de su categoría y, si la categoría no tiene platillos, de su estación
    (`areaPorOmision`, la más frecuente, sin contar `ninguno` ni dados de baja). Si no hay de dónde,
    se niega con `AREA_DE_PREPARACION_REQUERIDA`: un platillo no nace sin comanda sin que alguien
    lo decida. El área que alguien elige se respeta, `ninguno` incluido.
  - Alternativa descartada: deducir el área por el NOMBRE de la estación («Bebidas» → barra):
    frágil y de otro idioma en cada negocio.
- **Producción (sólo lectura):** los 107 platillos de Don Poncho tienen el área de su menú,
  ninguno escondido del QR, ninguno editado desde la carga. Nada que corregir.
- **Prueba:** unidad de la regla y del campo, integración contra Postgres por el comando del
  puente, navegador (editar la limonada → sigue en barra y escondida; receta nueva en Bebidas →
  nace en barra, sin foto). Seis mutaciones, todas atrapadas.

## DP-D23 · El portal funciona sin asignación de mesas; globos de solicitud sobre cada mesa · 26-10-2026

- **Defecto heredado del maestro:** con `asignacion_mesas_activa = false` el comensal no podía
  abrir ni pedir desde el QR: `puedeOrdenarDesdeQR` exigía la asignación y `abrir_mesa` un mesero
  asignado que en ese modo no existe. Configuración ni siquiera dejaba encender «Permitir que el
  comensal envíe pedidos» sin la asignación.
- **Elección:**
  - La asignación deja de ser condición del negocio. Lo que falta, con la asignación ENCENDIDA,
    es el mesero de ESA mesa (`faltaMesero`): ahí la mesa sigue cerrada al QR, porque es el
    proceso que el negocio eligió. Sin asignación, el comensal abre, pide y llama.
  - La cuenta que abre el comensal nace a nombre de quien ya tomó la mesa
    (`mesas.empleado_atiende_id`) o de nadie. El MESERO que atiende un aviso de esa mesa, o que la
    toma desde su pantalla (`asignar_mesero`), se queda con la mesa Y con su cuenta
    (`quedarseConLaMesa`): la propina y el corte salen de `ordenes.empleado_atiende_id`, y una
    cuenta sin él caía en «Caja / venta directa». Las dos escrituras llevan
    `where empleado_atiende_id is null`: nunca le quitan la mesa a quien ya la tiene. Un gerente o
    la caja que atienden el aviso no se la quedan.
  - Globos de solicitud sobre cada mesa en la pantalla del mesero, en los dos modos: burbuja
    oscura con cola, icono + texto + tono (el color nunca va solo), hasta tres apilados y el resto
    en «+N más», encima de la mesa (debajo si está pegada al borde de arriba) y en línea sobre la
    tarjeta del teléfono. Tocar uno atiende la solicitud sin abrir la mesa.
  - Alternativa descartada: que la cuenta del comensal nazca a nombre de «el primer mesero en
    turno». Inventa una atribución que nadie decidió.
- **Prueba:** unidad (bandera, agrupado de globos), integración contra Postgres (nueve casos:
  abrir y pedir sin asignación, quedarse con la mesa al atender o al tomarla antes y después de
  que el comensal abra, otro mesero no la roba, la gerente no se la queda, con asignación sigue
  cerrada), navegador en escritorio, tablet y teléfono (la dueña lo enciende desde Configuración,
  el comensal abre y pide, la mesera ve y toca el globo, el servidor dice que la mesa y la cuenta
  son suyas). Once mutaciones (ocho del servidor y tres del navegador), todas atrapadas.

## DP-D24 · Vista «Solicitudes» dentro de Mesas; la voz de las solicitudes sólo ahí; la caja no las ve · 26-10-2026

- **Lo que había:**
  - Las solicitudes del comensal se veían en un modal que abría el botón «Solicitudes» del
    encabezado de Mesas, y en las tarjetas «SOLICITUDES ACTIVAS» bajo el plano.
  - La VOZ (y el timbre) de las solicitudes la soltaba `SolicitudesQRWatcher`, montado en
    `AppLayout`: sonaba en CUALQUIER pantalla del mesero —Mesas, su pedido, sus ventas— y en las
    del dueño/gerente si no tenían silenciadas las notificaciones de administración.
  - En el servidor la caja leía `SolicitudQR` por el puente y podía atender y limpiar
    solicitudes (`ROLES_DE_SALA` la incluía); la cocina también las leía.
- **Elección:**
  - Arriba de las zonas, un selector Mesas / Solicitudes (con el número de pendientes).
    «Solicitudes» convierte la pantalla entera en la lista: mesa en grande, tipo con icono y
    texto, hace cuánto y «Atender» (el mismo comando que el globo). De la que más lleva esperando
    a la más nueva. Sale el botón del encabezado y su modal (`SolicitudesQRPanel`, borrado).
  - La vista se recuerda en el APARATO (`localStorage`, con respaldo si el navegador lo niega):
    un aparato se queda de estación sin rol ni PIN nuevos.
  - La voz de las solicitudes suena SÓLO en esa vista, con la configuración de Alertas del
    aparato (sonido, voz o las dos; el nombre del mesero sólo en las suyas). Las que ya estaban
    al abrirla no se anuncian. En el plano: globos (DP-D23), sin voz. `SolicitudesQRWatcher`
    queda con el aviso visual y la limpieza diaria, sin sonido ni voz. Los demás avisos (pedido
    listo, cocina) no cambian.
  - Servidor: `SolicitudQR` la leen dirección y mesero (sin caja ni cocina);
    `atender_solicitud` y `limpiar_solicitudes` las ejecutan mesero, gerente, administrador y
    dueño. `asignar_mesero` (tomar la mesa) sigue siendo de toda la sala. La caja cobra por
    `Venta`, que ya trae lo que el comensal pidió por el QR.
- **Prueba:** unidad (hace cuánto, orden, qué anunciar, vista recordada y almacén bloqueado),
  integración contra Postgres (la caja no lee, no atiende ni limpia; mesero y gerente sí),
  navegador en escritorio, tablet y teléfono con la voz espiada (`speechSynthesis.speak`): en
  «Solicitudes» se anuncia, en el plano no; recordar la vista al recargar; atender desde la
  lista; la caja recibe 403 del puente. Diez mutaciones (tres del servidor, cuatro de la lógica,
  tres del navegador), todas atrapadas.

## DP-D25 · Cocina en el teléfono: un QR por estación, firmado para el día y revocable · 26-10-2026

- **Lo que se pidió:** que cada estación (Cocina, Bebidas…) tenga un teléfono que enseñe la
  comanda pendiente más reciente, la lea en voz y la prepare o la deje lista con tres botones o
  con una botonera física, sin PIN.
- **Elección:**
  - «Conectar teléfono» en la pantalla de Cocina emite el QR de UNA estación
    (`restaurante.conectar_telefono_de_cocina`: cocina, gerente y dueño; un cocinero con estación
    fija, sólo la suya). El código es una FIRMA HMAC, con una llave derivada de la pimienta del
    servidor, de negocio + estación + día de operación + versión: no se guarda en ninguna parte
    (sin tabla, sin migración) y no se puede inventar. Vale el día de operación en que se emitió
    (zona del negocio) y hasta que se emite otro para la estación, que sube la versión
    (`configuracion.valores.telefonos_de_cocina`: nunca sale al navegador ni se escribe por el
    puente). Firma la ruta, no el comando: el comando no ve secretos.
  - API pública estrecha (R33): `GET /api/publico/cocina/:token` (la comanda pendiente más
    reciente de SU estación: mesa, platillos, cantidades, notas, alergia, celebración; sin precios
    ni ids ajenos; del nombre del pedido sólo la primera palabra) y `POST …/transicion` (sólo
    `en_preparacion` y `listo`, sólo comandas de su estación). Límite de tasa por token,
    idempotencia anónima, auditoría sin identidad y 404 igual para cualquier código inválido.
  - Concurrencia con la pantalla grande: el teléfono mueve la comanda con la MISMA función que
    `transicionar_pedido` (`moverLaComandaEntera`, extraída de `preparacion.ts`). Si la pantalla
    ya la movió, «Listo» responde «sin cambio» y «Preparar» no la devuelve al fuego.
  - El teléfono: «Toca para activar el sonido» (el navegador lo exige), Wake Lock (la pantalla no
    se apaga), la voz con el mismo texto que la pantalla grande (`fraseNuevoPedidoCocina`),
    «Repetir voz», y la botonera como teclas (`1`/`2`/`3`, flechas, páginas, Enter, Espacio):
    `docs/cliente/BOTONERA.md`.
  - De paso: el guardado genérico de Configuración bloquea la fila (`for update`) antes de
    reescribir el documento. Sin eso, guardar Configuración en el mismo instante en que se conecta
    un teléfono podía devolverle la vida al código revocado.
  - Descartado: una tabla de tokens (pide migración: sería fase-b) y reusar el token de
    dispositivo del monitor de recogida (ver el hallazgo en el reporte 002).
- **Prueba:** unidad (firma y forma del token; teclas, acciones, qué anunciar), integración contra
  Postgres (sólo su estación y la más reciente, sin importes; preparar y listo, auditados;
  idempotencia; la pantalla grande primero; estación ajena; revocar; otro día; estación apagada;
  cocinero con estación fija; mesero sin permiso; Configuración no pisa ni enseña la versión) y
  navegador en escritorio y tablet (el cocinero conecta, el teléfono sin sesión recibe la comanda
  con voz, la botonera la prepara y la deja lista, el servidor lo confirma, el código viejo deja
  de servir y no deja botones). Quince mutaciones (nueve del servidor, tres de la lógica, tres del
  navegador), todas atrapadas.

## DP-D26 · Botones sobre las páginas del menú QR y aspecto del portal, por tokens · 26-10-2026

- **Lo que había:** cada página del menú subido era una imagen con una lista aparte de «Agregar»
  debajo, ligada por el título de la página (DP-D18). Se repetía y le quitaba la gracia.
- **Elección (versión 1; diseñar la carta desde cero no entra):**
  - En Portal QR → Menú QR, cada página tiene «Botones»: un editor sobre la imagen donde se
    colocan botones arrastrando y se estiran desde la esquina (también con flechas del teclado).
    Dos tipos: **platillo** (abre el diálogo de opciones de siempre) y **grupo** (un botón,
    «Cervezas», que despliega los platillos de una categoría o de una lista elegida). Por botón,
    «enseñar el precio vigente del sistema» (la imagen puede tener precios viejos). Vista previa
    como comensal dentro del editor.
  - Posiciones en % de la imagen: iguales en cualquier teléfono y con zoom de dos dedos.
  - Viven en `configuracion.valores.portal_qr_botones` (`{ [página]: Boton[] }`), validados con
    zod al guardar (dentro de la página, cada tipo con lo suyo, sin ids repetidos, hasta 60 por
    página). Sin migración: cabe de sobra en el tope de 64 KiB del documento.
  - El portal publica sobre cada página sólo lo que se vende: un botón de un platillo escondido
    del menú digital no sale y un grupo se queda con sus visibles. Sin poder pedir, la página es
    sólo imagen. Se quita la lista repetida de abajo.
  - Las 8 páginas de Don Poncho quedan con sus 97 botones: `generar-menu-qr.mjs --posiciones`
    mide dónde quedó cada platillo en cada imagen (comprueba que la imagen mida lo mismo que la
    página medida) y `preparar-negocio.mjs` los escribe por el puente, sin pisar una página que
    ya tenga botones. Los renglones de pulque son grupos (litro y medio litro).
  - Aspecto del portal, por tokens: uno de los nueve estilos (o el del negocio), la tipografía
    (la del sistema, redonda o clásica, de las que ya carga la aplicación) y el fondo (liso o con
    la marca de agua), en `configuracion.valores.portal_qr_tema`. El orden de las páginas es el
    «Orden» que ya tenía cada una.
- **Prueba:** unidad (forma de los botones y del tema; mover, estirar, tipo, faltantes; caja,
  platillos y precio vigente), integración contra Postgres (se guarda validado; el portal publica
  sólo lo que se vende; sin pedir, sin botones —también en mixto—; el tema viaja y se valida),
  navegador (la dueña coloca un platillo arrastrándolo y un grupo, vista previa, guarda, elige el
  aspecto; el comensal ve el botón ENCIMA de la imagen con el precio vigente, sin la lista,
  despliega el grupo y pide tocando el platillo). Once mutaciones (cinco del servidor, tres de la
  lógica, tres del navegador), todas atrapadas.

## DP-D27 · Demo local en la red: base desechable y cookies `Secure` sólo con https · 26-10-2026

- **Lo que había:** probar con los teléfonos pedía la base compartida (no se puede: cero
  reseteos, cero siembras) o un arranque a mano. Y las cookies decidían `Secure` por
  `NODE_ENV === 'production'`: la aplicación compilada servida en `http://<IP de la PC>` mandaba
  cookies `Secure` que el teléfono descarta, así que nadie podía entrar por la red local
  (`localhost` sí, porque el navegador lo trata como seguro).
- **Elección:**
  - `scripts/demo-local.mjs preparar|servir` y `docs/DEMO-LOCAL.md`: una base de ESTA máquina
    (se niega con otra, no lee el `.env`), las migraciones de la rama en la que se está (así se
    prueba `fase-b`), y Don Poncho dado de alta por los comandos de la aplicación como en
    producción —menú, portal, mesas, equipo, botones—. Idempotente. Sus secretos y sus PIN de
    demo se inventan la primera vez y se guardan fuera del repositorio, en la carpeta temporal.
    `servir` compila y escucha en `0.0.0.0` con `APP_URL=http://<IP>:<puerto>`: los QR (salen de
    `APP_URL`) y las imágenes del menú apuntan a la IP.
  - `cookiesSeguras(entorno)`: `Secure` cuando está compilada **y** `APP_URL` es https —el mismo
    dato del que el middleware decide la CSP estricta—. Lo usan las tres rutas que escriben
    cookies (entrar, salir, empleados). En producción no cambia nada.
- **Prueba:** unidad del criterio (producción https, red local http, desarrollo, mayúsculas) y
  un contrato que lee TODAS las rutas que escriben cookies y exige `cookiesSeguras(entorno)`.
  Seis mutaciones (tres del criterio, una por ruta), todas atrapadas. A mano: base desde cero,
  segunda corrida sin duplicar, servidor en la IP de la PC; por la IP, entrar devuelve sus tres
  cookies sin `Secure` y con esa cookie la lectura de mesas da 200 (sin ella, 401); la página
  publica `data-url-publica` con la IP y las imágenes del menú se sirven.

## DP-D28 · QR de las mesas con diseño: motor de Morphiq-QRs, y sólo se imprime lo que se lee · 26-10-2026

- **Lo que había:** cada mesa tenía un QR negro sobre blanco de `qrcode`, con descarga PNG de
  800 px y una impresión por ventana emergente. Sin diseño, sin tamaño en milímetros y sin revisar
  que se leyera.
- **Elección:**
  - El motor de diseño del estudio de Miguel (`M1gu3hb/Morphiq-QRs`) portado a TypeScript estricto
    en `packages/domain/src/qr/`, puro y validado en la frontera; comparado contra el original
    (55 181 dibujos, cero diferencias). La codificación sigue en `qrcode`; con logo, nivel H.
  - Un diseño general y uno opcional por mesa en `configuracion.valores.qr_de_mesas`, con zod al
    guardar: ids del catálogo, `#rrggbb`, centro que va con su esquina, contraste suficiente
    (también el segundo color del degradado), hasta 50 mesas propias y nada de campos de más
    —el contenido del QR no viaja en el diseño—. Sin migración.
  - Antes de exportar —PNG a 300 ppp, SVG en mm, PDF carta—, cada QR se lee con jsQR en cuatro
    condiciones y tiene que decir EXACTAMENTE la dirección de su mesa; sin intentar invertido,
    porque muchas cámaras no leen claro sobre oscuro. Si uno falla, no sale ninguno. El editor
    revisa mientras se diseña y no deja guardar lo que no se lee.
  - El PDF lleva cada QR como imagen a 300 ppp (nítido al imprimir) con `jspdf`, que ya estaba:
    no se trajo `svg2pdf.js`. `jsqr` (Apache-2.0) sí, y su licencia se sirve con la aplicación.
- **Prueba:** motor (487 casos), unidad del diseño en servidor y pantalla, de la codificación
  (la matriz pintada a píxeles se lee con jsQR y dice la dirección; invertida no), de la pieza,
  las medidas y la compuerta de impresión; integración contra Postgres (dueño guarda, ilegible y
  campo de más rechazados, mesero sin permiso, restablecer, otro negocio intacto); navegador en
  escritorio, tablet y teléfono (diseño ilegible no se guarda, uno legible sí, personalizar y
  restablecer, PDF de todas, PNG de 709 px que un lector aparte lee con la dirección de SU mesa,
  SVG en mm). Diecisiete mutaciones (seis del servidor, siete de la lógica, cuatro del
  navegador), todas atrapadas.

## DP-D29 · El pedido compartido de la mesa: un carrito en el servidor, un solo envío (fase B) · 26-10-2026

- **Lo que había:** cada teléfono armaba su carrito en su memoria y cada «Enviar» salía a cocina
  como comandas aparte; nadie sabía cuántos estaban pidiendo.
- **Elección:**
  - Migración 186 (rama `fase-b`, sin aplicar en la base compartida): `carrito_mesa_lineas`,
    `dispositivos_mesa` y `carritos_mesa`. La línea no lleva precio (R9): el envío reusa
    `pedirEnLaMesa`, la misma función del pedido de siempre, con el precio del catálogo.
  - El teléfono se reconoce por un id que inventa su navegador; el servidor guarda sólo su huella
    (HMAC con la pimienta). Cada quien quita sólo lo suyo.
  - Agregar, quitar y enviar son comandos públicos auditados e idempotentes. El SONDEO (cada
    2.5 s) no: deja el latido —presencia, no un hecho del negocio— y devuelve el carrito; auditarlo
    escribiría una fila por teléfono cada tres segundos. Tiene su límite por token.
  - Conectados = teléfonos que latieron en el último minuto desde que se abrió la cuenta. Con dos
    o más, o una mesa abierta para dos o más, «Esperen a que todos…» y el envío exige
    confirmación también en el servidor (`QR_CARRITO_SIN_CONFIRMAR`, 409).
  - Un solo pedido: el envío toma la fila de `carritos_mesa` CON CANDADO; el segundo «Enviar»
    simultáneo espera y encuentra el carrito vacío (`enviado: false`). El candado de la CUENTA
    (el de siempre del pedido del portal) cubre otra carrera: enviar mientras la caja cierra la
    cuenta; probada de forma determinista (`carrito-y-caja.integracion.test.ts`). La ronda de la mesa sube con cada envío y los
    demás teléfonos ven «Pedido enviado». Lo de una cuenta anterior no aparece en la siguiente.
  - Contrato del esquema: en `fase-b`, `scripts/esquema-esperado.json` incluye las tablas nuevas
    (generadas de una base local migrada, sólo altas). Por eso `verify:esquema` y `verify:rls`,
    que comparan con la base COMPARTIDA, no pasan en esta rama hasta aplicar la 186 en Fase B.
- **Prueba:** integración contra Postgres (dos teléfonos, lo ajeno, confirmar, envío simultáneo
  en paralelo de verdad, precio del catálogo y una comanda por estación, ventana de conectados,
  cuenta anterior, tope, sin pedidos no hay latido); unidad del teléfono; navegador con dos
  teléfonos en la misma mesa. Las cuatro suites que pedían desde el portal pasan por el pedido de
  la mesa (`ayudantes/pedido-de-la-mesa.ts`).

## DP-D30 · Unir mesas desde el mapa: la unión es del salón (fase B) · 26-10-2026

- **Lo que había:** `restaurante.unir_mesas` con la principal elegida de una lista y un tope de
  seis (`.max(5)`); las mesas no se movían en el mapa; ninguna pantalla separaba (D-2); «Marcar
  entregado» no alcanzaba a la mesa unida (D-3); el QR de una mesa unida abría su propia cuenta,
  y la unión nacía con una cuenta y moría con ella.
- **Elección:**
  - Migración 187 (rama `fase-b`, sin aplicar en la base compartida): la unión puede vivir sin
    cuenta (`uniones_mesa.orden_id` nulo), guarda las posiciones ORIGINALES de cada mesa y
    `mesas.unida_a_mesa_id` marca a las absorbidas.
  - **Criterio de «juntas»:** cada mesa del grupo toca a otra (8 puntos de tolerancia, por su caja
    en el plano) y el grupo cabe en 640 × 400 puntos (una hilera de cinco rectangulares medianas o
    un bloque de tres por dos). Sin tope de cantidad; el tope técnico de la entrada (40) no es de
    negocio. La regla vive en el dominio (`sala/union.ts`) y la aplican pantalla y servidor.
  - El imán (36 puntos) y el efecto líquido son de la pantalla: un filtro SVG, sin librerías. Con
    movimiento reducido no tiemblan.
  - El número que queda es el de la principal elegida: las demás se ocultan y su QR cae en ella.
    No se renumera nada; al separar, cada mesa vuelve a su posición (zona y número nunca
    cambiaron).
  - **La unión es del salón:** sobrevive al cobro y a la cancelación. Al limpiar la principal,
    `liberar_mesa` exige decidir (`MESA_UNIDA_SIN_DECISION`): separar o dejarlas unidas para el
    siguiente cliente. Una unión libre se separa desde el mapa.
  - D-3: al unir, las comandas de la unida pasan a la cuenta del grupo (siguen diciendo su mesa en
    el tablero). D-2: «Separar mesas» en la mesa activa de la principal y en el mapa.
  - De paso: `ErrorPuente` (cliente heredado) conserva los `datos` del error; sin eso, la mesa de
    meseros y la caja no podían saber qué regla las detuvo.
  - Guardas de una revisión independiente (sólo lectura) del código: principal ya cobrada no se
    une; posiciones sólo del grupo; ninguna cuenta se muda a una mesa oculta y la que llega a una
    principal libre toma la unión; la cuenta sin cobrar se dice antes que la pregunta del grupo;
    candados en el orden cuenta → principal → demás (el del cobro y el de liberar).
- **Prueba:** unidad del dominio (imán, grupo, regla, medidas) y de la pantalla (plano, toque,
  escala, la pregunta al liberar); integración contra Postgres (regla y perímetro en el servidor,
  posiciones originales, QR de la absorbida, cuenta del grupo desde el QR, cobro sin cerrar la
  unión, separar o mantener al limpiar, cancelar); navegador: arrastre con imán, número, QR y
  separar en tableta, PC y teléfono, y el día completo de operaciones con el mapa (D-2 y D-3 dejan
  de ser `fixme`).

## DP-D31 · La estación de cocina sale de la sesión del servidor; el portal sigue la cadena del mesero · 27-10-2026

- **Lo que había (producción, 27-10):** `estaciones_preparacion_activas` apagada y el único
  usuario de cocina viendo comida y bebidas revueltas. Encenderla dejaba la pantalla vacía: la
  sesión del navegador no traía `estacion_preparacion_id` ni «ve todas». Ninguna estación era
  `es_general`, y el portal QR mandaba comandas SIN estación con la bandera apagada.
- **Elección:**
  - La entrada con PIN y `/api/catalogo/sesion` contestan la estación del EMPLEO (id, nombre y
    color, sólo si está encendida y es del mismo negocio) y si ve todas
    (`leerEstacionDeLaSesion`). Dueño, gerente y administrador ven todas. Una lectura aparte en
    esas dos rutas y no en el ámbito de cada petición: no se agrega un join al camino caliente.
  - La pantalla de Cocina decide con eso sólo cuando el servidor ya contestó (`verificada`); al
    volver a la pestaña adopta un cambio de estación. Sin estación, el aviso pedido.
  - A dónde va una comanda no depende de la bandera: el portal sigue la cadena del mesero
    (estación ACTIVA de la categoría → general), con nombre y color vivos. La bandera decide
    qué se DIBUJA. Se conserva del portal que nunca lanza: sin ninguna estación activa, por área.
  - `restaurante.marcar_estacion_general` nombra general una estación existente (sólo dirección;
    nunca cambia la general de mano; idempotente, auditado). Descartado: crear una «Cocina
    general» aparte, que nadie vería con sus estaciones.
  - Producción por `preparar-negocio.mjs` (archivo de datos v2): «Cocina» general, el usuario
    Cocina a su estación (sin tocar su PIN), alta de «Bebidas» y la bandera encendida.
- **Prueba:** unidad (estación de la sesión, alcance de la pantalla, comparación de sesiones),
  integración contra Postgres (la estación de la sesión por rol, apagada y de otro negocio; cada
  comanda con la estación de su categoría por el mesero y por el QR, encendidas y apagadas;
  «hacer general»: idempotente, sin cambiar de mano, apagada, sin permiso, otro negocio) y
  navegador (cada cocinero entra con su PIN y ve lo suyo, el dueño todo, sin estación el aviso,
  recargar conserva, el pedido nuevo se anuncia sólo en su estación, el teléfono sólo la suya).

## DP-D32 · La última caja no cierra con cuentas vivas; con otra abierta, cierra y avisa · 27-10-2026

- **Lo que había (C10):** `caja.cerrar` no veía las cuentas de mesa (no tienen caja hasta que se
  cobran). Cerraba con mesas sentadas; la única defensa era la pantalla de Cierre diario, que
  leía el salón y escribía sin volver a mirar.
- **Elección:**
  - Dentro de la transacción del cierre, la ÚLTIMA caja abierta de la sucursal no cierra si
    quedan cuentas vivas, y dice qué mesas faltan. Con otra caja abierta, cierra y avisa
    (`aviso` en el resultado, enseñado por Caja y Corte).
  - Cuenta viva: orden cobrable de la sucursal con mesa, o parte de una cuenta dividida (su madre
    tiene la mesa). Un carrito de mostrador no cuenta.
  - El cierre bloquea las cajas abiertas de la sucursal en orden de id antes que la suya: dos
    cierres a la vez se forman en fila y el segundo ya ve cerrada a la primera (sin el orden
    fijo, dos cierres que bloquean primero la propia se trabarían).
  - Las mesas viajan en el MENSAJE: los errores de dominio sólo mandan `regla` en `datos`, y
    abrir los detalles a todos los comandos no es de este encargo.
  - Cierre diario conserva su muro, más estricto (es el cierre del día entero).
  - Descartado: bloquear también al abrir una mesa mientras cierra la última caja. Abrir mesa
    sin caja ya es posible hoy (el mesero sienta gente antes de que abra la caja); lo que no se
    permite es firmar el corte sabiendo que hay cuentas vivas.
- **Prueba:** unidad (la decisión y el texto) e integración contra Postgres (rechazo con las
  mesas nombradas y, cobradas, cierre; la parte sin cobrar de una dividida; con otra caja,
  cierra y avisa y la que queda ya es la última; el cierre ESPERA el candado de la otra caja,
  observado en `pg_stat_activity`; dos cierres a la vez: sólo uno cierra).

## DP-D33 · Puente de las mesas unidas en `main` hasta la mudanza · 27-10-2026

- **Lo que había:** en `main` la unión es la vieja (F-302): la mesa unida se queda sin cuenta
  propia, pero su QR seguía siendo suyo (el comensal pedía en una mesa sin cuenta); ninguna
  pantalla separaba un grupo (D-2) y lo que cocina dejó listo para la unida no se entregaba desde
  la principal (D-3).
- **Elección (sin migración):**
  - El QR de una mesa miembro de una unión ABIERTA resuelve a la principal en el único sitio
    donde nace el ámbito del comensal (`buscadorDeProduccion`): «Mesa 4», «Esta mesa está unida
    a la mesa 4», y pedidos y solicitudes caen en su cuenta. El QR propio sigue mandando.
  - D-2: «Separar mesas» en la mesa activa de la principal, con `restaurante.separar_mesas`.
  - D-3: al unir, `comandas.orden_id` de la unida pasa a la cuenta del grupo, como sus líneas.
  - El diálogo y el hook usan las mismas rutas de archivo que `fase-b` para que la fusión
    resuelva a su diseño (DP-D30), que reemplaza este puente; el aviso del portal se conserva.
- **Prueba:** integración contra Postgres (unir 4 y 5, escanear la 5: «Mesa 4» y unida; pedir
  cae en la cuenta de la 4 y la 5 no abre cuenta; la solicitud es de la 4; separadas, el QR de la
  5 vuelve a la 5; D-3: las comandas de la 5 cuelgan de la cuenta de la 4) y navegador (D-2 y D-3
  dejan de ser `test.fixme`; D-2 separa de verdad).

## DP-D34 · La mudanza de un negocio: exportar del catálogo, importar sin disparadores y comparar md5 · 27-10-2026

- **Lo que hacía falta:** sacar las filas de Don Poncho de la base compartida y meterlas en su
  base nueva (Fase B) sin perder ni cambiar nada, con los mismos ID, y poder probarlo antes.
- **Elección:**
  - Las tablas del negocio salen del CATÁLOGO: las que tienen `organizacion_id`, su fila de
    `organizaciones` y las hijas alcanzables por llave foránea. Fuera: `_migraciones`,
    `limite_tasa` y los catálogos globales que trae cada base (`motivos_merma`, `regimenes_ieps`).
  - Cada fila como `to_jsonb(t)::text` y de vuelta con `jsonb_populate_recordset`: ni un
    `bigint` ni un `numeric` pasan por números de JavaScript.
  - Importar con `session_replication_role = replica` (como la restauración oficial de
    Supabase): sin disparadores, ningún ledger ni saldo se vuelve a aplicar. Las llaves foráneas
    validadas se comprueban a mano antes del `commit` (las `NOT VALID` no las cumple ni el origen).
  - Conteo y md5 por tabla sobre las columnas del ORIGEN, con zona UTC, fechas ISO e intercalación
    «C»: el mismo resultado en cualquier servidor. Se comparan dentro de la transacción: si no
    cuadra, no se guarda.
  - Descartado: `pg_dump` por organización (no filtra hijas sin `organizacion_id` ni compara) y
    un filtro escrito a mano (se queda atrás con la siguiente migración).
  - Las puertas de esquema, RLS y acople toman el proyecto de `MORPHIQPOS_PROYECTO_VERIFICADO`.
- **Prueba:** unidad (`listar` del almacén por carpetas y páginas; `proyectoVerificado`) y el
  ensayo con los datos reales (ver el reporte 003): exportar de la compartida en sólo lectura,
  importar a bases desechables con las migraciones de `main` y de `fase-b`, filas y md5
  idénticos; repetir se niega; una fila alterada en el destino la señala la verificación.

## DP-D35 · DP-11 se publica en `main` paso por paso; no hay rama `diseno` · 29-10-2026

- **Contexto:** el encargo DP-11 mandaba el diseño nuevo (11.4 y 11.5) a una rama `diseno` sacada
  de `fase-b`, sin publicar hasta después de la mudanza. El arranque de la sesión, que manda sobre
  los encargos, dice lo contrario: todo a `main` y a producción en cuanto quede verificado, para
  que Miguel lo pruebe ahí; se queda la pausa de DP-11.4.
- **Elección:** cada paso de DP-11 entra a `main` con la CI a mano en verde, se despliega y se
  comprueba con humo y huella. Las tres pantallas piloto salen a producción y ahí se detiene hasta
  el OK de Miguel. Al cerrar cada paso, `main` se fusiona en `fase-b` (merge) con su CI en verde.
  Si el restaurante ya opera, lo grande de diseño se publica fuera de su horario y con aviso.
- **Consecuencia:** lo que sólo existe en `fase-b` (unir mesas desde el mapa con su efecto
  líquido, el carrito compartido del portal) recibe el lenguaje nuevo en `fase-b`, al fusionar.
  Ninguna preferencia nueva pide migración: van en `configuracion.valores` o en el aparato.

## DP-D36 · El diseño nuevo se aplica a las pantallas reales, no a sus gemelas · 29-10-2026

- **Lo que hay (inventario de DP-11.0):** lo que cada puesto usa a diario es heredado o mixto
  (`Mesero.jsx`, `Caja.jsx`, `Cocina.jsx`, `Dashboard.jsx`). Las 12 gemelas recompuestas de
  `app/(modelos)/restaurante/*` no cuelgan del menú (D-52) y sólo las abren las pruebas.
- **Alternativas:** (a) recomponer las gemelas y cambiar el menú a ellas; (b) recomponer las
  reales: se queda su lógica (consultas, comandos, estados, textos que usan las pruebas) y se
  cambia su capa visual.
- **Elección: (b).** Las gemelas no tienen todo lo que hoy usa Don Poncho (globos y vista de
  solicitudes, unir mesas de `fase-b`, la pregunta al liberar, los diálogos de la caja) y las
  suites de navegador prueban las reales. La parte visual de cada pantalla real se rehace como
  piezas de `apps/web/src` con `@morphiqpos/ui/sistema` (así `verify:adopcion` las mide) y la
  página heredada las monta con sus mismos datos. Lo compartido —`AppLayout`, `Sidebar`, `Card`,
  `Dialog`— cambia en el sistema de diseño y mueve todas las pantallas a la vez.

## DP-D37 · Un id al azar que también sirve por http · 29-10-2026

- **Defecto:** `crypto.randomUUID` sólo existe en un contexto seguro (https o `localhost`). Por la
  IP de la red (la demo con teléfonos de DP-D27 y el servidor del restaurante de la Fase C) no
  está: el teléfono de cocina no podía mover una comanda, el editor de botones del menú QR no
  agregaba uno y, en `fase-b`, el portal del comensal no cargaba el menú
  («crypto.randomUUID is not a function»). Se vio al probar la demo de `fase-b` por la IP.
- **Elección:** `idAlAzar()` (`apps/web/src/cliente/id-al-azar.ts`): `randomUUID` si está; si no,
  un UUID v4 con `crypto.getRandomValues`, que existe en cualquier contexto y da el mismo azar.
  Las claves de idempotencia (`nuevaClave`) dejan el respaldo con `Math.random`. Un contrato
  exige que ningún archivo del navegador llame `randomUUID` directo.
- **Prueba:** unidad (sin `randomUUID`, 500 UUID v4 distintos con `getRandomValues`; con él, el
  del navegador) y el contrato. Seis mutaciones, todas muertas.

## DP-D38 · Morfi en el POS: tres clips, tres formatos, uno a la vez · 29-10-2026

- **Fuente:** `M1gu3hb/Morfi-pet`, carpeta `ux-pos/`, commit `c61aab2` (sólo se leyó). Entran los
  tres que Miguel aprobó: `03_cargando_loop`, `07_pagina_no_encontrada` y `11_modo_espera`
  (partido en **dormido**, cuadros 1–76, y **despertar**, 77–164: el 77 casi repite al 1, 2.7
  contra 2.3 de un paso normal entre cuadros). Las otras 14 no.
- **Formatos (medidos):** Safari —y todo el iPhone y el iPad, que son WebKit— no reproduce WebM con
  transparencia. Se sirve WebM (VP9 con alfa, 2.2 MB los cuatro) en Chromium, Edge, Firefox y
  Android; **WebP animado a 15 cuadros** («en dos», la cadencia que la investigación de Morfi
  acepta; 3.9 MB los cuatro) en WebKit; y una **imagen fija** (23 KB) con «reducir movimiento» o
  la perilla `movimiento: nula`. Descartados: APNG (5.5 MB uno solo a media escala) y HEVC con
  alfa (el `ffmpeg` de Windows no lo codifica y no hay cómo probarlo aquí). El navegador se
  reconoce por su identificación, con los navegadores dentro de apps del iPhone y el iPad.
- **Geometría:** sale de `escenas.json` y `recortes.json`: las manos de «Cargando» quedan en la
  orilla de la tarjeta por cálculo, no a ojo (prueba). El hoyo del 404 es interfaz (SVG con
  tokens), con la misma orilla que el clip.
- **Dónde:** la carga de pantalla completa de `AppLayout` (entrar con PIN, recargar), la del menú
  del portal QR, el 404 de la aplicación y el QR que no lleva a ninguna mesa. La tarjeta de carga
  es una pieza nueva del sistema, `PantallaDeCarga` (texto que dice qué carga, barra, nada antes
  de 600 ms por CSS), con un hueco para la mascota; `verify:adopcion` la reconoce como la espera
  de una pantalla entera. Las cargas dentro de una pantalla siguen con `Esqueleto`.
- **Reglas:** nunca dos clips a la vez (`turno.ts`: espera > 404 > carga); se cierran con un toque;
  la sombra azul eléctrico sólida viene en el clip, sin filtros.
- **«Mascota Morfi»:** por negocio, encendida por omisión, en `configuracion.valores.experiencia`
  (clave nueva, validada con zod en el guardado genérico; sin migración). El servidor la lee al
  pintar, como la apariencia; se cambia en Configuración → Apariencia. Apagada, cada lugar usa su
  versión sin mascota (la tarjeta sola, el vacío del sistema).
- **De paso (teléfono):** el `<main>` de `AppLayout` lleva `min-w-0` y el `fieldset` de las voces
  también: sin eso, una fila que no se encoge estiraba la página a lo ancho (Configuración →
  Apariencia medía 543 px en un teléfono de 412). Declarado en `verify:aspecto`.


## DP-D39 · El modo espera: una capa encima del puesto, por aparato, sin migración · 29-10-2026

- **Qué:** tras unos minutos sin tocar, una capa casi negra con la hora grande (en la zona del
  negocio, `America/Mexico_City`, no la del aparato), la fecha, el logo y Morfi dormido en bucle.
  Hora y logo se desplazan muy despacio contra el quemado (±24 px, en vueltas de 41 y 29 minutos).
  Al tocar, Morfi despierta (se asoma, sonríe, saluda) y la capa se va; otro toque se lo salta.
  Sin mascota o con «reducir movimiento», se va al primer toque.
- **Dónde y cuánto:** Caja (`/caja`, `/pos`, cierre del día) 3 minutos; Tablero (`/`) 3; Cocina
  (`/cocina`, también sus estaciones como Bebidas) 2; administración (ventas, inventario, compras,
  recetas, platillos, registros, portal QR, configuración) 3. **Nunca:** el mesero, el mapa y la
  mesa activa (se usan con la charola en la otra mano), el portal del comensal, el teléfono de
  cocina y la entrada.
- **Es una capa, no una pantalla:** la de abajo sigue montada; lo tecleado sigue ahí al volver.
  La capa (y la del PIN) es un `<dialog>` abierto con `showModal`, en la **capa superior** del
  navegador: va encima de todo (avisos, diálogos de Radix, la vista de un reporte), el resto de la
  página queda inerte (ni toques ni Tab llegan abajo) y al cerrarse el foco vuelve a donde
  estaba. Va en un portal al `<body>` (un diálogo de Radix abierto esconde con `aria-hidden` todo
  lo demás) y NADA sale de ella: ni el foco, ni el toque, ni una tecla (Radix cerraría su diálogo
  con lo tecleado, y hay atajos de ventana como el F12 que cobra). Despierta con el clic completo,
  no con el dedo que baja: así el toque no cae en el botón de abajo. El fondo es casi negro en todos los estilos (`--espera-fondo`, en `base.css`, no el
  lateral de cada estilo: en «papel» claro era casi blanco).
- **Despierta sola:** con una comanda nueva de su estación (Cocina), una cuenta pedida o un cobro
  de otra terminal (Caja). No hace peticiones propias: Cocina avisa desde su vigía de comandas y el
  despertador de la Caja escucha la lectura que la Caja ya hace cada 2 s. Cocina con comandas por
  preparar no se duerme.
- **Wake Lock:** mientras el puesto admite espera y el aparato la tiene encendida, para que el
  sistema operativo no apague la pantalla antes que el modo espera.
- **Por aparato** (`localStorage`, `morphiqpos.modo-espera`, como la vista «Solicitudes» de
  DP-D24): encendido o apagado y los minutos (1 a 60, o los de cada pantalla), en una pestaña nueva
  de Configuración, «Este aparato». La tableta de la caja puede dormirse y la de la barra no.
- **Por negocio:** «Pedir PIN al despertar», apagado por omisión, en
  `configuracion.valores.experiencia.pin_al_despertar` junto a «Mascota Morfi» (Configuración →
  Apariencia). Usa la entrada de siempre (`/api/auth/entrar`, con su límite de intentos y su
  bloqueo) con el empleo de la sesión, sin recargar. También cuando la despierta un aviso: ver la
  cuenta no es poder cobrarla. «Cambiar de persona» cierra la sesión.
- **El candado del PIN vive en el aparato** (`localStorage`, con el empleo de la sesión): una
  recarga, otra pestaña o cambiar de ruta no lo quitan, y vale en todas las rutas del marco
  interno; otra pestaña del aparato se entera (evento `storage`). Lo quitan sólo el PIN correcto,
  entrar con PIN (las dos pantallas de acceso) y cerrar la sesión **cuando el servidor la cerró**
  (si `salir` falla, sigue puesto). Ni Escape ni el gesto Atrás de Android cierran la capa
  (`closedby="none"`), y si el navegador la cierra igual (uno que no conoce `closedby` sólo deja
  cancelar una petición de cierre, no dos seguidas) se vuelve a abrir. La pantalla del PIN vuelve
  a dormirse a los 30 s sin tocar; su fondo es opaco (no deja ver cuentas ni importes). Es un
  candado de pantalla, no del servidor: quien abra las herramientas del navegador lo salta; para
  eso está cerrar la sesión.
- **La experiencia se guarda interruptor por interruptor:** cada uno manda sólo lo que cambió y el
  servidor lo mezcla con lo guardado (antes reemplazaba el objeto entero y una pestaña vieja
  podía apagar el PIN que otro aparato encendió). El modo espera lee el PIN de la configuración
  del negocio, que vuelve a pedir al dormirse y cada minuto mientras duerme; el candado se decide
  otra vez al despertar con lo que el negocio pide entonces. Así un «Pedir PIN» encendido en otro
  aparato vale al siguiente despertar, sin recargar la tableta.
- **Sin migración.**

## DP-D40 · Los sonidos de la interfaz: un gestor, Sound Lab como código, el aparato y el negocio · 30-10-2026

- **Fuente:** React Bits · Sound Lab (`DavidHDev/react-bits`, commit `e12c221`): el motor de Web
  Audio y 25 recetas, **como código** (se sintetizan en el navegador: sin archivos de audio, suenan
  sin internet en el servidor privado). Licencia MIT + Commons Clause, en `licencias/`: se usan
  dentro del producto; no se venden ni se redistribuyen sueltos. El motor se partió en módulos de
  menos de 300 líneas y sólo se guardaron las lecturas que el TypeScript estricto exige.
- **Un solo gestor** (`apps/web/src/sonidos/gestor.ts`, `sonar(evento)`): perfil de **este
  aparato** —Apagado, Suave (por omisión, al 70) o Normal, y el volumen— en Configuración → Este
  aparato (`localStorage`, como el modo espera); se desbloquea con el primer toque, dentro del
  mismo gesto (Safari); nunca se encima con la voz de Cocina o de Solicitudes (`speechSynthesis`
  hablando o en cola); un mismo sonido no se repite antes de 80 ms; el toque genérico espera 40 ms
  y se calla si en ese instante suena algo más preciso (un toque, un sonido). «Reducir
  movimiento» no apaga el sonido; el perfil sí.
- **Un oyente único** en la pestaña: lo que se toca (un botón, Felt; una pestaña o el menú,
  Notch; un interruptor, Clasp o Unclasp según quede; `data-sonido` manda; deshabilitado, nada) y
  lo que aparece (un diálogo o cajón, Popover al abrir y Fold al cerrar; un aviso de error, Shrug;
  uno de advertencia, Hint). Las pantallas llaman a `sonar` sólo para lo que el DOM no dice:
  agregar (Pebble), cambiar la cantidad (Bead), quitar (Fold), enviar a cocina (Dispatch), el
  cobro (Halo), el ticket (Receipt), la comanda lista (Check), la solicitud atendida (Boop),
  dormir y despertar (Dusk, Dawn: despertar suena sólo al tocar la pantalla), entrar y salir
  (Arrive, Retreat). Entrar y salir recargan la página y la recarga corta el audio: esperan 300 ms,
  sólo si de verdad va a sonar, y suenan **antes** de cambiar la sesión; si no, la pantalla navega
  sola y la recarga llega encima (dos navegaciones). Siempre en el camino del éxito: después del
  aviso o del comando que lo confirma, nunca en el clic. Los teclados de PIN llevan
  `data-sonido="tecla"`.
- **Del negocio** (`configuracion.valores.experiencia`, validado, sin migración): el sonido del
  teclado —Nib por omisión, o Keycap, Thock o Clasp: «Block» no existe en la biblioteca— y si el
  portal del comensal suena (apagado). Configuración → **Sonidos** enseña cada momento con su
  sonido y un botón para oírlo, aunque el aparato esté en Apagado: ahí se aprueba el mapa.
- **No se tocó:** el timbre y la voz de Cocina (lo pidió Miguel), la alerta del mesero cuando llega
  una solicitud (con su voz), y el sistema no tiene meta del día. Ping, Signal y Confetti quedan en
  el mapa con su nota hasta que Miguel decida. **DP-12.6 (DP-D49) lo cambió:** el timbre de
  Cocina (Ping), el aviso del mesero (Signal) y el pedido listo (Check) pasan al gestor, con su
  voz después del sonido; el sistema viejo (`lib/sounds`, «Activar sonidos») ya no existe.
- Las recetas se cargan cuando hacen falta: Keycap y Thock traen su muestra (50 KB cada una); las
  demás pesan menos de 1 KB.

## DP-D43 · Lo que ya no se puede pedir sale del carrito compartido al enviar · 31-10-2026

- **Problema** (encontrado al portar el carrito al maestro, PAR-1): si el negocio oculta, desactiva
  o cambia la regla de cantidad de un producto que ya está en el carrito de una mesa, «Enviar»
  fallaba para TODOS (`PRODUCTO_NO_ENCONTRADO` o `CATALOGO_INVALIDO`) y sólo el teléfono que lo
  agregó podía quitar la línea.
- **Elección:** al enviar, en la misma transacción y bajo el mismo candado, se apartan las líneas
  que ya no se pueden pedir (`portal/carrito-disponibilidad.ts`), se quitan, el pedido sale con lo
  demás y la respuesta dice qué se quitó (`noDisponibles`). El estado del carrito marca cada línea
  con `disponible` y el teléfono la enseña «Ya no está disponible: no se enviará» y no la suma.
  Agregar valora la cantidad con las reglas del envío (media pieza no entra). El mismo código que
  el maestro (A-59).
- **Descartado:** quitar las líneas al ocultar el producto (acopla el catálogo con el portal y no
  cubre el cambio de regla); dejar que cualquier teléfono quite una línea ajena no disponible
  (sigue trabando hasta que alguien la vea).
- **Consecuencia:** el teléfono que envía ve qué se quitó; los demás ven la línea marcada antes y
  luego el «Pedido enviado» de siempre. Avisarles la lista pediría una columna en `carritos_mesa`
  (migración, en la compartida la aplica el maestro): no entra hasta que haga falta.


## DP-D44 · El usuario de plataforma: una marca en la configuración, exigida en el servidor · 01-11-2026

- **Lo que había:** los cinco comandos de mantenimiento que borran en masa (`vaciar_mesas`,
  `purgar_seccion`, `purgar_ventas`, `reiniciar_pruebas`, `reiniciar_todo`) los ejecutaba
  cualquier dueño (y `vaciar_mesas` también el administrador). «Miguel · Morphiq» y el dueño del
  restaurante tienen el mismo rol, y los siete roles de `empleos.rol` los fija un `check` de la
  base.
- **Alternativas** (Miguel eligió la primera, 01-11): (a) una marca en
  `configuracion.valores.plataforma` con los empleos de plataforma; (b) una variable de entorno
  del servidor con esos empleos (no viaja con los datos y hay que darla de alta en cada
  despliegue); (c) un rol nuevo con migración (DDL que aplica el maestro).
- **Elección (a):**
  - `mantenimiento/plataforma.ts`: `exigirPlataforma` al principio de los cinco comandos, dentro
    de su transacción y antes de leer o borrar nada: 403 `SIN_PERMISO` con su rastro de
    «denegado», como un rol que no alcanza.
  - La marca no se lee ni se escribe por el camino genérico de Configuración (`NUNCA_SALEN`): el
    dueño no se la puede poner. La escribe `mantenimiento.marcar_plataforma`, que marca el empleo
    DE QUIEN LO EJECUTA y no tiene ruta HTTP (un contrato lo vigila); sólo la corre
    `scripts/marcar-plataforma.mjs`, con acceso a la base.
  - La sesión dice `es_plataforma` (PIN y `/api/catalogo/sesion`) y las pantallas sólo enseñan los
    botones a quien sí (`esUsuarioDePlataforma` en `permissions.js`): «Limpiar ventas de prueba»,
    «Eliminar todas» las mesas, «Limpiar sección» de Registros y la pestaña «Mantenimiento».
  - Viaja con las filas del negocio en la mudanza (Fase B y C) sin configurar nada más.
- **De paso:** `reiniciar_todo` no corría nunca contra una base real: borraba el catálogo con un
  `where organizacion_id` crudo (dos tablas cuelgan de su padre) y `returning id` (dos no tienen
  `id`). Ahora usa el mismo acotado que las secciones y cuenta con `numAffectedRows`.
- **Prueba:** unidad (la forma de la marca; ningún `route.ts` sirve `marcarPlataforma`) e
  integración contra Postgres (sin marca ningún dueño ejecuta los cinco; marcado, sí, y el otro
  dueño no; Configuración no la escribe ni la enseña y guardar otra cosa no la borra; reiniciar
  todo funciona). Seis mutaciones, todas muertas.

## DP-D45 · El portal: los comensales arman, el mesero confirma (y el portal en modo mesero) · 01-11-2026

- **Lo que había:** el carrito compartido (DP-D29) exigía una cuenta abierta («Abre la mesa antes de
  pedir», un texto para el personal que veía el comensal) y escondía lo armado antes de abrirla
  (`created_at >= ordenes.created_at`); cualquier comensal mandaba a cocina; el límite del sondeo
  era uno por mesa (240 al minuto: con diez teléfonos se cortaba) y el latido se escribía en cada
  sondeo; el id crudo del teléfono quedaba en la auditoría; 999.5 era un 500.
- **Elección:**
  - Dos opciones en `configuracion.valores`, validadas al guardar y leídas en el servidor
    (`banderas.ts`): `portal_qr_envia_a_cocina` = `mesero` (por omisión) | `comensales`, y
    `portal_qr_comensales_abren_mesa` (apagada; sólo cuenta si envían los comensales). Portal QR →
    Configuración → «Pedidos desde el portal».
  - El carrito se arma con la mesa cerrada; las líneas cuelgan de la mesa y se olvidan cuando la
    cuenta se cierra (cancelada, cobrada o la vacía que se libera) y al cerrar la última caja de la
    sucursal, que es cerrar el día (`restaurante/carrito-del-salon.ts`). Al unir mesas o cambiar de
    mesa, las líneas y los teléfonos siguen a la cuenta.
  - Qué hace el comensal lo decide el servidor (`quien-envia.ts`, `envio` en el estado):
    «Llamar a mi mesero para confirmar» (una solicitud `ordenar` con la nota «Pedido listo para
    confirmar (N platillos)»; si ya hay una pendiente, se pone al día su nota), «Pide a tu mesero
    que te atienda para enviar tu pedido», «Abrir la mesa y enviar» (con el diálogo de siempre:
    personas, alergias) o «Enviar a cocina» (con «¿Ya pidieron todos?» de dos teléfonos en
    adelante). El envío del comensal lo rechaza el servidor si no le toca.
  - **Portal en modo mesero**, dentro de su sesión (rol y sucursal del servidor): «Escanear QR» en
    «Mesas y pedidos» (el lector de siempre, `BarcodeDetector` o ZXing, o el código a mano), el
    aviso «Pedido listo para confirmar» y la mesa abierta en el POS (decisión de Miguel) abren lo que
    armaron los teléfonos: cambiar cantidades, quitar cualquier línea, borrar el pedido, abrir la
    mesa y confirmar y enviar a SU nombre por el mismo camino que su pedido (`comandarLasLineas`).
    Cuatro comandos auditados (`restaurante.carrito_*`) y dos lecturas POST (el token del QR no va en
    la URL). Un comensal no tiene cómo hacerse pasar por mesero: las rutas públicas no aceptan nada
    parecido.
  - **Mantener presionada una mesa** (o clic derecho) abre «Ver mesa / Ver QR de la mesa»: la mesa
    se reconoce por `data-mesa-id` en el contenedor del mapa, sin tocar el toque normal; el QR sale
    grande en la pantalla para escanearlo desde el teléfono del mesero.
  - Arreglos: el límite del sondeo por teléfono (60/min) más un techo por mesa (2400/min); el token
    se valida SIEMPRE antes de contar (también con un solo negocio en el despliegue); el latido se
    escribe a lo mucho cada 30 s; sin «Mostrar precios» el carrito no los trae; `dispositivo` (la
    clave exacta) en `CLAVES_SENSIBLES`; la cantidad tope 999 en zod; el diálogo de confirmar se
    cierra cuando otro teléfono envía; «Sin conexión, reintentando» cuando el sondeo falla.
- **Descartado:** borrar las líneas al vuelo con una regla de tiempo (cuál cuenta se cerró
  después); deja huérfanas y depende del reloj. Y un rol `mesero` dentro del portal público: el
  portal en modo mesero es la sesión del mesero, no el portal con otra bandera.
- **Sin migración.** Los tipos de solicitud siguen siendo los del `check` (`ordenar`); la nota va
  en `solicitudes_qr.notas`.

## DP-D46 · Unir mesas: la misma mesa que tiembla, el imán en la vecina, la forma fundida · 01-11-2026

- **Lo que había:** al entrar a «Unir mesas» las mesas cambiaban de forma (cajas grises); el imán
  movía la mesa ARRASTRADA mientras se arrastraba (brincaba bajo el dedo); el grupo se veía como
  cajas sueltas; «Separar mesas» sólo existía en la mesa abierta; unir una mesa con gente no
  preguntaba y sus alergias y su celebración se quedaban en la absorbida, ocultas (un tema de
  inocuidad: la cocina copia las de la principal); una mesa en limpieza daba un error genérico;
  el editor y «vaciar el mapa» podían apagar una mesa de una unión viva y dejar las absorbidas
  ocultas para siempre; `?unir=` se quedaba en la dirección.
- **Elección:**
  - En «Unir mesas» la pantalla dibuja la MISMA `MesaShape` del mapa (forma, tamaño, color, número,
    estado, mesero) dentro de `MesaQueTiembla`: tiembla como los íconos al acomodarlos, cada una
    con su desfase; con «reducir movimiento», un contorno punteado en lugar del temblor.
  - El arrastre son eventos de puntero con el puntero capturado y `touch-action: none` en la mesa:
    sigue al dedo 1:1 (`adondeVa`, puro). El imán ya no la mueve: la VECINA se inclina y se estira
    hacia ella (`vecinaQueLlama`, del dominio) y, al soltar a 36 puntos o menos, se pegan
    (`atraer`). El arrastre, la inclinación y el asentarse van en `translate`/`scale`, que se
    componen con el temblor (`transform`) sin pisarlo.
  - El grupo se ve fundido en la forma que le toca (`formaDeLaUnion`, del dominio): redondas lado a
    lado, cápsula horizontal; una sobre otra, vertical; cuadradas o mixtas, rectángulo; casi igual
    de ancho que de alto, cuadrado. En el mapa del mesero una unión viva se pinta igual, en la caja
    del grupo, con el número de la principal.
  - Con gente, antes de «¿Qué número queda?»: «La Mesa N tiene gente y un pedido de $X.
    ¿Unir de todos modos?» (Cancelar / Unir; sin el importe si no se puede leer). Al unir, las
    alergias y la celebración de la absorbida llegan a la mesa y a la cuenta que quedan, sin
    repetir (`notas-de-la-union.ts`), junto con su carrito del portal (DP-D45).
  - En limpieza: «La Mesa N está en limpieza: márcala libre primero», en pantalla y en el servidor.
  - Separar: tocar la unión en «Unir mesas» o, en el mapa, mantenerla presionada → «Separar mesas»
    (también para uniones libres, sin cuenta). Las absorbidas salen de la principal y vuelven a su
    lugar con una animación; luego, al mapa.
  - Ninguna unión se queda varada: el editor no apaga ni la principal ni una absorbida de una
    unión viva («sepáralas antes de quitarla del mapa», `sinCabezaViva` en la guarda del puente) y
    «vaciar el mapa» se niega con mesas unidas. `?unir=` se limpia al entrar (y avisa si la mesa ya
    no se puede unir).
- **Descartado:** cambiar la forma de las mesas al unir (lo que se pidió es lo contrario) y una
  biblioteca de arrastre: los eventos de puntero alcanzan y el 1:1 se mide en la prueba.
- **Sin migración.**

## DP-D47 · Las estaciones no son sólo Cocina y Bebidas: verificadas de punta a punta · 01-11-2026

- **Lo que se pidió:** Don Poncho tendrá varias estaciones sin nombre todavía; verificar con 3 o
  más, y arreglar lo que falle.
- **Lo que se encontró:** el reparto ya era genérico (Producto → Categoría → Estación, la general
  de respaldo; DP-10.1) y la pantalla, la voz y el teléfono de cocina ya filtran por la estación de
  la sesión. Un defecto: al desactivar una estación, Configuración movía sus categorías a la
  general tragándose cada error; si uno fallaba, la estación se apagaba igual y la categoría
  quedaba apuntando a una estación apagada. Ahora, si una no se mueve, no se apaga y se dice por
  qué.
- **Por platillo no se asigna:** el modelo toma la estación de la categoría (no hay columna en el
  producto). No se agrega: es DDL y no se pidió.
- **Lo que no es defecto:** `comandas.area` (`cocina`/`barra`) y `productos.area_preparacion` son
  valores de la base; el aviso del rol antiguo «Barra» en el diálogo de usuario.
- **Sin migración.**

## DP-D48 · El mesero cancela con motivo, y el corte dice quién y qué fue pérdida · 01-11-2026

- **Lo que había:** cancelar una cuenta con consumo y anular un platillo enviado eran sólo de caja
  y dirección; la mesa del cliente que se va sin pagar se quedaba clavada hasta encontrar al
  cajero. El corte heredado de la Caja armaba las cancelaciones en el navegador y ponía como
  «Usuario» a quien cobraba o atendía, no a quien canceló; lo ya preparado no se distinguía.
- **Elección:**
  - El rol `mesero` entra a `restaurante.cancelar_orden` y `restaurante.anular_linea` (cocina y
    almacén siguen fuera; la sucursal se sigue exigiendo). El motivo es obligatorio y queda con su
    nombre (`cancelada_por`, `empleado_anula_id`). El control es el registro, no negar la salida.
  - En la mesa ocupada del mesero: «Quitar un platillo» y «Cancelar la cuenta», con su motivo;
    si la cocina ya preparó algo, se avisa que es pérdida.
  - Una sola lectura del servidor (`caja/corte/cancelaciones.ts`) para los dos cortes y para
    Registros (pestaña «Cancelaciones»): quién canceló, cuándo, por qué, cuánto y la mesa. PÉRDIDA
    = lo que ya estaba «listo» o «entregado» según la cocina (`comandas`/`comanda_items`), no
    `estado_preparacion` (que la cancelación pisa); va en su propia sección, resaltada y con
    total. Sin doble conteo: un platillo listo que se anula y luego se cancela la cuenta es una
    sola pérdida.
  - El motivo se dice en palabras (`etiquetaDelMotivoDeAnulacion`), no `error_mesero`.
- **Descartado:** pedir la hoja del corte entera desde el heredado (dos lecturas chicas que
  comparten la consulta) y la definición más estricta del dominio (`elConsumoSePerdio`) para el
  corte: Miguel pidió «listo o entregado».
- **Sin migración.** Dividir la cuenta sigue siendo de caja.

## DP-D49 · Las pantallas: menú QR, Cocina y teléfono, Ventas, nombre de mesa, 25 mesas, un solo sonido y la limpieza por hora · 01-11-2026

- **Menú QR:** la marca del precio va anclada arriba, mide un renglón y sobresale 3 px: tapa el
  precio impreso en 320–430 px. «Atención» pasa a la esquina inferior IZQUIERDA (la columna de
  precios está a la derecha).
- **Cocina en el teléfono y el botón redondo del menú:** el encabezado se acomoda en dos renglones
  si no cabe; el contenido deja aire abajo cuando el administrador tiene el botón flotante.
  Solicitudes: las pestañas de filtro se acomodan en renglones.
- **Ventas sin receta:** costo cero (o nulo) en una venta con importe es costo DESCONOCIDO: margen
  y utilidad «—, sin receta» (`costo-de-la-venta.ts`, del dominio). En un periodo el margen sale
  sólo de las ventas con costo y se dice cuántas quedaron fuera: Ventas, tablero, gráfica,
  Registros, su PDF y el CSV. La pastilla vacía era `tipo_venta` (la venta no lo trae): sale; sin
  folio no se pinta y la cuenta abierta lo dice. El encabezado dice qué cuenta («2 transacciones
  · 1 pagada · Cobrado: $200.00»).
- **El nombre de la mesa** no se repite si es vacío o igual a «Mesa N» (`nombre-de-la-mesa.ts`, en
  nueve pantallas).
- **25 mesas:** cada mesa puesta reserva su medida real al buscar dónde nace la siguiente (antes la
  caja más grande tapaba la casilla de al lado y la 21 caía encima de otra); con la rejilla llena
  baja de fila.
- **Un solo sistema de sonido:** sale el viejo (`lib/sounds`, `SoundUnlockButton`); Ping, Signal y
  Check por el gestor, con `sonarAntesDeHablar`: la voz empieza cuando termina el sonido.
- **La limpieza de solicitudes** automática corre a lo mucho una vez por hora por negocio, decidido
  en el servidor (la última, de `auditoria`, con un cerrojo consultivo). Si no le toca, no escribe
  nada: la señal `SinNovedad` revierte la transacción —ni auditoría ni clave— y contesta éxito.
  Es un cambio al envoltorio de comandos, con su prueba. El botón «Limpiar antiguas» limpia
  siempre.
- **Pendiente (para Miguel):** el Cierre del día, el corte y las pantallas de Caja (`Caja.jsx`,
  `CorteCaja.jsx`) todavía calculan el margen con costo cero = 100 %. El Cierre tiene cada venta y
  puede usar `economiaDelPeriodo`; el corte suma costos en el servidor y necesita contar las ventas
  sin costo. No se hizo en DP-12 para no retrasar la publicación.
- **Sin migración.**

## DP-D50 · El corte: la pérdida es lo que valía lo ya hecho, y cada caja cuenta sus cuentas · 02-11-2026

- **Lo que había:** una cuenta cancelada con UN platillo listo salía como pérdida entera. El corte
  contaba las cancelaciones por sucursal y por hora: con dos cajas abiertas las dos traían las
  mismas, y lo cancelado sin caja abierta no salía en ninguna. El corte de una caja abierta leía
  su propio reloj sin decirlo.
- **Elección (Miguel la puede cambiar):**
  - **Pérdida** = de cada platillo de la cuenta que no se anuló aparte, la parte que la cocina dejó
    lista o se entregó, a su precio en la cuenta (`perdidaCentavos`). Lo demás de la cuenta es
    cancelado sin costo: una cuenta mixta sale en las dos tablas, cada una con su parte.
  - **El corte de UNA caja** trae sólo las cancelaciones de SUS cuentas: el platillo anulado de una
    cuenta que esa caja cobró, y lo que canceló quien la abrió mientras estaba abierta.
  - **El Cierre del día** es el corte de la última caja abierta de la sucursal al cerrar: trae TODAS
    las cancelaciones de la sucursal desde el Cierre del día anterior (de las cajas, de la mesera,
    de nadie), cada una una vez. Lo cancelado sin caja abierta cae en el Cierre del día que sigue.
    Sin Cierre anterior, la ventana empieza a medianoche (hora del negocio) del día en que se abrió
    la caja. Dos cajas que cierran en el mismo instante: cierra el día la de id mayor.
  - **El corte de una caja abierta** cuenta hasta la hora en que se lee y lo dice («Corte parcial ·
    hasta»); todas sus lecturas usan ese mismo instante.
  - Cada sección de cancelaciones dice de cuáles habla (las de esta caja, o el día).
- **Descartado:** guardar la caja en la cancelación (pediría migración) y atribuir lo de la mesera
  a «la única caja abierta» (con dos cajas no es determinista).
- **Sin migración.** `caja/corte/alcance-del-corte.ts`, `cancelaciones.ts`.

## DP-D51 · Cancelar desde el mesero: sus mesas, nunca lo cobrado, y con PIN si ya se pidió · 02-11-2026

- **Elección:**
  - No se cancela una cuenta pagada, con pagos, dividida, reembolsada (o en parte) ni absorbida.
  - El motivo es obligatorio en el servidor (cancelar: 3 a 300 letras; anular: un motivo cerrado).
  - El **mesero** cancela o anula sólo en las mesas que atiende o que tiene asignadas; cajero,
    gerente, administrador y dueño, en cualquiera de su sucursal.
  - Con la cuenta **pedida** o la precuenta **impresa**, quien no autoriza por su puesto necesita el
    PIN de un gerente, administrador o dueño, en el mismo diálogo. Es lo predeterminado; Miguel lo
    apaga con `configuracion.valores.pin_al_cancelar_cuenta_pedida = false`.
  - **D-5 arreglado:** la autorización firmada del supervisor lleva `cuenta` y `para`
    (`descuento` o `cancelacion`): la de la mesa 3 no sirve en la 6, y la de un descuento no
    sirve para cancelar. Sigue durando dos minutos.
  - **Con mesas unidas**, la cuenta que queda carga con las que absorbió (con la unión viva o ya
    separada: separar no devuelve el consumo): si alguna se pidió —su `codigo_caja` sobrevive a la
    unión— o se imprimió, pide el PIN; si alguna la abrió otro mesero, el mesero no la cancela ni
    anula. Unir no borra el «ya se pidió» ni le da a un mesero la mesa de otro.
  - El aviso de pérdida no sale a ciegas: al abrir «Cancelar la cuenta» se vuelve a leer la cocina;
    mientras, no se puede confirmar, y si falla se dice «No pude comprobar la cocina».
- **Descartado:** autorización de un solo uso (pediría guardar el nonce: migración).
- **Sin migración.** `restaurante/cancelar-con-permiso.ts`, `identidad/supervisor.ts`,
  `venta/PinDeSupervisor.tsx`.

## DP-D52 · El margen «sin receta» es una regla del servidor, y existe «receta incompleta» · 02-11-2026

- **Lo que había:** DP-D49 cazaba sólo la cuenta TODA sin receta (costo cero); una cuenta con un
  platillo con receta y otro sin ella daba un margen inflado. El Cierre del día, el corte, Caja,
  su corte y el ticket del corte seguían en 100 %.
- **Elección:** una sola regla en SQL (`caja/corte/costo-conocido.ts`): una línea viva con importe y
  costo cero no tiene costo conocido; la cuenta con todas así es «sin receta», con algunas
  «receta incompleta». La usan el corte del servidor (margen sólo de las cuentas con costo
  completo, y cuántas quedaron fuera), sus productos y categorías, el puente (`estado_costo` de
  cada venta, sólo para quien ve márgenes) y el exporte del servidor. Las pantallas obedecen ese
  estado (`margen-de-las-ventas.ts`): Cierre del día, Caja y su Resumen, el diálogo del Cierre,
  la página del corte, el ticket del corte y el CSV de Registros. Sin el campo (ventas viejas),
  la foto del cobro.
- **Sin migración.**

## DP-D53 · El sonido no se queda mudo: pendiente, aviso y voz que reintenta · 02-11-2026

- **Elección:** se desbloquea también con `pointerdown` y `touchstart`; `resume()` se rinde a
  los 1.5 s. Lo que quiso sonar antes del primer gesto se guarda (el último) y suena con ese
  gesto; la voz que el navegador negó (`not-allowed`) se vuelve a decir cuando ese timbre
  termina. Mientras tanto, abajo, «Sonido apagado · toca para activar». No vuelve el botón viejo.
- **Sin migración.**

## DP-D54 · La cámara sólo donde se escanea, y sin cámara se elige la mesa · 02-11-2026

- **Elección:** `Permissions-Policy` con `camera=(self)` sólo en `/mesero` y `/pos`, `camera=()` en todo
  lo demás (el portal incluido); la puerta de cabeceras exige exactamente eso. Sin cámara (o con
  el permiso negado) el respaldo es elegir la mesa de una lista, no un campo numérico. «Pedido del
  portal» en el menú de pulsación larga de la mesa. La cámara se apaga siempre, también si se
  cierra mientras arranca.
- **La cabecera es del documento, no de la pantalla.** El navegador la fija al CARGAR, y Next
  cambia de pantalla sin cargar: quien entra al mesero desde la caja, el tablero o la entrada por
  PIN (la mesera que abre `/caja` cae en sus mesas así) seguía con `camera=()`. Antes de abrir el
  escáner se mira en qué ruta cargó el documento; si fue en una sin cámara, se carga otra vez la
  misma pantalla con `?escanear=1` y al llegar abre el escáner sola y borra la marca. No se abrió
  la cámara a todo el interior: la regla sigue siendo «sólo donde se escanea».
- **Sin migración.** `apps/web/permisos-del-navegador.mjs`, `apps/web/src/cliente/escaner-del-documento.ts`.

## DP-D55 · El carrito de la mesa no pasa a la siguiente familia, y su aviso vive lo que vive el pedido · 02-11-2026

- **Elección:** liberar la mesa borra su carrito; el carrito de una mesa sin cuenta caduca solo
  tras 3 h sin actividad (perezoso, al leer o al agregar). El aviso «Pedido listo para
  confirmar» se resuelve cuando el carrito queda vacío o se envía, por cualquier camino, y sólo
  el de esa ronda; «Atender» no lo consume. «Volver a llamar» renueva el aviso (suena y habla otra
  vez). Llamar al mesero toma el candado del carrito.
- **Sin migración.**


## DP-D56 · Unir y separar no pierden nada del portal · 02-11-2026

- **Elección:**
  - Al unir (y al mudar la cuenta de mesa), las solicitudes pendientes de la mesa que se va pasan
    con su carrito a la que se queda: su QR ya cae ahí. Una sola pendiente por mesa y tipo: si la
    principal ya tenía una del mismo tipo, la otra se da por resuelta.
  - **El tope de un carrito (60) vale para los carritos juntos.** Si al unir pasarían, no se une
    («que una de ellas envíe o vacíe el suyo primero») y no se mueve nada. Descartado: cortar lo
    que sobra (se perderían pedidos de comensales) o dejar el carrito por encima del tope (el
    comensal no podría enviarlo).
  - Al separar, el pedido del portal y las notas se quedan en la principal —no hay manera honesta
    de repartirlos—, pero ya no en silencio: el resultado cuenta las líneas
    (`lineasDelPortalEnLaPrincipal`) y trae un aviso («El pedido del portal (3 cosas) se quedó en
    la mesa 1»), que la pantalla enseña.
  - Las notas juntas (alergias, celebración) miden 300 como máximo; si se pasan, se cortan con «…».
- **Sin migración.** `restaurante/carrito-del-salon.ts`, `restaurante/al-separar.ts`,
  `restaurante/notas-de-la-union.ts`.

## DP-D57 · Lo cancelado que ya estaba hecho sale del almacén como merma «Por cancelación» · 02-11-2026

- **Elección:** al cancelar la cuenta o anular un platillo, lo que la cocina ya había dejado listo
  o entregado sale del almacén con la misma traducción del cobro (`planearConsumo`: la receta del
  canal con sus opciones, o la pieza si se vende por pieza). «Ya hecho» es lo mismo que el corte
  llama pérdida (DP-D50). Lo anulado aparte sale al anularse y no se repite al cancelar.
- **Cancelar nunca se traba por el inventario:** si el almacén decía que no había, ya estaba mal
  (la cocina lo preparó); la existencia puede quedar en negativo para que el conteo lo enseñe.
- **La clave:** `motivos_merma` es un catálogo GLOBAL de la base compartida; una clave nueva
  («por_cancelacion») sería escribir en lo de los otros negocios. Se guarda con
  `platillo_rehecho` (lo más cercano que existe: un platillo hecho que se tira), la referencia
  `orden` o `anulacion`, la nota «Por cancelación · …» y el costo del insumo; el corte la dice
  «Por cancelación». **Pendiente para el maestro (ficha 27):** sembrar la clave propia y cambiar
  la constante `MOTIVO_DE_LA_MERMA`.
- **Descartado:** merma sólo de lo que tiene receta (una cerveza servida también salió del
  almacén); y descontar al enviar a cocina (cambiaría el cobro entero).
- **Sin migración.** `restaurante/merma-por-cancelacion.ts`, `venta/cobrar.ts` (`soloLoHecho`),
  `caja/corte/consultas.ts`.

## DP-D58 · El portal del comensal: el teléfono lo reconoce el servidor, y el comensal se entera · 03-11-2026

- **Elección:**
  - **El id del teléfono lo emite el servidor**, firmado con HMAC (`t1-<24 hex>-<32 hex>`, con un
    prefijo propio y la pimienta): el sondeo emite uno cuando falta o no verifica, y agregar,
    quitar, enviar y llamar rechazan un id sin firma (`QR_TELEFONO_NO_RECONOCIDO`); el navegador
    pide otro y reintenta una vez. Emitir tiene límite (40 por mesa y 200 por IP cada 15 min: el
    WiFi del local es una sola IP) y «conectados» no pasa de 20. Al desplegar, lo que un teléfono
    armó con un id viejo queda como de otro teléfono una vez.
  - **Las personas al abrir la mesa** ya no salen de «conectados»: las confirma el comensal en el
    diálogo; sin ellas, la mesa se abre para 1 y el mesero corrige.
  - **«Tu mesero vació el pedido»:** la marca vive en `carritos_mesa` (las columnas del último envío
    con una huella centinela, sin subir la ronda), sin migración; cada teléfono la oye una vez, en
    su siguiente sondeo, si estaba ahí antes del vaciado (vence a los 5 min). Sólo el vaciado del
    mesero avisa.
  - **«Abrir la mesa y enviar»** es una sola llamada y una sola transacción: si el envío falla, la
    mesa queda libre y el carrito intacto.
  - **Con la cuenta pedida**, el comensal ve «Tu cuenta ya se pidió: tu mesero lo revisa» (no un
    error) y su pedido sigue a la vista; el mesero, en «Pedido del portal», puede «Reabrir la cuenta
    y enviar» si no tiene pagos: la cuenta vuelve a `confirmada` (conserva su `codigo_caja`, sube su
    versión), en la misma transacción que el envío.
- **Sin migración.** `portal/telefono.ts`, `portal/limite.ts`, `restaurante/reabrir-la-cuenta.ts`,
  `restaurante/carrito-del-mesero.ts`; cuatro códigos de error nuevos en `contracts/errores`.

## DP-D59 · Un negocio sin topes de descuento usa los del sistema · 03-11-2026

- **El hallazgo (QA2-009):** la migración 078 sembró los topes por puesto para cada negocio que ya
  existía; Don Poncho se dio de alta después y quedó sin ninguno, y ninguna pantalla los escribe.
  Con «sin fila es cero», nadie podía dar un descuento, ni el dueño (no hay nadie por encima que
  lo autorice).
- **Elección:** si el negocio no tiene **ninguna** fila en `topes_descuento`, cada puesto usa el
  tope del sistema, los mismos valores de la 078 (`venta/topes-del-sistema.ts`: dueño 100 %,
  administrador 50 %, gerente 30 %, cajero 10 % hasta $50, los demás 0). En cuanto el negocio
  tiene una fila, mandan las suyas y el puesto que no escribió queda en cero (como antes).
- **Descartado:** sembrar los topes en la base de producción (es escribir datos sin pantalla que
  los mantenga, y la base es compartida) y abrir el descuento a todos sin tope.
- **Sin migración.** `venta/descuento.ts` (`topeDe`), `venta/topes-del-sistema.ts`;
  `negocio-de-prueba/como-nueva.ts` lo reexporta. **Para el maestro (ficha 29):** el mismo
  respaldo vale para todo negocio dado de alta después de la 078.

## DP-D60 · Dos cajas como máximo, y la cuenta la cobra quien la tome primero · 06-11-2026

- **Lo que decidió Miguel:** Don Poncho puede tener **dos** cajas abiertas a la vez, nunca más.
  En Configuración → Caja, «Cajas abiertas a la vez»: 1 o 2. Lo cambian sólo el dueño o el
  administrador (`caja.fijar_cajas_simultaneas`, con su auditoría); escribe
  `sucursales.cajas_simultaneas`, que ya existía (la 179 y su disparador), así que es un dato y no
  DDL. Con dos abiertas no se deja bajar a una: primero se cierra una.
- **Las dos cajas cobran lo mismo:** las dos ven todas las cuentas pendientes de la sucursal y la
  cobra quien la tome primero. `venta.cobrar` ya bloqueaba la orden (`for update`) y volvía a
  mirar su estado: jamás un cobro doble. Lo nuevo es el mensaje: la que llega después (o pierde la
  carrera) lee **«Ya se cobró en Caja 1»**, con el nombre de la terminal de la sesión que la cobró.
  La tercera que intente abrir lee **«Ya hay 2 cajas abiertas: cierra una»**.
- **«Esta cuenta la está cobrando Caja 1» no se dice antes de cobrar:** no hay dónde saber que otra
  caja tiene la cuenta abierta en su pantalla sin una marca nueva (DDL o una escritura por cada
  vistazo). Lo que sí está: la lista de pendientes se relee cada 2 s, y el cobro de la segunda se
  rechaza con su nombre.
- **¿Un mismo usuario puede tener dos cajas abiertas en dos aparatos?** Sí: la caja es de la
  terminal, y cada navegador que entra se da de alta como su terminal («Caja N»). **Elección:**
  igual se crea **«Caja 2»** en la base propia (Miguel teclea su PIN): una persona por cajón,
  porque el corte nombra a quien lo abrió y lo contó, y un faltante tiene que tener dueño. Los dos
  aparatos de caja se renombran «Caja 1» y «Caja 2» para que el mensaje los nombre bien.
- **El corte de cada caja trae sólo lo suyo y el Cierre del día suma las dos una vez:** ya era así
  (DP-D50); queda probado con dos cajas (`caja/dos-cajas.integracion.test.ts`).
- **Sin migración.** `caja/cajas-a-la-vez.ts`, `venta/ya-cobrada.ts`, `caja/sesion.ts` (mensaje),
  `apps/web/src/configuracion/CajaYDescuentos.tsx`.

## DP-D61 · Todo descuento lleva la clave de quien lo autoriza, atada al monto y de un solo uso · 06-11-2026

- **Lo que decidió Miguel:** en Configuración → Descuentos, «Permitir descuentos»: sí o no (sólo
  el dueño o el administrador; `configuracion.permitir_descuentos`, en `configuracion.valores`
  bajo el candado del documento, con su auditoría). **Apagados**, el botón no aparece en ninguna
  pantalla y el servidor rechaza todo descuento con `DESCUENTOS_APAGADOS`. **Encendidos** (lo de
  Don Poncho, y lo que vale sin escribir nada), **todo** descuento pide el PIN de un gerente,
  administrador o dueño, aunque sea de $1. El cajero y el mesero nunca descuentan solos, y si
  quien tiene la sesión es gerente o dueño vuelve a teclear el suyo (una tableta olvidada con
  sesión no sirve para regalar).
- **La autorización** (`identidad/supervisor.ts`) firmaba negocio, quién pide, cuenta, para qué y
  vencimiento; ahora firma también el **monto exacto** en centavos: con un PIN para $20 no se
  aplican $2,000 ni $19.99, y una sin monto no sirve. **Se gasta al usarla:** el nonce queda en la
  auditoría del comando que la usó (en la misma transacción), y un candado consultivo con el nonce
  por llave pone en fila a dos usos simultáneos: entra uno, el otro lee `AUTORIZACION_USADA`.
  **Por qué la auditoría y no `autorizaciones_descuento`:** esa tabla prohíbe en la base que quien
  autoriza sea quien pide (078) y la gerente que vuelve a teclear su PIN es justo eso. La fila de
  `autorizaciones_descuento` se sigue escribiendo cuando autoriza otro, con el tope propio de quien
  pide en **cero** (nadie descuenta solo), que cumple el `check` de la 180 con cualquier monto.
- **El límite es el tope del puesto de quien autoriza:** gerente 30 %, administrador 50 %, dueño
  100 % (los del sistema, o los que el negocio escriba). `topeDe` usa el respaldo del sistema **por
  puesto**: antes sólo valía si el negocio no tenía ninguna fila, y la primera que alguien
  escribiera dejaba al resto en cero (QA2-009 otra vez). Corrige DP-D59.
- **El motivo** sigue obligatorio y lo valida el servidor (4 a 200 caracteres).
- **El corte y el Cierre del día** traen cada descuento con cuánto, quién lo autorizó y por qué, y
  el total (`caja.descuentos_del_corte`, con el alcance de las cancelaciones de DP-D50); el monto
  es el de la venta y quién y por qué salen de la auditoría del comando.
- **En Caja:** «Descuento» y «Cancelar la cuenta» viven ahora en el cobro de `Caja.jsx` (también
  para las partes de una cuenta dividida); antes sólo en `/restaurante/cobro`, que nadie enlaza.
- **Para el maestro:** que todo descuento pida PIN es una regla de Don Poncho; la firma con monto,
  el uso único y el respaldo por puesto son genéricos.
- **Sin migración.** `venta/descuentos-permitidos.ts`, `venta/autorizacion-de-un-uso.ts`,
  `venta/descuento-de-mostrador.ts`, `venta/descuento.ts`, `identidad/supervisor.ts`,
  `caja/corte/descuentos-del-corte.ts`; dos códigos nuevos en `contracts/errores`.

## DP-D62 · Lo que el mesero quitó no se enseña como cobrado · 06-11-2026

- **El hallazgo (auditoría del 6-11):** la Caja leía `DetalleVenta` sin filtrar y el puente servía
  las líneas anuladas: el cobro, «Dividir» y el ticket las enseñaban mientras el total ya no las
  contaba.
- **Elección, de raíz:** `DetalleVenta` sólo sirve lo que se sigue cobrando (`anulada_en` nula,
  un `filtroFijo` del puente). Con eso dejan de verlo el cobro, «Dividir», el ticket final, su
  reimpresión y el ticket histórico, el CSV del desglose por producto y todo lo demás que lee
  `DetalleVenta`. Lo quitado vive en una entidad aparte, `RenglonQuitado` (la misma tabla, sólo las
  anuladas, **sin ningún importe**), para el historial: en Ventas sale tachado y marcado
  «Quitado». El ticket es un papel que suma su total y no lo trae. El corte ya lo contaba aparte
  (cancelaciones).
- **Sin migración.** `puente/mapa.ts`, `puente/consultar.ts`, `puente/tipos.ts`.

## DP-D63 · Una línea por peso es una pieza que no se parte · 06-11-2026

- **El hallazgo:** `division.ts` truncaba la cantidad (`Math.trunc(0.5)` = 0): la barbacoa por kilo
  no cabía en ninguna parte y la división se rechazaba («quedaron unidades sin repartir»).
- **Elección:** una línea por peso (`variable_medida`) es **una pieza indivisible** al dividir, sea
  de ¼, ½, 1 o 1.5 kg: va completa, con su importe exacto, a una sola parte (el servidor la cuenta
  como 1 unidad y rechaza otra cantidad con `DIVISION_NO_CUADRA`). La división es por renglón o por
  partes; no hay «partes iguales».
- **El peso se dice como se pide:** «¼ kg», «½ kg», «¾ kg», «1 kg», «1.5 kg» (otros pesos con hasta
  tres decimales) en la comanda, el teléfono de cocina (también la voz), el cobro, la precuenta, el
  ticket, el portal y el carrito del mesero (`apps/web/src/restaurante/peso.ts`).
- **Sin migración.** Lo hizo el agente A (Sonnet), revisado e integrado en la sesión principal.

## DP-D64 · «Mesa limpia» borra sólo lo de antes del cierre de la cuenta · 06-11-2026

- **El hallazgo:** al marcar la mesa limpia se borraban el carrito, los teléfonos y el aviso de la
  familia que ya se había sentado mientras la mesa estaba en limpieza.
- **Elección:** el cierre de la cuenta es el último sello `limpieza` de la mesa
  (`eventos_mesa`); al limpiar se borran sólo las líneas, los teléfonos y los avisos de hasta ese
  momento. Lo posterior se queda, con su aviso. Sin cierre que leer (la mesa sin cuenta), como
  antes. Los demás que olvidan el carrito (cobrar, cancelar, liberar, caducar) no cambian.
- **Cambia un contrato de DP-13.2** (`carrito-fantasma`): lo que un teléfono agrega con la mesa en
  limpieza ya no se borra al limpiar, porque no se puede saber si es de la familia que se fue o de
  la que llegó (y perder el pedido de la nueva es peor). Límite conocido: un aviso viejo reutilizado
  por el índice único conserva su fecha y se cierra.
- **Sin migración.** Lo hizo el agente B (Sonnet).

## DP-D65 · El mesero agrega lo que no tiene opciones aunque falle esa lectura · 06-11-2026

- **El hallazgo:** si fallaba la lectura de opciones, el mesero no podía agregar nada.
- **Elección:** el producto trae `tiene_opciones` en la MISMA lectura de la carta (una «existencia»
  nueva del puente: `exists` sobre `producto_modificadores`, sin `join`). Lo que no tiene opciones
  se agrega al instante. Lo que tiene, espera la lectura con un tiempo límite de **8 s**; si falla,
  el diálogo dice que no pudo y ofrece «Reintentar», sin bloquear lo demás; cerrarlo cancela ese
  toque. La última lectura buena se guarda en el aparato, pero la pista del producto manda sobre
  ella (un platillo pudo ganar su grupo después). En Productos, el botón «Opciones» dice si falló y
  reintenta.
- **Sin migración.** Lo hizo el agente B (Sonnet); la existencia del puente, la sesión principal.

## DP-D66 · Una parte de una cuenta dividida se cancela con las reglas de una cuenta · 07-11-2026

- **El hallazgo:** las partes nacen sin mesa (`mesa_id = null`) y `restaurante.cancelar_orden` las
  rechazaba: una parte que no se iba a pagar no tenía salida.
- **Elección:** se cancela como cualquier cuenta: motivo obligatorio, sólo el mesero de esa mesa, y
  con PIN de un gerente si la cuenta ya se pidió (toda parte nace pedida, así que el mesero siempre
  lo necesita, DP-D51); lo ya hecho de SUS líneas es pérdida y merma (DP-D50, DP-D57); la cocina
  cancela sólo lo de esa parte. La madre vale lo que suman sus partes vivas y se queda `dividida`;
  la mesa sigue en servicio si queda alguna por cobrar, pasa a limpieza si alguna se cobró y no
  queda viva ninguna, y queda libre si todas se cancelaron. En el corte, la parte cancelada sale con
  la mesa de su madre.
- **Sin migración.** Lo hizo el agente C (Sonnet); la mesa en el corte, la sesión principal.

## DP-D67 · La opción obligatoria la exige el servidor, en los tres caminos · 07-11-2026

- **El hallazgo:** sólo la pantalla del mesero pedía la opción obligatoria; el portal, `/pos` o una
  llamada directa podían mandar el platillo sin su elección.
- **Elección:** `restaurante.enviar_pedido` (mesero y su carrito), el envío del portal y
  `venta.agregar_linea` (`/pos`) rechazan todo el pedido si a un platillo le falta su opción
  obligatoria (`OPCION_OBLIGATORIA`) o trae una que no es suya o de más (`OPCION_NO_VALIDA`). La
  elección queda ESTRUCTURADA (`orden_linea_modificadores` y la instantánea `orden_lineas.opciones`,
  tablas que ya existían). El mesero y `/pos` la mandan estructurada; el portal todavía sólo la
  manda en la nota («Grupo: opción», porque su carrito no tiene columna para más sin DDL) y el
  servidor la lee de ahí; lo estructurado manda sobre la nota. `/pos` pide las opciones como el
  mesero y el cajero las lee en la cuenta.
- **Límites:** leer la nota falla con un nombre de opción que lleve coma o « · » (hoy ninguna de
  las 139 de Don Poncho). Guardar la elección hace que el cobro aplique el sustituto y el factor de
  inventario de cada opción: en Don Poncho ninguna opción los tiene (0 de 139) y no hay recetas.
  En `/pos`, un platillo por peso que además tuviera opciones abre las opciones y no el peso (en
  Don Poncho las dos barbacoas por kilo no tienen grupos). Revisión del PR #9: el carrito compartido
  del portal ya no deja entrar la línea sin su opción, y la que ya estuviera se aparta al enviar
  (como un producto oculto, PAR-1): una línea mala no traba a la mesa.
- **Sin migración.** Lo hizo el agente D (Sonnet); el envío estructurado del mesero, la sesión
  principal.

## DP-D68 · Si no se pudo comprobar la cocina, se cancela con PIN y todo es pérdida · 07-11-2026

- **El hallazgo:** al cancelar desde el mesero, «Comprobando la cocina…» se podía quedar esperando
  para siempre, y sin respuesta no se sabe qué ya salió.
- **Elección:** la lectura tiene **8 s** y «Reintentar». Si no contesta (o falla), se cancela con el
  PIN de un gerente, administrador o dueño firmado para esa cuenta, y el servidor
  (`sinComprobarLaCocina`) cuenta TODO lo vivo como ya hecho: pérdida entera en el corte y merma en
  el almacén. Lo exige aunque la cuenta no se haya pedido y aunque el negocio haya apagado el PIN al
  cancelar (DP-D51): es pérdida firmada. Quien autoriza por su puesto no teclea.
- **Sin migración:** la marca vive en la entrada de la cancelación en la auditoría
  (`todoComoHecho`), y el corte la lee de ahí.
- Lo hizo el agente D (la pantalla) y la sesión principal (el servidor y el corte).

## DP-D69 · Reabrir una cuenta pedida es del mesero de esa mesa, o con PIN · 07-11-2026

- **Elección:** el mesero reabre en sus mesas o en las que nadie atiende; otro mesero necesita el
  PIN de un gerente para esa cuenta (la misma autorización de cancelar, `para: 'cancelacion'`, sin
  tocar `identidad/`). Gerente, administrador y dueño reabren sin PIN. La reapertura deja su propia
  entrada en la auditoría. Congruente con DP-D51 y DP-D58.
- **Límite:** la autorización de cancelar no es de un solo uso (cancelar ya es idempotente) y, por
  compartir el `para`, la que un gerente dio para cancelar una cuenta sirve también para reabrirla
  mientras no venza (dos minutos). Separarla pide un `para` propio en `identidad/`: para después.
- Lo hizo el agente C (Sonnet).

## DP-D70 · El margen sólo es «conocido» si todo su costo lo es · 07-11-2026

- **El hallazgo:** un insumo con costo 0 dejaba la cuenta como «conocida» y el margen salía inflado;
  la utilidad neta del Cierre del día sumaba como si todas las ventas tuvieran costo.
- **Elección:** un insumo de la receta con costo 0 deja la línea en «receta incompleta» (DP-D52
  manda): en el corte, Ventas, la gráfica, el Tablero y la tabla por producto, que distingue «sin
  receta» de «receta incompleta». La utilidad neta dice «(sólo ventas con costo)» cuando parte de
  las ventas quedó fuera. En el PDF, sin dato es «—», no «$0.00». Una venta cancelada no pinta margen.
- **Límite:** el insumo en cero se lee de la receta y el costo VIVOS: si después se le pone costo, un
  corte ya cerrado se relee como conocido con el costo congelado parcial. Cerrarlo pide una marca
  congelada en `orden_lineas` (DDL): para después de la instalación, si Miguel lo pide.
- Lo hizo el agente D (Sonnet).

## DP-D71 · La merma de lo cancelado no se le carga al empleado · 07-11-2026

- **Elección:** la merma por cancelación usa el motivo `por_cancelacion` (no imputable). Es un DATO
  de `motivos_merma`, que se siembra en la base propia de Don Poncho después de la mudanza (nunca en
  la compartida, donde ese catálogo es de todos). Mientras no exista, usa `prueba_cocina`, que existe
  y tampoco es imputable: cancelar nunca se traba ni se imputa. `platillo_rehecho` (imputable) queda
  para el platillo que se tuvo que rehacer.
- Lo hizo el agente D (Sonnet).

## DP-D72 · Cuotas propias: el PIN de supervisor y los teléfonos de una mesa · 07-11-2026

- **El PIN de supervisor** cuenta en su propio cubo (`LIMITES.supervisor`, 30 cada 5 min por red), no
  en el de «entrar»: los intentos de un gerente ya no le gastan la entrada a todo el restaurante,
  que sale por la misma IP. La pantalla dice cuánto esperar.
- **Los teléfonos nuevos de una mesa:** antes del tope de la mesa (DP-D58) se mira uno por mesa e IP
  (12 cada 15 min); lo que ése niega no gasta el de la mesa, así que quien tiene el QR desde una red
  ya no agota los teléfonos de la mesa. Un teléfono que ya tiene su id firmado nunca gasta cuota.
  Quien rote de red todavía puede: es la mitigación mínima y coherente, sin DDL.
- Lo hicieron los agentes D y C (Sonnet).

## DP-D73 · El papel suma: renglones − descuento (+ IVA) + propina = TOTAL = lo cobrado · 07-11-2026

- **El hallazgo (auditoría del 7-11, bloqueante):** el ticket calculaba TOTAL = la suma de los
  renglones + propina, sobre el subtotal bruto. $500 con $50 de descuento imprimía 500 y se cobraban
  450. El cobro de la Caja decía «Subtotal» con el total ya descontado y no enseñaba el descuento.
- **Elección:** un solo cálculo (`apps/web/src/venta/totales-del-papel.ts`) para todo papel —la
  precuenta, el ticket final, la reimpresión de Ventas y Registros, el de `/pos` y el de cada parte de
  una cuenta dividida, que son todos `PreCuentaTicket`— y para el cobro de la Caja: los renglones en
  bruto, «Descuento −$X», el IVA («IVA» si se suma, «IVA incluido» si va en el precio) y el TOTAL
  **del servidor** (`venta.total`, la venta sin propina); + propina = lo cobrado. Si el total del
  servidor no llegó (el respaldo de HOTFIX 6A), se calcula igual, restando el descuento. El cobro de
  la Caja dice además quién autorizó el descuento con su PIN y el motivo
  (`venta.descuento_autorizado`, de la misma entrada de la auditoría que lee el corte).
- **El peso** se dice con un solo formateador también en el cobro de la Caja y en Ventas (y su
  «Quitado»): «½ kg», «1.5 kg».
- **Sin migración.**

## DP-D74 · Dos cajas en pantalla: la segunda se abre, la que no cabe se trae · 07-11-2026

- **Elección:** si cabe otra caja, el aparato sin caja ve «No hay caja abierta en este aparato ·
  Abrir caja», aunque otra terminal tenga la suya: con el cupo en 2, la segunda caja se ABRE. «Traer
  esta caja aquí» sólo aparece si ya no cabe otra, y pide confirmación («… se queda sin caja»). En la
  tercera, «Abrir caja» dice en pantalla «Ya hay 2 cajas abiertas: cierra una» (el estado de la caja
  trae el cupo). Si otra caja ya cobró la cuenta, el cobro se cierra y la lista se relee.
- **El nombre de cada caja:** Configuración → Caja lista las terminales de la sucursal (cuál tiene la
  caja abierta) y el dueño o el administrador las nombra (`caja.nombrar_terminal`, con el antes y el
  después en la auditoría; el nombre es único en la sucursal).
- **Sin migración.**

## DP-D75 · `/pos` sigue sin descuento · 07-11-2026

- `/pos` (el mostrador sin mesas) no tiene botón de descuento, y no se agrega ahora: Don Poncho cobra
  sus cuentas en la Caja, que sí lo tiene (DP-D61). Si un día se agrega, va con la misma clave, el
  monto firmado y el uso único.

## DP-D76 · Usuarios con el puesto real; uno mismo cambia su nombre y su PIN, nunca su puesto · 07-11-2026

- **El hallazgo (auditoría del 7-11, bloqueante):** el puente servía el puesto en el vocabulario de
  la sesión (dueño, administrador y gerente salían como «administrador»), la pantalla lo devolvía
  así y el servidor le cambiaba el puesto a quien editaba; el dueño no podía editarse.
- **Elección:** el puente de usuarios sirve el puesto REAL de la base (`dueno`, `administrador`,
  `gerente`, `cajero`, `mesero`, `cocina`, `almacen`) con su nombre, y el color guardado
  (`empleos.color`); la sesión y `/api/auth/*` siguen con su vocabulario. El diálogo ofrece sólo los
  puestos que quien edita puede otorgar. Uno mismo cambia nombre, PIN, teléfono y color, nunca su
  puesto ni su baja. A otro se le edita si se puede otorgar su puesto actual (y el nuevo, si cambia).
  Las sesiones se cierran sólo si cambió el puesto o se dio de baja: renombrar no saca a nadie. El PIN
  se cambia desde la pantalla con `identidad.guardar_empleado`, que lo hashea en el servidor (probado:
  entra con el nuevo, el viejo ya no sirve). Las pestañas Caja y Descuentos son sólo del dueño y del
  administrador, con el puesto real.
- **Sin migración.** Lo hizo el agente RA (Sonnet).

## DP-D77 · Desactivar suelta las mesas; una mesa sin mesero la ven todos; «Repartir mesas» · 07-11-2026

- **Elección:** desactivar pide confirmación, con «Ver desactivados» y «Reactivar». Al desactivar a
  un mesero (o cambiarle el puesto), sus mesas quedan sin asignar en la misma transacción. Con la
  asignación activa, una mesa sin mesero asignado la ven todos los meseros: nunca queda invisible.
  «Repartir mesas» (`restaurante.repartir_mesas`, dueño, administrador y gerente) asigna varias mesas a
  un mesero de una vez, entero o nada, con su auditoría. El mesero sin mesas lee «Pide al dueño o al
  gerente que te asigne mesas».
- **Límite:** una mesa asignada a un mesero que se desactivó ANTES de este cambio seguiría oculta. En
  producción hoy no hay ninguna (10 mesas, todas con un mesero activo, medido el 07-11).
- **La mesera entra a la zona de SUS mesas:** con la asignación encendida ve también las mesas sin
  mesero, así que si éstas estaban en «Interior» y las suyas en «Barra», entraba a «Interior» y la suya
  no se veía (lo encontró la jornada completa de la CI). Ahora entra, una vez, a la zona de las suyas
  (`zonaDeSusMesas`); las demás quedan en sus pestañas. Si llegó a unir desde una mesa, manda la zona
  de esa mesa.
- **Sin migración.** Lo hizo el agente RA (Sonnet).

## DP-D78 · El PIN dice hasta cuánto autoriza; quien autoriza cancela con su propio PIN · 07-11-2026

- **El descuento:** `/api/identidad/supervisor` devuelve además el tope de quien tecleó su PIN (por
  porcentaje y por monto, con la misma regla que `topeDe`). El diálogo dice «Autoriza hasta 30 %» y no
  deja aplicar más; si el servidor rechaza por tope, por autorización vencida o ya usada, la borra y
  pide el PIN otra vez; un solo envío en vuelo (contra el doble toque); y si la cuenta ya tenía un
  descuento, dice «Reemplaza el descuento de $X».
- **Cancelar con la cocina sin respuesta, siendo gerente o dueño:** teclea SU PIN (como en los
  descuentos, DP-D61) y cancela; no necesita a otro. La autorización «para uno mismo» vale ahora
  también para `cancelacion`, con el mismo puesto exigido, el PIN real y el mismo bloqueo por intentos.
- **Dónde se exige ese PIN:** en la PANTALLA (el diálogo no deja confirmar sin él), no en el servidor.
  La sesión de un gerente o del dueño ya autoriza cancelar, también sin poder comprobar la cocina
  (`cancelar-sin-comprobar-la-cocina.integracion.test.ts`, «la gerente con su sesión no teclea PIN»),
  y así queda: es el mismo criterio de reabrir una cuenta. El PIN en la pantalla es el freno contra la
  tableta que alguien dejó con la sesión abierta; quien llame a la ruta a mano necesita esa sesión de
  todos modos. Lo señaló la revisión del PR; si Miguel quiere que el servidor también lo exija, es un
  cambio de una línea en `cancelar-con-permiso.ts` y la prueba de arriba cambia de sentido.
- **Sin migración.** Lo hizo el agente RB (Sonnet).

## DP-D79 · El carrito caducado se resuelve también en el mapa, y su aviso es de quien lo tenía · 07-11-2026

- **Elección:** el globo «Pedido listo para confirmar» de un carrito caducado se resuelve también al
  leer el mapa del mesero (los avisos por el puente), con la misma regla (`carritoCaducado`), cada mesa
  en su transacción y con el candado del carrito; un fallo ahí se registra y no tumba la lectura. «Tu
  pedido se borró porque pasaron 3 horas sin enviarse» lo ven sólo los teléfonos que tenían algo en
  ese carrito, nunca la familia nueva que se sienta después.
- **Lo que cuesta el sondeo:** cada mesero lee el mapa cada pocos segundos. Sólo entran a la
  transacción con candado las mesas cuyo carrito PUDO caducar (con líneas y la última de hace más de
  3 horas: una consulta con el índice `carrito_mesa_lineas_por_mesa`); las demás no abren transacción
  ni esperan el candado de un comensal que está agregando. Sin esto, una corrida de navegador con
  tres aparatos sondeando dio lecturas abandonadas y tiempos agotados.
- **Sin migración.** Lo hizo el agente RB (Sonnet); el candado, el aislamiento del fallo y el
  prefiltro, la sesión principal.

## DP-D80 · Los menores de la auditoría del 7-11: el corte, la auditoría, `autorizar_descuento`, el margen y los topes · 07-11-2026

- **Los descuentos del corte:** la parte de una cuenta dividida sale con la mesa de su madre (no «sin
  mesa»); el folio con su serie («A-12»); y la cuenta y la suma salen de SQL sobre TODOS los descuentos
  del corte, no de la lista. La lista sigue con su tope (es el freno de una lectura sin página), y si
  se cortó, el papel lo dice: «Sólo se muestran X de N descuentos; el total del corte los incluye a
  todos.».
- **La auditoría sin la autorización firmada:** `saneado.ts` tapa la clave `autorizacion` cuando es la
  autorización firmada del supervisor (forma `cuerpo.firma`, con punto y de más de 64 caracteres): es
  una credencial de dos minutos. NO tapa el nonce de un solo uso que la misma clave guarda en la
  auditoría de los comandos que la gastan (corto y sin punto): es el registro de que se gastó, y
  `gastarLaAutorizacion` lo busca ahí; taparlo reabriría el segundo uso. Un valor que no es texto se
  tapa.
- **`venta.autorizar_descuento` retirado, y su ruta:** escribía autorizaciones que nadie aplicaba
  (DP-D61); la autorización es el PIN firmado para ESA cuenta (`/api/identidad/supervisor`), que gasta
  el comando que aplica el descuento.
- **El margen sin lo anulado:** `leerMargen` ya no suma los platillos anulados aparte (`anulada_en`):
  conservan su importe en la línea, pero la cuenta no los cobra.
- **Configuración → Descuentos con los topes reales:** `venta.topes_de_los_puestos` (dueño y
  administrador) dice lo que el servidor aplica a cada puesto que autoriza (la fila del negocio o la
  del sistema), en porcentaje y en pesos, lo que llegue primero; ya no «gerente 30 %, administrador
  50 %, dueño 100 %» escrito a mano.
- **Lo que encontró el QA final (QA-2), arreglado:** «Quitar un platillo» dice el peso con el
  formateador único («Barbacoa de horno · ¼ kg», no «0.25 ×»), y al releer la cuenta tras un
  descuento se conserva la propina que el cajero ya eligió en la caja (el porcentaje, sobre el total
  nuevo), en vez de volver a pedirla. La mesa que queda en limpieza tras cobrar las partes y que el
  cierre pide libre es el diseño (DP-D66, «Marcar libre» de DP-14.6).
- **Sin migración.** El corte, el saneado, el margen y el retiro los hizo el agente RB (Sonnet); los
  topes en la pantalla, el aviso en el papel, los arreglos del QA y los documentos, la sesión principal.

## DP-D81 · La base propia, igual que la compartida: almacén por la API de Supabase y sin migración de permisos · 08-11-2026

- **El almacén:** en la base propia, `STORAGE_ENDPOINT` termina en `/storage/v1` (el conductor de la
  API de Supabase de `archivos.ts`), `STORAGE_ACCESS_KEY` es la referencia del proyecto y
  `STORAGE_SECRET_KEY` su llave secreta nueva (`sb_secret_…`), como en la Fase A. **Alternativa
  descartada:** el endpoint S3 con llaves de acceso S3, que sólo se crean en el panel (un clic más de
  Miguel) y cambiarían de conductor el día de la mudanza. El bucket `pos-don-poncho` es privado; se
  comprobó guardar, leer y borrar, y que la lectura pública falla.
- **RLS y permisos:** no hizo falta la migración de la base propia que preveía la guía. Las
  migraciones de siempre, aplicadas desde cero en un proyecto nuevo, ya dejan las 139 tablas con RLS
  y quitan a `anon` y `authenticated` todo permiso en tablas, rutinas y secuencias, y también los
  privilegios por omisión de `postgres`. Medido con la consulta de la guía: 139 de 139 y 0, 0, 0.
- **El rol de la app** (`morphiqpos_app`) se crea antes de migrar, con su verificador SCRAM, porque
  las migraciones sólo le dan permisos si ya existe. Queda igual que en la compartida (176 permisos de
  tabla, 1 secuencia, 2 de 16 rutinas).
- **Sin migración.** La mudanza y su regreso atrás están en `docs/infra/MUDANZA-FASE-B.md`.

## DP-D82 · Los PIN nuevos se generan al azar y se aplican por el comando, antes de cambiar Vercel · 08-11-2026

- **Elección:** en la base propia, recién importada y antes de cambiar Vercel, todos los PIN se
  cambian por `identidad.establecer_pin` (y «Caja 2» se da de alta con `identidad.guardar_empleado`),
  con «Miguel · Morphiq» como quien manda: transacción, idempotencia, roles y auditoría, como desde la
  pantalla. Nunca un hash escrito a mano. Los PIN viven sólo en `..\_PRIVADO\PINES-DON-PONCHO.md`.
- **Cuatro cifras:** el servidor acepta de 4 a 8, pero el teclado de la entrada envía al cuarto
  dígito; un PIN más largo no se podría teclear.
- **Al azar y lejos de lo conocido:** ninguno coincide con un número de 4 cifras de otro archivo de
  `_PRIVADO` (los PIN viejos, los de las copias de QA y los de la demo) ni es fácil de adivinar
  (repetidos, escaleras, años).
- **Por qué antes de cambiar Vercel:** así el humo de producción entra con los PIN nuevos y el PIN
  público del maestro nunca sirve contra la base propia. El regreso atrás devuelve la compartida con
  sus PIN viejos.
- **Cambia una regla de antes:** «los PIN reales los teclea Miguel». Este encargo pidió generarlos y
  aplicarlos; Miguel los recibe en `_PRIVADO` y cada persona puede cambiar el suyo desde Usuarios.
- **Sin migración.**

## DP-D83 · El platillo agotado del día: una fecha de vencimiento en el producto (migración 189) · 08-11-2026

- **Elección:** `productos.agotado_hasta` (`timestamptz`, migración 189, aditiva). El comando
  `catalogo.marcar_agotado` lo pone al fin del día del negocio (`diaDelNegocio`) o lo quita; al día
  siguiente el platillo vuelve solo. El servidor lo niega (`PRODUCTO_AGOTADO`) en el pedido del mesero,
  el carrito y el envío del portal, el pedido directo del portal y el mostrador; el menú público
  declara el campo `agotado` y el mesero y el portal lo enseñan apagado («Agotado hoy»).
- **Quién:** dueño, administrador, gerente y **cocina**, que es quien sabe que se acabó la carne. Desde
  Cocina → «Agotados» y desde Productos.
- **Alternativas descartadas:** reusar `activo` o `visible_en_pos`, que son decisiones de catálogo, no
  vuelven solas y el portal no respetaba; un booleano «agotado», que alguien tendría que apagar al día
  siguiente.
- **Migración:** la 189, aplicada a la base propia con `pnpm db:migrate` antes de desplegar (lo aditivo
  primero). Ficha 35.

## DP-D84 · El efectivo de la cajera, en Caja → Movimientos; la compra en efectivo con dos cajas, como retiro · 08-11-2026

- **Elección:** la cajera registra desde `/caja` → «Movimientos» el retiro, la entrada de cambio y el
  corte de turno, cada uno con su motivo; el gasto y la devolución quedan para la gerencia. La entrada
  de cambio estrena formulario (`EntradaDeCambio.tsx`).
- **La compra en efectivo con dos cajas abiertas** (A2-M5): el gerente no puede registrarla (no se sabe
  de qué cajón sale) y la cajera no tiene permiso de compras. El día 1, el pago a un proveedor en
  efectivo lo registra la cajera como **Retiro** con su motivo (y el corte lo resta); la compra como
  inventario va con tarjeta, transferencia o con una sola caja abierta.
- **Alternativas descartadas:** darle compras a la cajera (le abre inventario y proveedores) o elegir el
  cajón dentro de la compra (comando y pantalla nuevos a seis días de instalar). Queda como mejora.
- **Sin migración.**

## DP-D85 · Con dos cajas, cada cajón se cuenta en su aparato; el Tablero suma el día de todas · 08-11-2026

- **El Cierre del día** con otra caja abierta lo dice y cierra sólo la de ese aparato: cada cajón se
  cuenta donde está. El Cierre se hace con la última.
- **«Ventas hoy» del Tablero:** las ventas del día del negocio de todas las cajas, leídas por rango en la
  base. Antes contaba una caja y daba $0 con las cajas cerradas.
- **Configuración → Caja** lista sólo las terminales que alguna vez abrieron una sesión de caja: cada
  navegador que entra se da de alta como terminal (el teléfono del mesero, la tableta de cocina) y la
  lista para nombrarlas se llenaba.
- **Sin migración.**

## DP-D86 · Cada puesto ve lo que el servidor le deja; lo que se perdía al recargar se guarda en el aparato · 08-11-2026

- **La gerente** no ve Datos ni Integraciones (ni en la pantalla ni por el puente) ni la apariencia del
  negocio; el almacén no ve en Compras botones que el servidor le niega; Registros → «Auditoría»
  (`reportes.auditoria_reciente`) es sólo para dueño y administrador.
- **El pedido a medias del mesero** se guarda en el aparato (`localStorage`), por cuenta y persona, 3
  horas, y se recupera al volver a abrir la mesa. Son platillos y notas, no datos sensibles; lo enviado
  ya vive en el servidor. **Alternativa descartada:** borradores en el servidor (tabla y comandos
  nuevos).
- **El ticket por el navegador** en 58 u 80 mm: «Ancho del papel del ticket» en
  `configuracion.valores`, para el ticket, la reimpresión y la precuenta; el corte y el cierre siguen en
  A4 (sus tablas no caben en 58 mm). Las exportaciones van en la hora del negocio.
- **La capacidad:** el portal del comensal sondea su estado completo cada 12 s y al volver a la pantalla
  (antes 4 s con el menú entero), el ajuste más barato de `docs/infra/CAPACIDAD.md`.
- **Sin migración.**

## DP-D87 · Al cobrar, lo listo se entrega y lo pendiente se queda marcado; la mesa espera sólo lo que falta · 08-11-2026

- **La mesa con varias estaciones:** al pasar una comanda a «listo», la mesa sólo cuenta las comandas
  que faltan por terminar (`nuevo`, `en_preparacion`); las otras `listo` ya esperan al mesero. Antes la
  última estación en terminar veía a las demás como activas y la mesa nunca llegaba a «Esperando
  entrega».
- **Al cobrar:** lo que la cocina ya tenía «listo» de esa cuenta pasa a entregado, renglón por renglón
  (en una cuenta dividida, cada parte entrega lo suyo), y sale de la pantalla de su estación.
- **Lo que sigue por preparar no se cierra:** puede ser comida que sí se sirve (una cuenta pagada por
  adelantado, el postre). La tarjeta de la estación dice «Cuenta cobrada» y la cocina decide.
  **Alternativa descartada:** cancelarlo al cobrar, que escondería platillos por servir.
- **Lo quitado:** quitar el único platillo de una comanda la cancela; si le quedan otros, la pantalla ya
  no pinta el quitado.
- **Al quitar lo último que faltaba** (la revisión de código): la comanda vacía se cancela y la mesa
  se mueve con lo que quede de la cuenta dueña de las comandas (en una cuenta dividida, la madre): si
  sólo quedan comandas listas, a «Esperando entrega»; si no queda nada, a «Ocupada».
- **Sin migración.**

## DP-D88 · La prueba del puro link en producción, sin PIN reales y sin cuentas · 08-11-2026

- **Elección:** en producción se prueba todo lo que no pide un PIN: la entrada del personal (200, la
  lista de personas, sin desbordes) en Android 360 y 412, iPhone, tableta 768 y 1024 y PC; ocho
  aparatos a la vez detrás de la misma IP; el portal QR de una mesa con su token de siempre; la red
  lenta (3G simulada); el manifiesto, sus íconos y las etiquetas del iPhone. Sólo lectura: abrir el
  portal deja el «latido» del teléfono (presencia), no cuentas ni folios.
- **Lo que pide un PIN** (entrar a cada puesto, sesiones independientes, cambiar de persona) se probó
  en las copias de la base propia con PIN de prueba, con el mismo código; en producción lo comprueba
  Miguel con sus PIN en 10 minutos (`docs/ENTREGA-DON-PONCHO.md`). Los PIN reales no los teclea un
  agente.
- **Por qué no una cuenta de prueba en producción:** existe el guion probado de DP-12.1
  (`limpiar-ventas-de-prueba.mjs`, una cuenta sin cobrar y sin caja), pero abrirla exige entrar con un
  PIN real; queda para Miguel si hiciera falta.
- **Sin migración.**

## DP-D89 · La entrada de cambio: sólo su movimiento, referencia «manual», la sesión intacta · 08-11-2026

- **Lo que se encontró:** la entrada de cambio (heredada de MorphiqPOS, F-984-bis) nunca se pudo
  guardar contra el esquema real: su movimiento llevaba `referencia_tipo = 'entrada_cambio'`, que
  `movimientos_caja_referencia_tipo_check` no admite, y sumaba la entrada al desglose del fondo de
  apertura, que `sesion_fondo_desglosado_cuadra` exige que cuadre con el fondo inicial. Sus pruebas eran
  con una base falsa. Salió al probarla contra Postgres real por un hallazgo de la revisión de código
  (leer, sumar y escribir sin candado).
- **Elección:** el movimiento va con `referencia_tipo = 'manual'`, como el retiro, y es lo ÚNICO que
  escribe: el efectivo que el corte espera sale de los movimientos del cajón (`arqueoDeSesion`), así
  que la entrada ya lo sube. La sesión no se toca: su fondo esperado es el de la APERTURA (lo que se
  dejó anoche), que el papel del corte compara con lo contado al abrir, y su desglose es el de la
  apertura. Primero se intentó sumarle la entrada al fondo esperado en una sola escritura; el QA de
  la jornada (J-H7) vio que el papel enseñaba entonces «Fondo esperado apertura $1,700» contra $1,500
  contados, y la hoja del corte dejó de restar las entradas. Sin escritura en la sesión desaparece
  también la carrera de dos entradas a la vez.
- **Alternativa descartada:** una migración que agregue `entrada_cambio` a los tipos de referencia, o
  que relaje el desglose: cambiaría el esquema por algo que el código resuelve sin perder nada.
- **Lo que se ganó:** lo que toca la base en la caja de la cajera (retiro y entrada) se prueba ahora
  contra Postgres real.
- **Sin migración.**

## DP-D90 · Lo que encontró el QA de DP-15, arreglado antes de desplegar · 08-11-2026

- **El nombre de un aparato dormido queda libre** (J-H1): cada navegador que entra se da de alta
  como «Caja N» y producción tiene 25 con esos nombres. `caja.nombrar_terminal` le pone «Aparato …» al
  aparato que nunca abrió caja y tiene el nombre pedido, y lo deja en la auditoría (`liberado`); el
  nombre de una caja de verdad se sigue rechazando. **Alternativa descartada:** desactivar o borrar
  los aparatos dormidos en producción (una escritura de datos el día de la entrega, y un aparato que
  vuelve a entrar se daría de alta otra vez).
- **Lo que se termina de una cuenta ya cobrada se entrega solo** (J-H3): al marcar «listo», los
  renglones de una cuenta pagada pasan a entregado. Antes de cobrar, «listo» sigue esperando al
  mesero.
- **La precuenta del mesero se cuenta antes de imprimirse** (J-H4), con el rollo del negocio; si el
  servidor no la cuenta, no se imprime.
- **El Cierre del día dice el día** (J-H6): `caja.ventas_del_dia` (lectura) suma las cajas que
  cerraron en la ventana del Cierre (la misma de sus cancelaciones), con la regla de venta y los pagos
  de cada corte; el Cierre la pinta aparte y su resumen dice «de esta caja». DP-D50 no cambia: cada
  corte sigue contando sus cuentas.
- **El ticket ya no sale cortado** (H-01, bloqueante): `translate: var(--sin-traslado, none)` en el
  aislado de impresión, porque el minificador del build fundía `translate: none` dentro de
  `transform`; una prueba pasa el `index.css` real por el mismo minificador.
- **Menores:** «Agotado hoy» en el menú del portal en lista; la etiqueta
  `apple-mobile-web-app-capable`.
- **Sin migración.**


## DP-D91 · Las alertas del limitador eran un `SET` de sesión por el pooler de transacción · 08/09-11-2026

- **Lo que se vio:** tras la mudanza, en producción, el limitador avisó «No se pudo contar el intento
  de …» y el carrito del portal devolvió 500 de vez en cuando (13:50 del 08-11, durante la prueba del
  link, y en una sonda posterior: 2 de 16 lecturas). Nunca en local ni antes de la mudanza. La causa
  no quedaba en el log: el `catch` del limitador la tragaba.
- **Primero, la causa en el log:** las alertas del limitador y los fallos del portal llevan la clase
  del error y su código (`claseDelFallo`, sin datos de entrada). Con eso desplegado, la prueba del
  link del 09-11 (04:24) dio `DatabaseError sqlstate=25006`: **transacción de sólo lectura**.
- **La causa:** mis propios guiones de verificación (el link, la sonda, el estado de producción),
  que leían la base propia por la `DATABASE_URL` de producción, el **pooler de transacción**
  (Supavisor, 6543), y empezaban con `set default_transaction_read_only = on`. En el pooler de
  transacción un `SET` de sesión se queda en la conexión del servidor, y la siguiente petición de la
  app que caía en ella heredaba el sólo lectura: el `insert` del limitador y del carrito fallaban.
  Las horas cuadran al minuto, y se quitaba solo porque Supavisor cierra las conexiones ociosas.
  No era la app.
- **Elección:**
  1. Los guiones de lectura van con `begin read only … commit` (la transacción, no la sesión), como
     ya hacían los del repo (`huella-ajena`, `exportar-negocio`, `importar-negocio`). Nunca un `SET`
     de sesión por el pooler de transacción. Con los guiones corregidos, la misma prueba del link
     (04:30) dio **cero alertas**.
  2. **La base compartida no se tocó:** todas esas corridas fueron contra la base propia, y los
     guiones del repo que leen la compartida ya usaban la transacción.
  3. Se queda `attachDatabasePool(pool)` de `@vercel/functions` (3.10.0, fija), la recomendación de
     Vercel para `pg` en Fluid compute (cierra las conexiones ociosas antes de que la función se
     suspenda). No era la causa, pero es lo correcto y fuera de Vercel no hace nada.
- **La dependencia nueva** trae, por `@vercel/oidc` > `@vercel/cli-config`, un `zod` < 4.6.6
  (GHSA-mrhx-c7xc-m3w5): un `override` de pnpm lo sube a 4.6.7, la del resto del repo, y
  `pnpm audit --audit-level high --prod` queda limpio.
- **Alternativas descartadas:** cambiar al pooler de sesión (5432), porque el de Micro admite pocos
  clientes (ya tumbó pruebas con `EMAXCONNSESSION`); y que la app abra cada transacción con
  `read write` explícito, porque el riesgo está en los guiones del operador, no en la app, y las
  sentencias sueltas seguirían fallando. La regla queda en la ficha 35. *(Revisado en DP-D92: la app sí
  pide `read write` explícito, y sus escrituras sueltas pasan a una transacción.)*
- **Sin migración.**

## DP-D92 · El `25006` en producción: la causa confirmada, la app blindada y los guiones fuera del pooler · 09-11-2026

- **Lo que pidió la auditoría del 09-11** (`main@cd76829`): Vercel registró 30 errores
  `sqlstate=25006` (`read_only_sql_transaction`) el 08-11 a las 13:50 y 17:24 y el 09-11 a las 04:25
  (CDMX): el limitador en `/api/auth/empleados` y en el portal, y `publico.qr.carrito` (un comensal
  habría visto un error). La base, sana: sin recuperación, sin `default_transaction_read_only`, sin
  «idle in transaction» y sin configuración en el rol de la app.
- **La causa, confirmada contra el registro de la sesión:** cada hora tiene una corrida de un guion
  de revisión por la `DATABASE_URL` de producción (el pooler de transacción, 6543) que empezaba con
  `set default_transaction_read_only = on`, un `SET` **de sesión**, sin transacción:
  13:48–13:50 `link.mjs`; 17:23 `permisos-de-tablas.mjs` y 17:24 `sonda-reposo.mjs`; 04:24–04:25
  `link.mjs`. No fue un `begin … read only` sin `rollback` (la sospecha de la auditoría): esos
  guiones no abrían transacción, y los del repo que sí la abren (`exportar-negocio`, `huella-ajena`)
  la cerraban y, contra la propia, corrieron por la conexión de sesión (5432; 11:10 y 13:10). El
  `SET` se quedaba en la conexión del servidor y la siguiente escritura de la app que caía en ella
  moría, hasta que Supavisor la cerraba por ociosa. Ninguna de esas corridas tocó la compartida.
- **Elección (las tres capas):**
  1. **La app.** `conTransaccion` abre `read write` explícito (`setAccessMode('read write')`), así
     que lo que traiga la conexión ya no decide. Las escrituras que iban sueltas sobre `obtenerDb()`
     pasan a `conTransaccion`: el limitador (contar, devolver y purgar), cerrar sesión y la cuota de
     archivos. Pruebas: `solo-lectura-heredada.integracion.test.ts` abre el pool con
     `default_transaction_read_only = on` en todas sus conexiones (el peor caso): una escritura
     suelta falla con `25006` (la precondición), y `conTransaccion` y el limitador escriben; estaba en
     rojo antes del arreglo. `escrituras-en-transaccion.contrato.test.ts` impide volver a escribir
     suelto. El carrito del portal ya iba por `conTransaccion` (`comando-publico.ts`).
  2. **Los guiones.** `scripts/lib/lectura-segura.mjs`: `exigirConexionDirecta` rechaza una cadena
     del 6543 y `leerEnSoloLectura` abre `read only` y cierra con `rollback` en un `finally`, pase lo
     que pase. Los usan `exportar-negocio` y `huella-ajena`; `importar-negocio` exige la conexión
     directa o de sesión. Los guiones de revisión de la sesión (el link, el estado de producción)
     van igual; las dos sondas y el modo que leía por el pooler, retirados.
  3. **La regla**, en `docs/RUNBOOK.md` y en la entrega: ninguna revisión contra producción por el
     pooler de transacción mientras el restaurante opera.
- **Revisa DP-D91:** allá se descartó el `read write` en la app «porque el riesgo está en los
  guiones». Sigue estando ahí, pero cuesta poco cerrarlo también del lado de la app: el limitador
  pasa de una ida y vuelta a tres (`begin`, la sentencia, `commit`), unos milisegundos en la misma
  región, y el modo de fallo desaparece venga de donde venga.
- **Sin migración.**

## DP-D93 · Lo que el servidor le acepta a la cajera en `caja.movimiento`, y el ajuste con rastro · 09-11-2026

- **Lo que vio la auditoría:** `caja.movimiento` dejaba a cualquier rol de caja registrar `gasto`,
  `deposito` y `ajuste`. El ajuste cambia lo que el corte espera sin que pase dinero: en manos de quien
  cuenta el cajón, es la forma de tapar su propio faltante.
- **Elección:**
  1. **El servidor** (`packages/app/src/caja/sesion.ts`, `puedeRegistrarMovimiento`): la cajera sólo
     registra `retiro`; `gasto`, `deposito` y `ajuste` son de gerente, administrador y dueño
     (`MOVIMIENTO_NO_PERMITIDO`, antes de mirar si hay caja abierta). La entrada de cambio es otro
     comando y sigue siendo suya. La pantalla ya no le ofrecía nada de eso.
  2. **El ajuste deja rastro en el corte:** `caja.hoja_del_corte` trae cada ajuste (monto, motivo,
     quién y hora); el documento del corte tiene «Ajustes de caja · quién y por qué» con su total, y el
     arqueo muestra la celda «Ajustes de caja» antes del efectivo esperado. Un ajuste sin motivo (uno
     viejo) sale como «SIN MOTIVO».
  3. **El motivo se recorta antes de medirlo** («   » no es motivo): 3 letras para todos, **5 para el
     retiro** (`LARGO_MINIMO_DEL_MOTIVO_DE_RETIRO` en `packages/contracts`, que leen servidor y
     pantalla). «gas» o «.» no dicen a dónde fue el dinero; cinco piden «hielo» o «al banco».
  4. **El importe con coma de miles:** «1,500» es 1500 y «1,500.50» es 1500.50
     (`apps/web/src/venta/importe-tecleado.ts`). La coma deja de ser decimal: «1,5» o «12,50» se
     rechazan con un mensaje que dice cómo escribirlo (antes «12,50» se leía 12.50; en México la coma
     es de miles y el cruce era el peligro: «1,500» se leía 1.5).
- **Pruebas:** `movimiento.test.ts`, `importe-tecleado.test.ts`, `corte.test.ts` y la integración
  `ajustes-del-corte.integracion.test.ts`, en rojo antes del arreglo; mutantes muertos (DP-15.1).
- **Sin migración.**

## DP-D94 · El mesero cambia de mesa desde su pantalla, y su pedido sobrevive a un agotado · 09-11-2026

- **Cambiar de mesa:** el servidor ya dejaba al mesero (`restaurante.cambiar_mesa`: «es una decisión
  de sala», no mueve dinero); el enlace del panel de la mesa era sólo para dirección. Ahora
  (`apps/web/src/restaurante/puede-mover-la-cuenta.ts`) dirección lo ve siempre, y el mesero **en la
  mesa que él atiende**, con el texto «Cambiar de mesa». Dividir sigue en Caja y dirección (el
  servidor se lo niega al mesero y «Mesa activa» no se lo ofrece); unir, arrastrando.
  - **Lo que no se cambió:** el servidor deja al mesero mover cualquier cuenta viva, no sólo las
    suyas. Se queda así a propósito: en un salón chico los meseros se cubren, y el movimiento queda
    en la auditoría. «Sus mesas» es regla de la pantalla.
- **El pedido a medias y el agotado** (`apartar-agotados.ts`, `Mesero.jsx`): si el servidor rechaza el
  envío con `PRODUCTO_AGOTADO`, la pantalla relee el menú, aparta los renglones que ahora salen
  agotados, avisa («X se agotó, lo quitamos del pedido») y manda el resto **una vez**, con su propia
  clave de idempotencia (es otro pedido). En el cliente porque el error del servidor no nombra los
  platillos y cambiarlo tocaría a todos los clientes; si el menú releído no muestra nada agotado, se
  muestra el error tal cual.
- **Los borradores viejos** (`borrador-del-pedido.ts`): al leer, el de otra cuenta, el vencido y el mal
  formado se borran; y al cargar las mesas se barren los de cuentas que ya no están sobre ninguna mesa
  (cobradas o cerradas en otro aparato), respetando lo guardado hace menos de 2 minutos y sin barrer
  nunca si no se leyeron mesas.
- **Sin migración.**

## DP-D95 · Registros → «Auditoría»: el filtro en el servidor, por día y con páginas · 09-11-2026

- **Lo que vio la auditoría:** la consulta traía las últimas N y la pantalla filtraba en el navegador:
  un cambio de PIN de la mañana no se encontraba en la noche porque ya no estaba entre las N.
- **Elección:**
  1. `reportes.auditoria_reciente` recibe `{ grupo?, fecha?, pagina }` (zod; el día tiene que existir)
     y filtra en la consulta: por **grupo de acción** (siete, con los nombres reales del catálogo en
     `packages/domain/src/auditoria/grupos.ts`: PIN y usuarios, agotado, cajas, descuentos,
     cancelaciones, movimientos de efectivo, configuración; un contrato comprueba que cada acción
     existe y escribe), por **día del negocio** (`limitesDeLaFecha` con la zona del negocio, como
     `diaDelNegocio`) y con **páginas de 50** (más reciente primero, desempate por id; un renglón de más
     dice si hay siguiente). Quién la ve no cambia.
  2. La pantalla manda los filtros y pagina (grupo, día con «Hoy», Anterior/Siguiente); no filtra
     nada en el navegador. Cada acción con su frase (`describir-accion.ts`); lo desconocido, por su
     familia o «Otro cambio registrado», nunca el nombre del comando.
  3. **Lo negado se marca:** la auditoría también guarda los intentos que el servidor rechazó
     (`resultado` denegado, conflicto o error) y se leían como hechos («Cambió el PIN…»). Ahora dicen
     «Intento rechazado (sin permiso): …».
- **Pruebas:** la integración encuentra el PIN de la mañana entre 320 renglones más nuevos, cuenta el
  día en CDMX (23:30 local es ese día aunque en UTC ya sea el siguiente) y pagina 50/50/20 sin repetir
  ni saltar. Mutantes muertos, salvo uno equivalente (quitar `.strict()`: el envoltorio de comandos ya
  valida en estricto).
- **Sin migración.**

## DP-D96 · Las zonas se desactivan, y el «hoy» del Tablero es el día del negocio · 09-11-2026

- **Zonas** (`restaurante.fijar_zona_activa`, `packages/app/src/restaurante/zona-activa.ts`; dueño,
  administrador y gerente): **desactivar** se niega si una mesa activa de la zona está ocupada, en
  limpieza, con cuenta o unida (el error dice cuáles); si todas están libres, se apagan con la zona
  (salen del plano y el portal las rechaza). **Reactivar** devuelve exactamente las que se apagaron con
  ella (las lee del rastro de esa desactivación: una mesa dada de baja antes no resucita) y no
  reactiva a medias si el nombre o un número de mesa ya los usa otra activa. Sin migración:
  `zonas.activa` y `mesas.activa` ya existían. En la pantalla, «Desactivar» por zona y la sección
  «Desactivadas» con «Reactivar».
- **El Tablero** (`apps/web/src/tablero/dia-del-negocio.ts`, `use-inicio-del-dia.ts`): «hoy» es el día
  del negocio en CDMX (no la fecha UTC ni la del aparato a ciegas), se recalcula a la medianoche y al
  volver a la pantalla, sin recargar. Si la lista del día llega al tope de 1000 ventas, la pantalla lo
  dice («los totales pueden estar incompletos»). Supone días de 24 h, cierto para CDMX desde 2022.
- **Sin migración.**

## DP-D97 · Lo listo de una cuenta cobrada antes de servir: se queda como está, sin confirmar · 09-11-2026

- **La propuesta de la auditoría:** si el restaurante **cobra antes de servir** (p. ej. barbacoa para
  llevar), lo listo de una cuenta cobrada no se da por entregado solo
  (`restaurante/comandas-al-cobrar.ts`, `cobrar.ts`): se quedaría en «Listos» con «Cuenta cobrada» y
  un botón «Entregado» para la estación y el mesero.
- **Elección:** depende de cómo opera Don Poncho y Miguel no lo ha confirmado. **Se queda como está**
  (DP-D87/DP-D90: al cobrar, lo listo sale solo de «Listos»; lo que seguía por preparar se queda con la
  marca «Cuenta cobrada»), y se le pregunta. Si lo confirma, es un cambio acotado de la pantalla de la
  estación y del mesero, cuidando no volver a atorar comandas como en J-H3.

## DP-D98 · El pedido para llevar se toma y se cobra en la Caja; su número es del día (migración 191) · 09/10-11-2026

- **La entrada:** en la Caja del restaurante, el botón grande «Para llevar» (cajera, gerente,
  administrador y dueño: los que entran a la Caja). Abre la toma de pedido del mesero sin mesa
  (`ParaLlevarDialog.jsx`): categorías y búsqueda (`CatalogoDelPedido.jsx`), opciones obligatorias,
  notas, barbacoa por peso, agotados y el borrador en el aparato (`useArmadoDelPedido.js`, por
  persona). El renglón que viaja al servidor sale de una sola pieza (`renglonParaElComando`).
- **El cobro:** «Cobrar» llama a `restaurante.armar_para_llevar`, que escribe el pedido como el
  borrador de ESA terminal (el carrito del mostrador, `canal = 'llevar'`, `nombre_pedido`), con el
  precio del catálogo, el agotado y la opción obligatoria del mesero; NO manda nada a cocina. La Caja
  abre su diálogo de cobro de siempre (métodos, descuento con PIN, propina, ticket). Las comandas
  salen en `venta.cobrar` (`comandarLineasPendientes`), dentro de su transacción. Si se cancela el
  cobro, `restaurante.descartar_para_llevar` vacía el borrador y la pantalla vuelve con el pedido.
  Volver a tocar «Cobrar» reemplaza las líneas del mismo borrador (no se duplican).
- **El número:** «Pedido para llevar N» empieza en 1 cada día del negocio (CDMX). Lo toma
  `venta.cobrar` después del folio y antes de la cocina (`asignarNumeroParaLlevar`), con un candado
  de transacción por negocio y el índice único `ordenes_numero_pedido_del_dia` como red. Un cobro
  revertido no gasta número; un reintento conserva el que tenía. **Migración 191**, aditiva:
  `ordenes.numero_pedido` y `ordenes.dia_del_pedido`. **Alternativa descartada:** derivar el
  número al leer (por orden de cobro): con dos cajas, el ticket impreso podía decir un número y la
  cocina otro.
- **El descuento con PIN** también aplica al pedido para llevar (`motivoParaNoDescontar` lo admite
  por su canal); la venta de `/pos` sigue sin él (DP-D75).
- **La cocina** dice «PARA LLEVAR · N · nombre» por el CANAL, no por la falta de mesa
  (`rotulo-de-la-comanda.ts`: la pantalla, las tarjetas heredadas, el teléfono de cocina y la voz,
  «para llevar 3»). El puente sirve `canal` y `numero_pedido` en la comanda y en la venta.
- **El ticket** lleva el renglón grande «PARA LLEVAR · N · nombre» (`PreCuentaTicket`, y
  `venta.ticket` trae `paraLlevar`).
- **Sin cambiar:** las mesas; `/pos` sigue fuera del menú.

## DP-D99 · Lo listo de un pedido para llevar espera en la Caja hasta «Entregado» · 10-11-2026

- **Responde DP-D97** (Miguel: sí se cobra antes de servir lo para llevar). Un pedido para llevar
  ya cobrado NO se entrega solo cuando la cocina lo marca listo: `entregarLoListoYaCobrado` excluye
  `canal = 'llevar'`. Las mesas no cambian (DP-D87, DP-D90, J-H3).
- **La Caja** lee `restaurante.para_llevar_del_dia` cada 4 s (`ParaLlevarDeHoy.tsx`): lo listo arriba,
  grande, con su botón «Entregado» a todo lo ancho (`restaurante.entregar_para_llevar`); cuando uno
  pasa a listo suena y avisa «Pedido para llevar N listo» una sola vez (lo que ya estaba listo al
  abrir la Caja no se anuncia). Si una estación terminó y otra no, dice «una parte lista, falta otra».
- **`entregar_para_llevar`** es aparte de `entregar_pedidos` (el de la mesa): no mueve mesas y sólo
  entrega lo listo; sin nada listo devuelve cero y no escribe.

## DP-D100 · Mesas y para llevar por separado; «Aquí» en lugar de «En taza» · 10-11-2026

- **El corte y el Cierre del día** (`corte/por-canal.ts`, y el visor heredado `CorteTicket.jsx`): con
  algún pedido para llevar, el resumen «Mesas y para llevar» (cuentas e importe, que suman el total
  al centavo) y el detalle de cada uno aparte; el pedido se reconoce por «Llevar N · nombre». Sin
  pedidos para llevar el documento queda como estaba.
- **Registros → Ventas** filtra por canal (Todas, Mesas, Para llevar) y la búsqueda encuentra el
  nombre del pedido; **el CSV** trae «Canal», «Pedido para llevar» y «Nombre del pedido».
- **Una sola regla** (`corte/canales.ts`): `llevar` es para llevar; todo lo demás, mesas. `aqui` se
  dice «Aquí» (venía de la cafetería).

## DP-D101 · El retiro de la cajera arriba de un monto pide el PIN de un gerente · 10-11-2026

- **Configuración → Caja:** «Pedir PIN de gerente en retiros mayores a $____»
  (`UmbralDeRetiro.tsx`). Vacío = no se pide (el valor por omisión). Se guarda en
  `configuracion.valores.retiro_pin_arriba_de_centavos` con `caja.fijar_umbral_de_retiro`, que sólo
  admite a dueño y administrador y deja antes y después en la auditoría.
- **El servidor lo exige** (`caja/retiro-con-pin.ts`, en `caja.movimiento` tipo `retiro`): si el
  monto es MAYOR que el umbral y quien registra es la cajera, pide la autorización firmada de
  `/api/identidad/supervisor` con `para: 'retiro'` y atada a ESE monto; se gasta una sola vez
  (`gastarLaAutorizacion`, que ahora también vigila `caja.movimiento`). Una autorización de
  descuento, de otro monto, vencida o ya usada se niega. Gerente, administrador y dueño no piden el
  PIN de otro en su propio retiro (la regla es para la cajera); no hay tope por puesto en retiros.
- **El corte** (`caja.hoja_del_corte` → «Retiros con PIN de gerente · quién autorizó»,
  `corte/retiros-con-pin.ts`): cada retiro autorizado con su monto, motivo, quién lo autorizó y la hora.
- **Sin migración.** Lo hizo el agente B (Sonnet); revisado e integrado por la sesión principal.

## DP-D102 · Los menores de la auditoría del 9-11 · 10-11-2026

- **Zonas:** `Zona.activo` deja de ser escribible por el puente (sólo `restaurante.fijar_zona_activa`);
  al reactivar, si no hay rastro de qué mesas volver o volvieron menos de las apagadas, el resultado
  lo avisa y la pantalla lo dice. Desactivar ya apagaba todas las mesas libres de la zona (prueba).
- **El agotado del mesero:** al apartar lo agotado pregunta «Se agotó X. ¿Envío lo demás?» (Enviar /
  No enviar); cerrar el aviso es «No enviar».
- **Cambio de mesa:** `restaurante.cambiar_mesa` acepta `mesaOrigenId`: si otro ya la movió, el error
  dice «ya se movió a la mesa N». Con mesas unidas no se ofrece «Cambiar de mesa».
- **Auditoría:** `auditoria-reciente.ts` vuelve a sanear al leer (`sanearAlLeer`), con correo y
  teléfono tapados.
- **El detector de escrituras sueltas** (DP-D92) ve también `const db = obtenerDb(); db.…`.
- **`consultarEn`** rechaza una cadena del puerto 6543 (`exigirQueNoSeaElPooler`): las
  verificaciones contra una base real van por la conexión de sesión (`MORPHIQPOS_DB_VERIFICACION`).
- **Sin migración.** Agente B.

## DP-D103 · Las ventanas crecen desde donde se tocó; «Marcar entregado», grande y completo · 10-11-2026

- **Una sola pieza** (`packages/ui/src/sistema/origen-de-ventana.ts` + `estilos/ventanas.css`): guarda el
  último toque (`pointerdown`, válido 1 s) y, al montar una ventana, le pone ese punto como
  `transform-origin` relativo a su caja. La ventana crece desde ahí con zoom suave y fundido (200 ms,
  0.9 → 1, curva ease-out exponencial); sin toque reciente (teclado, apertura programática) aparece al
  centro con 0.97 → 1. Los paneles laterales, 220 ms (antes 500). Con «reducir movimiento», sólo un
  fundido corto. Sólo `transform` y `opacity`. La usan los diálogos, alertas y paneles de
  `packages/ui` y los heredados (`dialog`, `alert-dialog`, `sheet`); ya no entran «de lado»
  (`slide-in-from-left-1/2`). El oyente se registra al cargar el módulo: en la prueba del navegador, la
  primera ventana de la página aparecía al centro porque el toque que la abría llegaba antes del oyente.
- **«Marcar entregado» del mesero** (`ListosParaRecoger.tsx`, `ListosParaRecogerCard.jsx`): la tarjeta
  ya no se encoge ni recorta (`shrink-0`, sin `overflow-hidden`), queda justo bajo la cabecera de la
  mesa, y el botón es grande, a todo lo ancho y de al menos 48 px; si falla, el motivo queda escrito en
  la tarjeta (`role="alert"`) además del aviso, y el botón vuelve a estar disponible.
- **Sin migración.** Lo hizo el agente A (Sonnet, 16 mutantes muertos); revisado, corregido el oyente e
  integrado por la sesión principal, con la prueba en el navegador.

## DP-D104 · Las opciones cobran: precio con signo, biblioteca de grupos y peso en presentaciones · 10-11-2026

- **El precio lo pone siempre el servidor.** Cada opción tiene un precio con signo
  (`modificador_opciones.delta_precio_centavos`; el viejo `precio_extra_centavos` sólo sumaba y queda
  como respaldo). Al escribir la línea (mesero, para llevar, portal, carrito compartido, `/pos`),
  `precioConLasOpciones` lo suma: **por pieza** en lo que va por pieza (2 tacos con queso = 2 × (taco +
  queso)) y **una vez por renglón** en lo que va por peso o por porción (½ kg de barbacoa con tortillas
  de harina = ½ kg + $20). Nunca baja de cero. Lo cobrado queda congelado en
  `orden_linea_modificadores.delta_precio_centavos` y en la instantánea de la línea con el precio de
  cada opción ese día; descuentos, propina, dividir (la parte copia sus opciones), cancelar, quitar y el
  margen trabajan sobre el total de la línea, que ya lo trae.
- **Los grupos son una biblioteca del negocio** (`catalogo.guardar_grupo_de_opciones`,
  `catalogo.asignar_grupos_de_opciones`, `catalogo.grupos_de_opciones`): nombre, una o varias,
  obligatorio, mínimo y máximo (sólo en varias), activo y sus opciones con precio; un grupo se reusa en
  varios productos, en el orden que el dueño le da en cada uno. Guardar con el editor viejo ya no vacía
  un grupo compartido. **En Productos → «Opciones»** (`src/catalogo/opciones/`) el dueño ordena los
  grupos del platillo, agrega uno de la biblioteca o crea uno nuevo, y edita nombre, «elige una» o
  «varias», obligatorio, mínimo y máximo, activo y cada opción con su precio en pesos con signo
  («15», «-5»); si el grupo lo usan otros productos, avisa que el cambio aplica a todos y pide
  confirmar. Sustituye al editor viejo por producto (`ModificadoresDialog`/`ModificadoresEditor`).
- **Dónde se ve:** el diálogo de opciones del mesero y de la Caja («Queso +$15.00», «Agregar · $…»),
  el portal (sólo si el negocio enseña precios en el portal, igual que el del platillo; con mínimo y
  máximo), el ticket y la precuenta (un renglón por grupo con su precio; la nota queda sólo con lo
  escrito a mano), el ticket de `/pos`, y el corte («Opciones vendidas · cuánto sumaron»: veces y
  cuánto sumó o restó cada una). La cocina las lee aparte de la nota (DP-D105).
- **Lo que va por peso:** se configura en Productos (unidad, cantidad libre con mínimo, máximo e
  incremento, sus presentaciones y precio por kilo) y, nuevo, **«Vender sólo en estas
  presentaciones»** (`productos.solo_presets_variable`): el mesero, la Caja y el comensal eligen ¼, ½ o
  1 kg y no se teclea otra cantidad; el servidor rechaza cualquier otra (`CANTIDAD_INVALIDA`). Lo que va
  por peso ya lleva opciones también en el portal.
- **Migración 192** (aditiva: mínimo y máximo del grupo, el precio con signo de la línea, «sólo
  presentaciones» y el fondo de la tarjeta del menú digital de la Parte 3), ficha 38.

