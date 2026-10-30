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

## DP-D31 · La estación de cocina sale de la sesión del servidor; el portal sigue la cadena del mesero · 27-10-2026

> DP-D29 y DP-D30 viven en la rama `fase-b` (pedido compartido y unir mesas desde el mapa).

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
  el mapa con su nota hasta que Miguel decida.
- Las recetas se cargan cuando hacen falta: Keycap y Thock traen su muestra (50 KB cada una); las
  demás pesan menos de 1 KB.

## DP-D41 · El lenguaje de capas: vidrio en lo que flota, `capas` y `aero`, «Retro» y el modo automático · 30-10-2026

- **Vive en el sistema, no en las pantallas.** Dos valores nuevos de la perilla `elevacion`:
  `capas` (sombras largas en tres capas teñidas con `--sombra-tinte`, vidrio ahumado en lo que
  flota, malla casi imperceptible en el fondo) y `aero` (el de «Retro»: marco de ventana, gel y
  resplandor). Los otros siete estilos no cambian de aspecto. Un estilo sigue siendo un archivo de
  tokens: `lenguaje.css` lee tokens y atributos y no nombra ningún estilo (una prueba lo exige).
- **Vidrio sólo en lo que flota:** `Superficie` nivel 3 y 4, diálogos, cajones, menús, avisos y lo
  que una pantalla marca `data-capa="flotante"` (el dock, la barra lateral). Nunca en una tarjeta
  de una lista ni en el velo de un diálogo. Cada desenfoque es `var(--filtro-vidrio)`.
- **Vidrio sólido** con «menos transparencia» del sistema o en el aparato que, medido una vez en
  reposo, no da 60 cuadros (mediana de 60 cuadros sobre 22 ms → `data-vidrio="solido"`, guardado
  en el aparato y aplicado por el guion de arranque). No se mide bajo un navegador automatizado:
  el retrato de una prueba no puede depender de la CPU.
- **Tacto, halo y presión, por atributo:** `data-tacto` (teclados de cobro y PIN, Cobrar,
  interruptores), `data-principal` y `data-activa` (el halo del acento, y un anillo de 2 px en lo
  elegido para que no dependa del brillo). La presión es `--escala-presion` (0.97; 1 sin
  movimiento) y lo que tiene tacto vuelve con la curva de resorte.
- **Estilos.** `morphiq` se rehace con la marca: negro azulado `#0A0E1A`, azul eléctrico `#1E5BFF`
  (el mismo en claro y oscuro, letra blanca 5.3:1) y acero como acento secundario. `don-poncho`
  conserva los colores del logo y estrena `capas`; sigue siendo el predeterminado. «Retro» (clave
  `retro`) es nuevo: Frutiger Aero inspirado, no copiado; sólo tokens, escritorio de CSS propio
  (sin `url()`), pila tipográfica de la época sin descargas, claro por omisión y vidrio ahumado en
  oscuro. Los diez, AA en claro y oscuro.
- **El contrato crece:** `sombra-tinte`, `luz-borde`, `halo` y `malla-1..3` son tokens de color
  obligatorios (antes un estilo podía olvidar `sombra-tinte` sin que nada fallara); los del vidrio,
  la presión y lo de «Retro» son tokens base con valor vacío por omisión.
- **Claro, oscuro o automático, por aparato** (Configuración → Apariencia): `mh_theme` guarda la
  preferencia (`light`, `dark`, o automático sin valor o con `auto`); el guion de arranque y el
  `ThemeContext` resuelven `prefers-color-scheme` y lo siguen en vivo. `.dark` y `data-modo` siguen
  siendo `claro`/`oscuro`. Un aparato sin nada elegido —todos hoy— pasa a seguir al sistema.
- **Producción:** el negocio guarda sus perillas (`configuracion.valores.apariencia`, sin
  migración) y Don Poncho se dio de alta con `elevacion: sombra` explícito. Para que estrene el
  lenguaje, al publicar se fija `capas` por el comando de apariencia, con huella antes y después.
