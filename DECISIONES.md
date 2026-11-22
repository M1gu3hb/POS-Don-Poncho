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

## DP-D105 · La cocina con volumen: sólo lo vivo, tarjetas compactas, la espera por colores · 10-11-2026

- **Se lee sólo lo vivo.** `/cocina` pide `PedidoPreparacion` con `estado: ['nuevo', 'en_preparacion',
  'listo']` (el puente acepta ya una lista de valores en un filtro, hasta 200, textos o números; vacía
  no trae nada) y las ventas sólo de las cuentas a la vista; la lectura de todas las mesas, que nadie
  usaba, se quitó. Medido con 19 comandas vivas y 1,140 entregadas de otros días: de 967 KB a 62 KB y
  de 310–340 ms a 25–35 ms por refresco (cada 2 s). Se descartó un comando de lectura nuevo: habría
  pedido catálogo y matriz sin ganar nada.
- **Las opciones, aparte de la nota.** El puente sirve en cada platillo sus `opciones` (de la
  instantánea de la línea, reducidas en el servidor a grupo y nombres: sin ids ni precios, para que lo
  que cobra una opción no llegue a la cocina) y la pantalla las pinta como fichas resaltadas; la nota
  va en su recuadro, ya sin el «Grupo: opción» que el mesero le pliega. Sin instantánea (comandas
  viejas), la nota sale entera.
- **La espera** cuenta desde `marchada_en` (`fecha_marchada`: cuando se soltó a cocina, no cuando se
  capturó) y se pinta verde, ámbar o roja con ícono y minutos escritos, nunca sólo color; en «Listos»
  no hay color. Los umbrales son del negocio (`cocina_alerta_ambar_min` y `cocina_alerta_roja_min`,
  10 y 20 por omisión, enteros de 1 a 240, el rojo después del ámbar), en Configuración → Negocio.
- **La pantalla** (`apps/web/src/cocina/`, que usa `Cocina.jsx`): tarjeta compacta por cuenta con un
  bloque por estación, las más viejas arriba (en «Listos», las que llevan más tiempo listas), la tira
  «Resumen de producción» (lo pendiente por platillo; lo que va por peso, por presentación: «Barbacoa
  de horno ½ kg ×6»), modo compacto recordado en el aparato y tres columnas con encabezado fijo y su
  propio desplazamiento desde 768 px (en teléfono, un selector con los conteos). Se quitó el aviso
  «Sin venta asociada»: su condición ya no ocurre.
- **Sin migración.** Lo hizo el agente C (Sonnet: 18 mutantes unitarios muertos, integración del
  filtro y de las opciones); revisado e integrado por la sesión principal.

## DP-D106 · El teléfono de cocina enseña todas las comandas activas · 10-11-2026

- **El servidor** (`telefono-de-cocina/consulta.ts`) devuelve, además de `comanda` y `pendientes`
  (para no romper un teléfono con la versión vieja abierta), `comandas`: todas las activas de la
  estación (nuevo y en preparación) con su desglose, de la más vieja a la más nueva, con tope de 40, en
  una sola lectura de renglones; y `mesas`: la tira por mesa o pedido con su estado, incluidas las
  listas sin entregar de las últimas 6 horas. Cada platillo trae sus opciones (grupo y nombres, sin
  precio) y del nombre del pedido sólo la primera palabra, como antes.
- **La pantalla** (`telefono-de-cocina/`): arriba la tira de mesas por estado (color y texto; tocar
  lleva a esa comanda); en medio un carrusel con `scroll-snap`, cada tarjeta al 88 % para que se asome
  la siguiente, puntos y, la primera vez, una pista de deslizar que respeta «reducir movimiento»; abajo
  los botones grandes (Repetir voz, Preparar, Listo) y la botonera Bluetooth actúan sobre la comanda
  a la vista. La vista se recuerda por comanda: una nueva entra al final sin mover a quien cocina;
  vibra y la voz dice algo corto («Mesa 4: 7 platillos, 2 con nota», «Para llevar 3: 4 platillos»,
  y «con alergia» si la hay); «Repetir voz» sigue leyendo el detalle. La nota del platillo sale sin el
  pliegue de sus opciones (la misma regla que la pantalla grande, DP-D105). La pantalla no se apaga.
- **Sin migración.** Lo hizo el agente E (Sonnet); revisado e integrado por la sesión principal.

## DP-D107 · El menú del comensal: el digital como estilo nuevo, «a la carta» mejorado · 10-11-2026

- **Cuatro modos** en la configuración del QR («Cómo se ve el menú»): **Menú digital** (el estilo
  nuevo), **A la carta** (`productos_pos`), **Páginas subidas** (`menu_subido`, se queda como opción) y
  **A la carta y páginas** (`mixto`). Sin elegir, el digital (`banderasDe`); quien ya eligió lo conserva:
  Don Poncho sigue en «Páginas subidas» (así está en su base) hasta que Miguel lo cambie. Sin
  promociones (el hueco del carrusel queda reservado y apagado).
- **El menú digital** (`src/portal/menu-digital/MenuDigital.tsx`): arriba el nombre de la mesa y, con
  pedido, el contador que abre la hoja del pedido de la mesa; la barra de secciones se queda pegada y
  marca sola la sección que se lee (tocar una lleva a ella, suave salvo con «reducir movimiento»);
  cada sección en dos columnas de tarjetas redondeadas: con foto, la foto entera con un degradado que
  deja leer nombre, descripción corta y precio; sin foto, el fondo elegido en Productos. Tocar abre la
  ficha del platillo de siempre (`ProductoQRDialog`: opciones con precio, peso, cantidad y nota). Lo
  agotado se ve marcado y no se pide; con la cuenta pedida o sin poder pedir, las tarjetas se leen pero
  no se tocan. Abajo, la barra del pedido de la mesa con su contador y total (la del carrito
  compartido); «Llamar a mi mesero» sigue igual.
- **El fondo de la tarjeta sin foto** es de una **lista cerrada** (`FONDOS_DE_TARJETA` en
  `@morphiqpos/contracts`): cuatro colores, dos degradados y tres ilustraciones (papel picado,
  talavera y milpa), todos con los tokens del estilo del negocio (cambiar el estilo cambia las
  tarjetas). Se elige en Productos (si el platillo no tiene foto); el puente sólo guarda un valor de
  la lista (`validacion: 'fondo_de_tarjeta'`) y el portal lo pinta con una clase, nunca como CSS.
- **«A la carta»** (`MenuALaCarta.tsx`): todas las secciones seguidas con la misma barra, letra grande
  (nombre 18 px, descripción 16 px), el nombre y el precio en la misma línea, el «+» de 44 px alineado
  y la foto (si hay) pequeña a la izquierda; ya no hay pestañas que escondan el resto del menú.
- **Accesible:** objetivos de 44 px, texto que no baja de 14 px, contraste AA en las tarjetas (texto
  blanco sobre el degradado oscuro de la foto; en los fondos, la pareja de tokens del estilo), sin
  desborde a 360 px y la barra de secciones como navegación con `aria-current`.
- **Sin migración nueva:** `productos.fondo_tarjeta` llegó con la 192.


## DP-D108 · Lo que cambió el QA de DP-16: insumo opcional en lo que va por peso, la mesa unida en el cierre y el corte de Registros completo · 10-11-2026

- **El ingrediente base es opcional en lo que se vende por peso** (`validarProductoVariable`,
  `TipoVentaSection.jsx`): Don Poncho no lleva insumos y vende la barbacoa por kilo; el formulario
  exigía el insumo aunque el servidor nunca lo pidió, así que nada de un producto por peso se podía
  guardar desde Recetas (tampoco «Vender sólo en estas presentaciones», DP-D104). Sin ingrediente base
  se vende por peso sin descontar inventario. El de porción (contenedor) sí lo sigue pidiendo.
- **La mesa unida que traba el cierre se decide en su renglón** (`MesasPendientesCierreDialog.jsx`):
  tras dividir y cobrar la cuenta de mesas unidas, quedan en «Limpieza» y unidas; «Marcar libre» la
  principal pide decidir (`MESA_UNIDA_SIN_DECISION`). La pregunta salía en un diálogo aparte encima del
  del cierre y se cerraba sola; ahora «Separar mesas», «Dejarlas unidas» y «Cancelar» salen bajo esa
  mesa, a la vista, y la lista se vuelve a leer al liberar (al separar quedan libres las demás).
- **El corte de Registros dice lo mismo que el documento al cerrar** (`extras-del-corte.ts`): el visor
  lee la hoja del servidor y pinta «Opciones vendidas · cuánto sumaron» y «Retiros con PIN de gerente ·
  quién autorizó» con los mismos ayudantes; si sólo eso falla, el corte sale y lo dice.
- **El fondo de la tarjeta se elige también en Recetas** (`RecetaFormDialog.jsx`), donde se editan los
  platillos con receta (los de Don Poncho); antes sólo al crear desde Productos.
- **El texto sobre la foto lleva su propia sombra**, del alto de lo que dice (nombre, descripción y
  precio), más una sombra de letra: sobre fotos claras pasó de 10–47 % del recuadro bajo 4.5:1 a 0 %.
- **44 px:** en la ficha del platillo («Cerrar», cantidad, presentaciones), la «×» de los paneles
  (primitiva `sheet`), el botón del tema, las fichas de «Páginas subidas» y su «Agregar», y «Entregar»
  por estación del mesero. La ficha del platillo es un diálogo (`role="dialog"`, `aria-modal`, título).
- **La ventana crece desde el toque, medido desde su centro** (`origenEnCss`): una ventana centrada que
  termina de cargar crece hacia arriba y hacia abajo por igual; medido desde la esquina el origen se
  corría la mitad de lo que crecía (142 y 213 px en el QA).
- **En la cocina:** la comanda para llevar ya no lleva la banda ámbar «Cuenta cobrada» (siempre está
  cobrada: `avisaCuentaCobrada`), y en «Listo» el botón «Quitar de la lista» baja de fila cuando no
  cabe (tableta a 768 px).
- **Quedan como mejoras, sin cambiar:** el folio y la mesa se escriben distinto en el visor y en el
  documento; el Cierre del día desglosa por canal y opciones sólo la caja que cierra; cada mesero une
  sólo sus mesas; el CSV de Ventas no trae «Opciones» (está en «Exportar productos»); los puntos del
  carrusel del teléfono de cocina con más de 12 comandas; textos de 11–12 px heredados.
- **Sin migración.**

## DP-D109 · Las mejoras que dejó el QA de DP-16 · 10-11-2026

- **El corte se escribe igual desde los dos lados** (`corte-heredado/folio-y-mesa.ts`): el visor de
  Registros dice el folio del corte con su serie («CC-2»), cada venta con la suya («A-3») y la mesa
  «Mesa 4» (o su nombre), como el documento al cerrar. El puente expone `Venta.serie` y
  `Venta.mesa_nombre` (sólo lectura).
- **El Cierre del día desglosa el día** (`caja/corte/ventas-del-dia.ts`): las ventas del día traen,
  además del total y los métodos, las cuentas y el importe por canal (mesas y para llevar), las opciones
  vendidas y los retiros con PIN de TODAS las cajas de la ventana. Las consultas de opciones y de retiros
  reciben el conjunto de sesiones (`opcionesVendidasEn`, `retirosConPinEn`): una en el corte de una
  caja, todas en el del día. El documento y el visor las pintan con el mismo armado (`corte/del-dia.ts`):
  celdas «Mesas (N)» y «Para llevar (N)» bajo «Ventas del día · todas las cajas», y las tablas «… del
  día · todas las cajas». Lo de la caja sigue siendo sólo de la caja (DP-D50).
- **La mesa se libera al cobrar la última parte de una cuenta dividida**
  (`unir-mesas/liberar-tras-cobrar.ts`): una parte nace sin mesa; tras cobrarla, la Caja intenta
  liberar la mesa de su cuenta madre. Con partes pendientes el servidor responde `MESA_NO_LIBERABLE` con
  `partesSinCobrar` y no se avisa nada; con la última, se libera, y si las mesas están unidas sale la
  pregunta de separar. Antes quedaban en «Limpieza» hasta el cierre. Al navegador sólo llega la regla
  del error (`comando.ts` no manda sus datos): con una PARTE, «no liberable» quiere decir que faltan
  las otras y tampoco se avisa (lo cazó la ronda 3 del QA).
- **La ficha del platillo es modal también para el lector de pantalla** (`sistema/apagar-el-resto.ts`):
  al abrir, lo que está junto a su capa queda `inert`; al cerrar vuelve como estaba y el foco regresa a
  la tarjeta. Su efecto depende sólo de `open`: con `onClose` en las dependencias, cada refresco del
  portal (el carrito sondea) mandaba el foco a «Cerrar» mientras el comensal escribía su nota.
- **El teléfono de cocina con muchas comandas**: más de 8, «3 de 16» en lugar de los puntos; la tira
  numera las rondas de una misma mesa («Mesa 4 · 1», «Mesa 4 · 2»).
- «Liberando…» ya no se queda junto a la pregunta de separar mientras se decide.
- **El PDF que se baja solo al cerrar** (`CorteAutoDownloader.jsx`) también trae «Opciones vendidas» y
  «Retiros con PIN de gerente» (en DP-D108 sólo el visor de Registros), y la parte de una cuenta
  dividida ya no dice «— · Mesa 9 · cuenta 1 de 2».
- «Conectar teléfono»: medido en la demo a 1280 y 1024 px, crece exactamente desde el toque con el
  origen relativo al centro (DP-D108); los 113 px del QA no se reproducen.
- **Sin migración.**


## DP-D110 · La configuración no «se regresa»: cada pantalla invalida la llave que se lee y guarda sólo lo que cambió · 11-11-2026

- **Lo que vio Miguel (11-11):** guardaba «Cómo se ve el menú» en Portal QR → Configuración, la base lo
  guardaba (hoy dice `productos_pos`, a las 10:37) y al cambiar de pestaña y volver el formulario se
  rellenaba con lo de antes.
- **La causa:** `ConfiguracionQRTab.jsx` invalidaba `['config_remote']`, una llave que ninguna consulta
  usa; la configuración vive en `['config']` (`ConfigContext.jsx`, sin refresco al volver a la ventana).
  El contexto se quedaba con la vieja y la pestaña, al volverse a montar, se llenaba con ella.
- **Elección:**
  1. La pestaña invalida `['config']`.
  2. **Prueba de contrato** (`src/cliente/llaves-de-consulta.contrato.test.ts`): lee el código de las
     pantallas (`heredado/` y `src/`), junta las raíces de las llaves que se LEEN (`queryKey` de una
     consulta) y las que se ESCRIBEN desde fuera (invalidar, refrescar, reiniciar, quitar, cancelar,
     poner datos) y exige que cada raíz escrita sea leída; una llave que no entiende es un error. Al
     correrla salieron N llaves huérfanas más (abajo, con lo que se hizo con cada una).
  3. **Cada sección guarda sólo su parche** (`src/configuracion/parche-de-la-seccion.ts`): Datos del
     negocio, Identidad, Colores, Unidades y Portal QR mandan sólo los campos que difieren de lo que
     leyeron al entrar. Antes cada una mandaba su formulario entero: un campo que no tocó viajaba con el
     valor de cuando lo leyó y pisaba lo que otra pantalla u otro aparato hubiera cambiado. El contrato
     exige que todo `ConfiguracionNegocio.update` de las pantallas pase por el parche.
- **Pruebas:** la de contrato (en rojo con `config_remote`), las del parche, y Playwright: guardar el modo
  → otra pestaña → volver → sigue el nuevo; recargar → sigue el nuevo.
- **Sin migración.**

## DP-D111 · La Caja dice siempre qué cajas están abiertas en otros aparatos · 11-11-2026

- **Lo que pasó en producción el 11-11** (la auditoría, sólo leyendo): la caja se abrió a las 10:14 en
  «Caja 2» (la tableta). El cupo ya era 2. A las 10:38:30 se movió a 1 y medio segundo después a 2; en
  la PC, la Caja decía «No hay caja abierta en este aparato · Abrir caja» y no mencionaba la de la
  tableta. A las 10:40:53 el cupo pasó a 1, y al volver a Caja ya ofrecía «Traer esta caja aquí»
  (10:41:31, la trajo).
- **La causa:** no fue caché ni carrera: fue diseño y consulta. DP-D74 decidió que, si cabe otra caja,
  la pantalla sólo ofreciera abrir y CALLARA la abierta en otro aparato; y `caja.estado` traía sólo la
  más vieja de las ajenas y sólo cuando el aparato no tenía caja. Con el cupo en 2 no había ni una
  palabra de la tableta; con el cupo en 1, la ofrecía. Además, cambiar el cupo no refrescaba la Caja
  (sólo al volver a montarla, y cada 8 s).
- **Elección:** `caja.estado` trae siempre `otrasCajas`: todas las abiertas en otras terminales de la
  sucursal (dónde, quién, desde qué hora y si este puesto la puede trasladar), con o sin caja aquí. La
  Caja las enseña en «Cajas abiertas en otros aparatos» con «Trasladar aquí» (con confirmación: el otro
  aparato se queda sin caja) y, si cabe, «Abrir otra caja aquí (N de M)»; si no cabe, «Ya hay N cajas
  abiertas de M». Se relee cada 4 s, al volver a la pestaña y al cambiar el cupo (que ahora invalida
  la caja).
- **Revisa DP-D74:** la segunda caja se sigue abriendo si cabe; lo que cambia es que la otra nunca se
  calla.
- **Pruebas:** integración (`otrasCajas` con y sin caja propia), unidad del texto, y Playwright con dos
  contextos (la tableta y la PC): cupo 2, cupo 1, y la PC se entera sin recargar cuando la tableta cierra.
- **Sin migración.**

## DP-D112 · Los cuatro casos de orilla de la auditoría del 10-11 (M1, M3, M5, M6) · 11-11-2026

- **M1 · «Armar» y «Cobrar» del mismo borrador para llevar:** `armar_para_llevar` leía el borrador de la
  terminal sin candado y borraba sus renglones sin mirar si seguía siendo borrador. Con un cobro del
  mismo borrador en vuelo, le reescribía los renglones a la cuenta que en ese instante quedaba pagada;
  y dos «armar» a la vez en una terminal sin borrador creaban dos y el segundo moría con 23505.
  Ahora toma primero la terminal con candado (serializa a quien arma en ese aparato), luego el
  borrador con `FOR UPDATE`, y sólo borra renglones de una cuenta que sigue en `borrador`. Si el cobro
  ganó, empieza un borrador nuevo.
- **M3 · El pedido para llevar que cruza la medianoche:** la lista de la Caja traía sólo los pedidos del
  día; uno cobrado a las 23:55 y listo a las 00:05 desaparecía sin entregarse. Ahora trae también los
  de los dos días anteriores que siguen en la cocina o listos sin entregar (`deOtroDia`, «de ayer» en
  la pantalla), hasta que alguien toca «Entregado».
- **M5 · Dividir una línea con opción «por renglón»:** en lo que va por porción (y por peso) la opción se
  cobra una vez por renglón; al partir la línea entre las cuentas, cada trozo copiaba la opción con su
  precio entero y «Opciones vendidas» del corte sumaba de más. Ahora cada trozo lleva SU parte del
  precio de la opción (repartida con los mismos pesos que el importe de la línea): el corte cuadra con
  lo cobrado. «Veces» cuenta renglones cobrados (los trozos de una línea partida cuentan cada uno). Lo
  que va por peso no se parte (va entero a una parte, DP-14.5) y ya cuadraba: queda con su prueba.
- **M6 · Una opción que resta no deja el platillo en $0 o menos:** antes el servidor lo dejaba en $0
  («gratis») sin decir nada (DP-D104). Ahora `opcionesQueDejanSinPrecio` (`@morphiqpos/domain/catalogo`)
  calcula lo peor que pueden restar las opciones que se pueden elegir juntas y se rechaza en el editor
  de opciones, al guardar el grupo y al asignarlo (`OPCION_DEJA_SIN_PRECIO`) y, si el precio del
  platillo bajó después, al vender. **Revisa DP-D104** («nunca baja de cero»): ya no se regala.
- **Sin migración.**

## DP-D113 · «Personalizar menú»: el menú del comensal en un solo lugar, con la vista previa del teléfono · 11-11-2026

- **Lo que pasó:** el fondo de la tarjeta sólo se cambiaba en Recetas → Editar receta o en Productos →
  Agregar, y Miguel no lo encontró.
- **Elección:** **Portal QR → «Personalizar menú»** (`src/restaurante/personalizar-menu/`). Por
  platillo: la foto (el mismo `ImageUploader`), la descripción corta (hasta 140 letras) y el fondo
  (`SelectorDeFondo`, sólo sin foto). Del menú: el mensaje de bienvenida, los colores (el estilo del
  portal, `portal_qr_tema.estilo`, el mismo que edita `AspectoDelPortal`) y el orden de las
  secciones (↑ ↓). Al lado, la **vista previa del teléfono** (360 px) con los mismos menús del portal
  (el digital, o «A la carta» si así está el negocio, siempre a dos columnas), que cambia mientras se
  edita, antes de guardar.
- **Cada bloque guarda su parche** por el puente (`ProductoTerminado`, `CategoriaProducto`,
  `ConfiguracionNegocio`) y refresca las consultas que lo leen. Al guardar el orden se renumeran las
  secciones (1, 2, 3…): en la base propia había empates (varias en 1, 2, 3) y el portal las ordenaba como
  caía.
- **Pruebas:** unidad (el parche, el tope, la vista previa, mover y renumerar) y Playwright: lo guardado
  se ve en la vista previa al editarlo, sigue igual al volver de otra pestaña y al recargar, y el
  portal de la mesa lo enseña. También recorrido contra una copia de la base propia (107 platillos).
- **Sin migración.**

## DP-D114 · Dejar producción en ceros: un guion por los comandos y `mantenimiento.reiniciar_folios` · 11-11-2026

- **Lo que hay en producción** (11-11): la prueba de Miguel, 1 venta cobrada (A-1, $429.00) y 1 caja
  abierta; y Miguel seguirá probando.
- **Elección:** `scripts/dejar-en-ceros.mjs` (`--org`, `--persona` dueño de plataforma, `--desde`
  AAAA-MM-DD, `--ventas` N, `--ensayo`), como `limpiar-ventas-de-prueba.mjs`: firmado por el dueño, por
  los comandos de la app y por la conexión de sesión (rechaza el 6543). Antes de escribir comprueba que
  todo es de prueba (nada de antes de `--desde` en cuentas, cajas ni pagos, y no más cobradas que
  `--ventas`); luego `mantenimiento.purgar_ventas` (revirtiendo el inventario), `purgar_seccion`
  «cortes» (la caja de prueba abierta se va con las demás) y `mantenimiento.reiniciar_folios` (nuevo).
  La auditoría se queda.
- **`mantenimiento.reiniciar_folios`** (`mantenimiento/en-ceros.ts`): dueño de plataforma y el nombre
  del negocio como confirmación; se niega si queda una cuenta o un corte con folio (los números
  chocarían). El número para llevar sale de las cuentas del día: sin cuentas, vuelve a 1 solo.
- **Probado en una copia de la base propia** (con la venta y la caja de Miguel): con `--desde` del día
  siguiente y con `--ventas 0` se niega sin escribir; el ensayo dice lo que haría; en serio deja cuentas,
  cajas, pagos, comandas, carritos y movimientos en 0, las 10 mesas libres, los folios en 1 y la
  auditoría de 447 a 450 (los tres pasos). Una segunda corrida no hace nada nuevo. Integración: 3 de 3.
- **En producción se corre sólo cuando Miguel lo pida en el chat**, primero con `--ensayo`.
- **Sin migración.**

## DP-D115 · La compra en efectivo sale del cajón de la caja abierta · 12-11-2026

- **El hallazgo** (simulador de jornada, A11): una compra de contado bajó el efectivo esperado de la
  caja abierta, hasta dejarlo en negativo cuando la compra era más grande que lo que había en el cajón.
- **Decisión: se queda así.** Es la regla de la 2.4 (bloque D), la misma de un gasto en efectivo: el
  dinero que se le da al proveedor sale del cajón, y si la compra no lo registrara, el arqueo de la
  noche esperaría un efectivo que ya se fue. Sin caja abierta, la compra en efectivo no se registra.
- **Lo que cambia es la instrucción:** si el dinero NO salió de la caja (lo pagó el dueño de su bolsa),
  la compra se registra como transferencia o tarjeta. El diálogo empieza en «Efectivo», así que va en
  `docs/ENTREGA-DON-PONCHO.md` («El almacén y las compras»). Un tope contra el efectivo esperado se
  deja para después de la entrega: cambiaría también los gastos y no lo pidió el negocio.
- **Sin migración ni cambio de código.**

## DP-D116 · Lo que pasó por cocina se cobra aunque el almacén diga que no había · 12-11-2026

- **El riesgo** (al arreglar A3, DP-18): el cobro no bajaba el «Ingrediente base» de los productos
  por peso y por porción. Al hacerlo bajar —y al poder crear por fin el almacén (A4)— un platillo
  cuyo insumo no tiene existencias cargadas (lo normal el primer día) frenaba el cobro con «No hay
  inventario suficiente para completar la venta»: `permite_venta_sin_stock` nace en `false` y
  ninguna pantalla del restaurante lo enciende.
- **Decisión:** si la orden tiene comandas (pasó por cocina: mesa, para llevar o portal), el cobro
  descuenta permitiendo el negativo. La comida ya se preparó y se sirvió: frenar el cobro sólo
  detiene la caja con el comensal enfrente. Es la misma regla que al cancelar (DP-D57): la existencia
  queda en negativo para que el conteo lo enseñe. Lo que se vende en mostrador sin cocina sigue la
  regla del producto.
- **Prueba:** `insumo-base-por-peso-y-porcion.integracion.test.ts` (un kilo de carne sin existencias
  se cobra y la carne queda en −500 g). Mutantes muertos: sin el permiso y sin la consulta de comandas.
- **Sin migración.**

## DP-D117 · Cancelar la cuenta de mesas unidas pregunta si separarlas · 13-11-2026

- **El hueco** (A19, DP-18): al cobrar, las mesas de un grupo van a limpieza y al limpiar la principal
  se pregunta «¿Separar mesas o dejarlas unidas?» (DP-9.6). Al CANCELAR iban directo a libres y la
  unión quedaba abierta sin que nadie lo decidiera; en la simulación, el grupo siguiente que se sentó
  en la mesa secundaria pidió por su QR a la cuenta del grupo de la principal.
- **Decisión:** cancelar hace la misma pregunta que liberar. `restaurante.cancelar_orden` acepta
  `grupo: 'separar' | 'mantener'`; con `separar` separa la unión en la misma transacción. Sin `grupo`
  queda como antes (unidas, DP-9.6), por compatibilidad: la Caja y el mesero siempre lo mandan.
- **Pruebas:** `cancelar-grupo-de-mesas.integracion.test.ts` y `cancelar-con-mesas-unidas.contrato.test.ts`.
  **Sin migración.**

## DP-D118 · Registros lee el periodo elegido en el servidor, no «las últimas N» · 14-11-2026

- **El problema** (A21, DP-18): cada pestaña de Registros cargaba las últimas N filas (1 000 ventas,
  200 cortes, 300 compras, 500 movimientos, 300 gastos) y filtraba en el navegador. Pasado el tope lo
  viejo desaparecía sin aviso del historial, la búsqueda, el rótulo y el CSV; Don Poncho llega al tope
  de ventas en unos cinco días.
- **Decisión:** el periodo de la página (Hoy por omisión) se pide al servidor (`enRango`); si una
  lectura llega al tope del puente (1 000), la ventana se parte (lo reciente primero) hasta 10 000 por
  pestaña, y si algo quedó fuera la pantalla lo dice. Ventas y cortes se leen por apertura y por cierre.
  La búsqueda y el CSV trabajan sobre el periodo cargado; un folio buscado va primero (A25).
- **De paso** (A22): el resumen comparaba los días de compras y gastos como medianoche UTC (el día
  anterior en CDMX) y no sumaba los de hoy.
- **Pruebas:** `apps/web/src/registros/*.test.ts`. **Sin migración.** Pendiente: Propinas (A23).

## DP-D119 · Las apps son transporte: la página arma los bytes y `printDocument` decide · 14-11-2026

- **El encargo (DP-20):** un `.exe` (Electron) y una `.apk` (Capacitor) que abren el POS de producción,
  imprimen sin el diálogo del navegador, abren el cajón y se actualizan solas.
- **Alternativas:** (a) que cada app dibuje y codifique el ticket (captura nativa de la página y un
  codificador en cada plataforma); (b) que la PÁGINA lo dibuje y lo codifique, y la app sólo entregue
  bytes.
- **Elección: (b).** El dibujo, el paso a 1 bit, ESC/POS, el corte, el cajón, las copias y la marca
  de reimpresión viven en `apps/web/src/impresion/`; las apps (`M1gu3hb/morphiq-pos-apps`, público y
  genérico por cliente) entregan los bytes por el spooler en crudo, red, USB, Bluetooth o serie, o
  imprimen por el driver de Windows. Un mismo puente en las dos, `window.MorphiqApp` (contrato v1),
  expuesto sólo a `https://pos-don-poncho.vercel.app` y a las pantallas propias de la app; cada
  llamada vuelve a revisar el origen.
- **Consecuencias:** un arreglo de impresión sale con un despliegue de Vercel, sin reinstalar nada en
  los POS; hay UN codificador y se prueba en el repo; las apps casi no cambian. A cambio, el dibujo
  depende del navegador del aparato (Chromium de Electron o el WebView de Android, 111 o más nuevo).
- **Las pantallas no cambian:** siguen llamando a `printDocument` (`heredado/lib/print.js`). Con la
  app y un perfil que imprime ese documento, sale directo; si no, el diálogo del navegador de siempre.
  El avance y los errores van en una barra global (`BarraDeImpresion`): «Enviando…» → «Imprimiendo…» →
  «Impreso ✓» o «Enviado ✓» (cuando la impresora no confirma), y el error con sus tres salidas
  (reintentar, navegador, ir a Impresión). Un trabajo a la vez por documento; el reintento lleva el
  mismo id y la app no imprime dos veces lo entregado (`trabajos.ts`).
- **El perfil de impresión vive en el aparato** (lo guarda la app): cada POS tiene su impresora.
- **Sin migración.** Agentes Sonnet para Electron y para Android; revisados e integrados.

## DP-D120 · El ticket sale igual al de la pantalla: el mismo nodo, en puntos, con estilo térmico · 14-11-2026

- **El problema que ya vivió Miguel:** en «ESC/POS» el ticket salía raro (página de códigos, ancho,
  grises y letras delgadas, búfer que se llena).
- **Elección:** por omisión el ticket se imprime como IMAGEN del mismo HTML. `PreCuentaTicket` se
  dibuja en un lienzo medido en puntos de la impresora (384 en 58 mm; 576 o 512 en 80 mm; 8 por mm)
  con el **estilo térmico** (`termico/estilo.ts`): negro puro, letra gruesa del sistema (peso 700,
  nunca menor de 21 puntos), separadores sólidos de 2 puntos. En pantalla se achica con `zoom` a su
  tamaño real; al imprimir, una copia de ESE nodo se dibuja con el motor del navegador (SVG con
  `foreignObject`), el texto pasa a 1 bit con umbral y el logo con tramado (Floyd–Steinberg), y sale
  en franjas `GS v 0` (filas por franja, bloque y pausa configurables), con líneas de avance antes del
  corte. Alternativa por columnas (`ESC *`) y por el driver de Windows con la misma imagen.
- **Descartado:** `html2canvas` (redibuja el CSS a su manera: no es el motor de la pantalla) y una
  plantilla de texto aparte como camino principal (es justo lo que salía raro; queda como plan B).
- **La comprobación** (`pnpm test:impresion`, en la CI): el componente real en Chromium → 1 bit →
  ESC/POS → `emulador.ts` (una impresora falsa que lee los bytes de vuelta) → comparar. Cero puntos
  de diferencia, y contra la captura de la pantalla, cero tinta fuera de lugar (sólo ~0.4 % de puntos
  del borde de las letras, por el suavizado). En 58 y 80 mm, con y sin logo, con acentos y ñ.
- **Lo que cambió a la vista:** la nota del renglón lleva «»» en lugar de «↳» (la letra gruesa no
  trae esa flecha).

## DP-D121 · El cajón: al cobrar queda en la auditoría; a mano, el comando que ya existía · 14-11-2026

- **Lo que había:** `caja.abrir_cajon` (F-984, `/api/caja/cajon`): abrir el cajón SIN venta, con la
  caja abierta de esa terminal, su motivo y un movimiento de cero en el turno. Ninguna pantalla lo
  usaba.
- **Elección:** el botón «Abrir cajón» de la Caja (cajera, gerente, administrador y dueño) usa ESE
  comando, con su motivo (dar cambio, guardar un billete, conteo, otro). Para la apertura que se
  dispara sola al cobrar en efectivo, un comando nuevo y mínimo, `caja.cajon_por_cobro`, que sólo deja
  el rastro (quién, cuándo, con qué cobro). En los dos casos: primero el servidor, después el pulso.
- **Se descartó** un comando único con motivo «cobro» o «manual» (el del encargo): duplicaba el que
  ya existía y perdía su regla de la caja abierta. **Revisa el encargo DP-20 §3.4.**
- Un cajón que no abre nunca deshace el cobro: se avisa y queda el botón. **Sin migración.**

## DP-D122 · Copias y «REIMPRESIÓN»: el servidor cuenta las salidas en la auditoría · 14-11-2026

- **Copias:** `configuracion.valores.copias_de_impresion` (ticket, precuenta y corte: 1 a 3, 1 por
  omisión), por `caja.fijar_copias_de_impresion` (dueño o administrador, con antes y después). Cada
  copia dice al pie «ORIGINAL — CLIENTE» o «COPIA — NEGOCIO»; el cajón se abre una sola vez.
- **Reimpresión:** «Imprimir» nunca se bloquea. Antes de mandar el papel de un ticket, la pantalla
  pide `venta.registrar_impresion`: el servidor cuenta en la auditoría las salidas de ESA venta y
  contesta si es la original o una reimpresión, con su hora; desde la segunda el papel dice
  «REIMPRESIÓN» con fecha y hora, por la app y también por el navegador. El reintento de un trabajo
  que falló reusa su registro (misma clave de idempotencia): no cuenta otra salida.
- **Sin el servidor** (por el navegador): el papel sale marcado «sin conexión: esta salida no quedó
  registrada»; nunca pasa por original. Sin internet, la app reimprime su copia local del último
  ticket, marcada, desde la pantalla «Sin internet».
- **Sin migración** (se descartó una columna de conteo en `ordenes`: la auditoría ya lo tiene).

## DP-D123 · «Hardware y pruebas de impresión»: la contraseña del proveedor, sólo su hash · 14-11-2026

- **Dónde:** hasta abajo de Configuración → Operación. Ahí se decide con qué impresora y cómo imprime
  cada aparato, y se guarda como el perfil de ese POS (exportable). El personal sólo ve el estado en
  Configuración → Impresión.
- **La contraseña** (el repositorio es público): no existe en ningún archivo. El despliegue guarda
  su hash Argon2id en `PROVEEDOR_CLAVE_HASH`; se compara en el servidor (`/api/proveedor/entrar`),
  con 5 fallos y 15 minutos de espera (`LIMITES.proveedor`), y cada entrada y cada fallo en la
  auditoría (`proveedor.entrar`, `proveedor.fallar`). Si acierta: un permiso firmado de 30 minutos,
  atado al negocio, en una cookie `httpOnly` y `SameSite=Strict`. Sin la variable, nadie entra.
- **No es un comando** por lo mismo que el PIN del supervisor: un comando que rechaza revierte su
  transacción y el rastro del fallo se perdería.
- **Lo que esto no cubre, dicho:** el puente de la app no puede comprobar ese permiso (el perfil se
  guarda en el aparato). Por eso las apps publicadas llevan apagadas las herramientas de
  desarrollador y el puente sólo existe para la página de producción.

## DP-D124 · Lo que DP-20 deja para después · 14-11-2026

- **Texto ESC/POS por página de códigos** (CP437/850/858/1252/8859-1) con su hoja de acentos,
  **Star** (Line/StarPRNT), **código de barras y QR nativos** y los **SDK de Sunmi/iMin**: el
  laboratorio los enseña apagados con su razón. La candidata para codificarlos es
  `@point-of-sale/receipt-printer-encoder` (4.0.1); no entró porque la imagen, que es lo que se usa,
  se codifica con cuarenta líneas propias y probadas.
- **El corte y el Cierre del día al rollo** y **las comandas en impresora de estación:** el perfil
  ya trae sus casillas; esos documentos todavía no tienen lienzo térmico y salen como hoy.
- **Windows 7/8:** queda el guion `construir:legado` (Electron 22), sin construir. Chromium 108 no
  alcanza a Tailwind 4 (111): ahí el POS puede verse mal. Recomendación: Windows 10.
- **El modo ligero** quita desenfoques, sombras pesadas y transiciones (`<html data-ligero>`); no
  toca las animaciones hechas en JavaScript ni cambia qué carga cada pantalla.

## DP-D125 · La revisión de seguridad de DP-20: lo que se corrigió y lo que queda para la 1.0.1 · 15-11-2026

Dos revisiones independientes (agentes Sonnet, sólo lectura): el POS de esta rama y las dos apps
publicadas. Ninguna halló nada crítico.

- **Corregido aquí:** el permiso del proveedor iba atado sólo al negocio; si otra persona entraba
  con su PIN en ese aparato antes de los 30 minutos, heredaba el laboratorio. Ahora el permiso
  firmado lleva también a quien tenía la sesión (`<negocio>.<persona>.<vence>.<firma>`) y
  `/api/proveedor/estado` lo compara con la sesión que pregunta.
- **Se queda como está, a sabiendas:** el instalador de Windows no lleva firma de código (hace
  falta un certificado), así que la integridad de la actualización descansa en la cuenta de GitHub
  y en `latest.yml` por HTTPS: esa cuenta tiene que tener verificación en dos pasos. Y el puente
  confía en la página de producción: un XSS ahí lo heredaría todo.
- **Para la 1.0.1 de las apps** (que además será la prueba real de la actualización automática):
  imprimir por red sólo a direcciones privadas —la misma regla en el perfil de la página, en
  Electron y en Android—; en Windows, aceptar sólo impresoras que estén en la lista del sistema
  (una compartida `\equipo\impresora` instalada sí; un nombre UNC inventado no); en Android, topes
  de tamaño para el documento y los ajustes, y no cargar el POS si el WebView no tiene
  `WEB_MESSAGE_LISTENER`; en la ventana oculta del driver, JavaScript apagado.
- **Menores, anotados:** el límite de intentos de la contraseña cuenta por IP y no por negocio; un
  intento rechazado por el límite (429) no deja fila en la auditoría (los fallos de contraseña sí).

## DP-D126 · El modo compatible: respaldos en el CSS, no otra versión del POS · 15-11-2026

El iMin D4-503 (Android 7.1.2, sin servicios de Google) trae un WebView que no se actualiza ni
instalando «Android System WebView» o Chrome. Entiende las capas de CSS (Chromium 99) pero no
`color-mix` (111), ni `translate`/`scale`/`rotate` sueltos (104), ni `dvh` (108), ni `:has()` (105).
Reproducido en la laptop con el Chromium 99.0.4844.0 oficial: mismas teclas crema sin número,
mismos diálogos corridos.

- **Se arregla en la hoja que ya se sirve, con respaldos.** Un plugin de PostCSS propio
  (`scripts/modo-compatible/`), después de Tailwind: el respaldo de cada opacidad pasa de sólido a
  `hsl(var(--token) / N%)` (exacto: los tokens son tripletas `H S% L%`); cada regla y cada
  animación con transformaciones sueltas recibe su `transform` compuesto dentro de
  `@supports not (translate: 0)`; cada `dvh`, su `vh`; y cada dirección de degradado «in oklab»
  (sintaxis de Chromium 111: sin ella el degradado entero es inválido y el fondo de marca salía
  liso), la misma sin el espacio de color. **En un motor moderno no cambia un pixel**:
  todo va en respaldos que el motor nuevo ya reemplaza o en bloques `@supports not` en los que no
  entra. No se detecta el navegador por su nombre, no hay una segunda hoja ni un segundo build.
- **Por qué no bajar los «targets» del compilador:** Tailwind 4 no sabe calcular la transparencia
  de un color que es una variable (`hsl(var(--acento))`), y pedirle a Lightning CSS navegadores
  más viejos cambia prefijos y sintaxis de TODA la hoja, también para lo moderno. El plugin toca
  sólo lo que falla y deja escrito por qué.
- **El piso es Chromium 99.** Por debajo no hay capas de CSS y el navegador tira toda la hoja de
  Tailwind: ahí el POS enseña «Este aparato es demasiado viejo para el POS. Pide ayuda a tu
  proveedor». El aviso nace oculto y lo enseña un guion de una línea que le pregunta al motor si
  conoce las capas (`CSSLayerBlockRule`); su aspecto va en la hoja, fuera de las capas. Probado con
  Chromium 97. **Se intentó primero sin JavaScript** —una regla sin capa que lo enseñaba y otra en
  `@layer` que lo ocultaba, las dos con `!important`— **y se descartó:** con la hoja real el
  Chromium 99.0.4844.0 resolvió ese cruce al revés y el aviso tapó el POS entero en el motor más
  viejo que sí lo pinta bien. Lo atrapó la prueba con el motor viejo, no la revisión. Un aviso que
  puede salir donde no debe es peor que no tenerlo: `verify:modo-compatible` ya no deja que la hoja
  decida con `display` si se ve.
- **JavaScript:** el POS usa `toSorted` (el mapa de mesas ordena con él las solicitudes del QR) y
  `URL.canParse`; un motor viejo no las trae y ahí la pantalla se cae. Van como relleno en línea
  en el `<head>`, que sólo se instala si falta. Ni una librería de rellenos entera.
- **El contrato, en la CI** (`verify:modo-compatible`, después del build): sobre el CSS y el
  JavaScript que salen de `next build`. Una mezcla con respaldo sólido, una transformación sin su
  `transform`, un `dvh` sin su `vh` o una función más nueva que Chromium 99 sin relleno detienen la
  CI. Si Tailwind o Next cambian la forma del CSS, se ve ahí y no en el restaurante.
- **El plugin es una entrada del build.** Vive fuera de `apps/web` y Turbo sólo cuenta los
  archivos del paquete: un cambio que tocaba sólo el plugin salió de la caché con el CSS de antes.
  `turbo.json` lo declara en `globalDependencies` (y una prueba no deja quitarlo).
- **Los estilos en línea no los alcanza el plugin.** El armazón heredado ponía su alto con
  `style={{ minHeight: '100dvh' }}`: un motor sin `dvh` tira ese estilo y el armazón se quedaba
  del alto de su contenido (el fondo se cortaba a media pantalla). Pasó a la clase `min-h-dvh`,
  que mide lo mismo y sí recibe su respaldo; igual la hoja del carrito del mesero. Declarado en
  `scripts/aspecto-permitido.json`.
- **Lo que queda como está, a sabiendas:** `:has()` no tiene respaldo en CSS. Lo único que se ve en
  las pantallas de la operación: **el botón del sistema con icono queda hasta 10 px más ancho** (no
  sabe que lleva icono y deja 5 px más de margen por lado; lo que comparte su fila se corre lo
  mismo). La prueba lo cuenta aparte y no deja pasar ninguna otra diferencia de acomodo. Arreglarlo
  pide un guion que vigile la página en el aparato viejo; no se mete código nuevo a correr ahí sin
  poder probarlo en el aparato. Lo del laboratorio ya no depende de `:has()`. Las consultas de
  contenedor (Recetas e Inventario) muestran su acomodo angosto, que es un acomodo válido.
  `text-wrap` y `field-sizing` degradan solos. Sin `inert` (Chromium < 102) la ficha del portal
  apaga lo de atrás con `aria-hidden` y sin clics, pero no atrapa el foco del teclado.
- **Las pruebas con el motor viejo no van en la CI:** necesitan bajar un Chromium de 180 MB sin
  parches de seguridad. Se corren en la laptop (`MORPHIQPOS_CHROMIUM_VIEJO`), sólo contra el
  servidor local. En la CI va el contrato, que es lo que impide la regresión.

## DP-D127 · Las apps 1.0.1: lo que DP-D125 dejó pendiente, hecho · 15-11-2026

La 1.0.1 de `morphiq-pos-apps` cierra la lista de DP-D125 y es la primera actualización que
reciben los POS instalados (la prueba real de la actualización automática). Se instala encima de
la 1.0.0: misma firma, mismo paquete, mismos ajustes.

- **La impresora de red vive en la red local, en los tres sitios:** la página (formulario del
  laboratorio), Windows y Android aceptan sólo una dirección IP literal privada, de enlace local,
  ULA o del propio aparato; nunca un nombre (no se consulta DNS). Lectura estricta y los mismos
  casos de prueba en los tres. **Consecuencia:** un perfil guardado con un nombre de host deja de
  imprimir por red hasta que se cambie por la IP; el mensaje lo dice. No se borra nada.
- **Windows:** sólo se imprime en impresoras que estén en la lista del sistema (una compartida
  instalada sí, un UNC inventado no; si la lista no se puede leer, no se imprime a ciegas);
  JavaScript apagado en la ventana oculta del driver; `will-frame-navigate`; fuses de Electron
  (`RunAsNode`, `NODE_OPTIONS` e `--inspect` apagados, sólo se carga la app del asar).
- **Android:** topes de tamaño (documento, ajustes, llamada), plazo total de envío en USB, red y
  Bluetooth, y el puente no se instala en iframes. **No se bloquea el POS si el WebView no deja
  preparar el puente al inicio del documento:** se usa el plan B completo y se avisa una vez. En
  esos WebView las llamadas llegan por `addJavascriptInterface`, que se ve en todos los marcos:
  queda la revisión de la URL de la página principal en cada llamada.
- **Modo ligero automático** también por 32 bits y por WebView anterior al 111: en el iMin se
  enciende solo. Lo que alguien fije a mano manda.
- **Variante de depuración de Android** (`.debug`, WebView depurable por USB): otro paquete, firma
  de depuración, sin actualización automática. Sólo para Miguel y para quien desarrolla; nunca al
  canal ni al personal. La `release` no es depurable (lo comprueba una prueba de construcción).
- **Sigue igual, a sabiendas:** el instalador de Windows sin firma de código; el puente confía en
  la página de producción.

## DP-D128 · Folios de verdad: prefijo, primer folio y bloqueo después del arranque · 16-11-2026

DP-21 · Bloque 6. Las cuentas se leen «DP-01001» y los cortes «DPC-0101»; el número sigue siendo el
consecutivo atómico de siempre (`repos/folios.ts`, series `A` y `CC`): sin huecos y sin letras al azar.

- **Un solo formateador** (`@morphiqpos/domain/venta`, `folioVisible(serie, folio, configuración)`):
  cuentas `<PREFIJO>-<5 dígitos mínimo>` (100 000 → «DP-100000»), cortes `<PREFIJO>C-<4 mínimo>`.
  **Sin prefijo, cada sitio dice lo que decía** (el ticket «3»; el documento del corte «A-3», «CC-2»):
  por eso recibe cómo lo decía el sitio (`'numero'` o `'con-serie'`). REM, CR, LIQ y CT no cambian.
  Un número sin serie conocida no se disfraza de cuenta. `coincideConElFolio` (búsqueda, el folio
  exacto va primero, DP-D118) y `entenderElFolio` (lo tecleado en devoluciones) son sus inversas.
- **Contrato** `venta/folio.contrato.test.ts`: todo `.folio` de `heredado/` y `src/` va dentro de un
  formateador o se declara con su razón. El corte, sus cancelaciones, devoluciones y descuentos
  arman el folio en SQL: el servidor lo viste al leer (`caja/corte/folios-vestidos.ts`).
- **Ajustes** en `configuracion.valores.folios` (lector único `foliosEn`; sin migración) con
  `configuracion.fijar_folios`, sólo el dueño, con antes y después en la auditoría. El prefijo (2 a 4
  letras A–Z, mayúsculas) se cambia siempre; el «Primer folio» sólo con los folios en cero y sin H1.
  Reubica el MISMO contador (`fijarSiguienteFolio`) de cada sucursal.
- **`mantenimiento.reiniciar_folios`** deja cuentas y cortes en su «Primer folio» (la serie `CT`, en 1) y
  se niega si hay folios en otra serie (REM, fiado, LIQ…). `dejar-en-ceros.mjs` comprueba y dice el
  siguiente folio.
- **H1** `operacion_desde` (hora del servidor): `mantenimiento.activar_operacion` (idempotente) y
  `quitar_bloqueo_de_operacion` (dueño, con el nombre del negocio; la auditoría guarda la fecha). Con una
  sola cuenta posterior se niegan las purgas de ventas y cortes, reiniciar pruebas/todo/folios, dejar en
  ceros y el cambio de «Primer folio». **Falla cerrada:** una fecha ilegible bloquea. Guion:
  `scripts/operacion-real.mjs`.
- **Sigue igual, a sabiendas:** una sucursal creada después de fijar el primer folio arranca en 1.

## DP-D129 · El IVA: un solo ajuste, con su comando; «Sin IVA» no se menciona · 16-11-2026

DP-21 · Bloque 1 (M9 y O1). Miguel ponía el IVA en 0 y el ticket seguía diciendo «IVA 13.79 %»: el
campo guardaba `iva_porcentaje`, que nadie leía; se cobraba con el 16 % incluido de omisión.

- **Una sola verdad:** `configuracion.valores.impuesto` (`puntosBase` 0, 800 o 1600, e
  `incluidoEnPrecio`), que lee `venta/cotizar.ts`. La escribe sólo `configuracion.fijar_impuesto`
  (dueño y administrador, con antes y después en la auditoría); el camino genérico la rechaza.
- **`iva_porcentaje` se retira:** no se lee, no se escribe, sale de `PUBLICOS` y se borra del
  documento al guardar. Una pestaña vieja que lo mande se ignora en silencio (no rompe el guardado).
- **«Sin IVA»:** `impuestos_centavos = 0` y la regla es una sola, `seMencionaElIva`: si el IVA de lo
  que se enseña es 0, el renglón no existe (cobro, precuenta, ticket, reimpresión, corte, Registros,
  Ventas, exportaciones). Contrato `venta/sin-iva.contrato.test.ts`.
- **Un negocio nuevo sigue en 16 % incluido.** En producción el valor lo guarda Miguel con su PIN.

## DP-D130 · La sesión, por puesto: quién teclea su PIN y cuánto dura · 16-11-2026

DP-21 · Bloque 2 (M14, O10 y A18). El administrador reabría la app y entraba sin PIN.

- **Mando** (dueño, administrador, gerente): cookie de sesión (sin `Max-Age`), vigencia en el
  servidor de 30 minutos que se renueva con la actividad (tope de 12 horas), y candado con PIN a los
  10 minutos sin tocar la pantalla (de 5 a 30; `configuracion.fijar_candado_de_mando`).
- **Caja** (cajero y **almacén**): cookie de sesión, 12 horas, sin renovar. El almacén no estaba en
  la tabla del encargo: entra como el cajero, que es lo más estricto de lo operativo (decisión de la
  sesión, sin Miguel).
- **Estación** (mesero y cocina): entra directo; cookie de 12 horas que se renueva con el uso (tope
  de 7 días).
- **El servidor manda:** la fila de `sesiones` (`expira_en`) es la verdad; el `exp` del token es sólo
  el tope. **La pantalla** pide el PIN a mando y caja si no trae la marca de esta ejecución
  (`sessionStorage`, sin secretos: el id del empleo); desbloquear vuelve a comprobar el PIN en el
  servidor, con sus intentos y su bloqueo.
- **Las pruebas e2e** reúsan sesiones guardadas: su arnés deja esa marca (`conElPinTecleado`), como
  la deja la pantalla de acceso. Lo que prueba el candado abre su navegador sin el arnés.

## DP-D131 · La propina se decide una sola vez · 16-11-2026

DP-21 · Bloque 4 (M11, M12 y O8). El comensal y la Caja podían elegir propinas distintas y ganaba la
última que escribía.

- **`cuenta.fijar_propina`** con la versión de la cuenta: la primera que se confirma gana; la segunda
  recibe 409 con la vigente (`datos.regla = 'PROPINA_VIGENTE'`) y decide «Usar ésa» o «Cambiarla»
  (cambiar es explícito y queda en la auditoría). El cobro manda la versión que vio.
- **La Caja** relee la cuenta cada 2.5 s y el aviso interrumpe. **El portal** se cierra solo si la
  Caja la eligió («Tu propina ya quedó registrada en caja») o si la cuenta ya se pagó (sólo cierra,
  sin mandar a calificar).
- **«¿Quién puede elegir la propina?»** (`configuracion.fijar_quien_elige_la_propina`): comensales,
  mesero y Caja; por omisión, comensales y Caja. El mesero sólo la escribe si está permitido.

## DP-D132 · La caja es un lugar con nombre; el aparato, «Aparato N» · 16-11-2026

DP-21 · Bloque 5 (M1 y O9). «Las cajas se suman (Caja 28, Caja 32…)»: el nombre era el del aparato.

- **Migración 193** (aditiva): `sesiones_caja.lugar` y un índice único parcial por lugar abierto.
  Ficha 39 en `docs/para-el-maestro/`.
- El cupo de la sucursal define los lugares; el dueño los nombra (`caja.nombrar_cajas`, en
  `configuracion.valores.nombres_de_cajas`); sin nombre, «Caja 1», «Caja 2». El lugar viaja con la
  caja al trasladarla. Una sesión anterior a la 193 se sigue llamando como su aparato.
- Las terminales nuevas nacen «Aparato N». Las «Caja N» que ya existen se renombran con
  `mantenimiento.renombrar_aparatos` (dueño de plataforma, con auditoría), que se corre al dejar en
  ceros; no en la migración.

## DP-D133 · El cajón y la voz de cocina · 16-11-2026

DP-21 · Bloques 7 y 8 (M15, M17, O16 y O17).

- **El cajón:** se abre por la impresora del aparato sólo si su perfil dice que tiene cajón
  (`tieneCajon`), con el aval del servidor (`caja/aval-del-cajon.ts`); la prueba del cajón vive en el
  laboratorio.
- **La voz:** la frase dice cuántos de cada platillo («Nuevo pedido mesa 4: dos arracheras, una
  cerveza»). Se conservó el arranque «Nuevo pedido mesa 4:»; el ejemplo del encargo decía «Mesa 4:».
  Cambiarlo es una línea (`cocina/anuncio-de-comandas.ts`). Con dos pantallas en una estación, sólo
  la que se marca como principal anuncia.

## DP-D134 · Sin app instalable; el portal, a salvo desde fuera · 16-11-2026

DP-21 · Bloque 3 (M13 y O3). El navegador ofrecía «Instalar» y abría una ventana sin barra que
confundía con las apps de verdad.

- Se quita el manifiesto y todo lo que lo anuncia (contrato `sin-instalacion.contrato.test.ts`). Las
  apps de Android y Windows siguen siendo las de `morphiq-pos-apps`.
- El portal de comensales tiene cupo de avisos por mesa y por teléfono (`portal/cupo-de-avisos.ts`):
  desde fuera no se puede inundar la sala de llamadas.

## DP-D135 · «Permitir venta sin stock» y «Usar mesas»: ni se borran ni mienten · 16-11-2026

DP-21 · Bloque 14 (M20, O2 y O11). Dos ajustes de la Configuración que parecían mandar y no mandaban.

- **«Permitir venta sin stock» (`permitir_venta_sin_stock`)**: el servidor sólo lee la opción de CADA
  PRODUCTO (`permite_venta_sin_stock`) y, desde DP-D116, lo que pasó por cocina (mesa, para llevar,
  portal) se cobra aunque no haya existencia. Una regla del negocio por encima de la del producto
  cambiaría qué se puede vender sin existencia en TODO el negocio sin que nadie lo pidiera, y
  duplicaría la regla de D116. **Decisión:** no se conecta al cobro. Se queda en Avanzado, con su
  ayuda: «manda la opción de cada producto; este interruptor no cambia lo que se cobra». No se borra;
  si Miguel quiere una regla global, es un cambio de `venta/cobrar.ts` con su prueba.
- **«Usar mesas» (`usa_mesas`)**: en un restaurante apagarlo no tiene sentido y puede romper el
  flujo. **Decisión:** se ESCONDE con el paquete restaurante (`visiblePara: 'fuera-del-restaurante'`
  en `configuracion/secciones.ts`), no se borra; fuera del restaurante sigue en Avanzado. Se eligió
  esconder y no «dejarlo en Avanzado»: el restaurante no debe ver un interruptor que lo rompe.
- **Contrato:** «cada clave que la pantalla guarda tiene quien la lee»
  (`configuracion/cada-clave-tiene-quien-la-lee.contrato.test.ts`); la única sin lector declarado es
  `permitir_venta_sin_stock`, con su razón.

## DP-D136 · El tablero suma en el servidor, por día del negocio · 16-11-2026

DP-21 · Bloque 13 (M7 y M8). «Análisis financiero» bajaba las ventas del día al navegador (con tope
de 1000) y sumaba allá con la medianoche del aparato.

- **Decisión:** `tablero.serie` agrega en el servidor (`packages/app/src/tablero/serie.ts`): por hora,
  día del negocio o mes, en centavos enteros, sin traer filas ni truncar, con la zona de la
  organización (America/Mexico_City) y las mismas reglas que el corte (`ORDEN_VENDIDA`, costo sólo de
  cuentas con costo completo, venta sin propina). La pantalla sólo pinta («¿Cómo va tu semana?»,
  `apps/web/src/tablero/ComoVaTuSemana.tsx`): barras de lunes a domingo con la semana pasada como
  referencia, Hoy por hora, Este mes por día contra el mes pasado, Este año por mes, y «Ver gastos y
  utilidad» apagado por omisión. La lectura no sabe quién la llama: Registros (H3) puede compartirla.
- **Gráfica:** la del sistema (`GraficaDeBarras`, SVG con `--grafico-n`), no recharts: se lee en claro,
  oscuro y motor viejo (sin `color-mix` en línea) y no anima nada, así que el modo ligero no tiene qué
  apagar.
- **Se quita** «Control del restaurante» (`AccesosDelDueno`, sin otro uso). `FinancialChart.jsx` queda
  en el repositorio sin usarse (su contrato de ventas sin receta sigue leyéndolo); se borra cuando
  Miguel diga.
- **Quién la ve:** dueño, administrador y gerente (los del comando), atado a la matriz de permisos.

## DP-D137 · Lo táctil: una sola decisión para el foco, el menú del sistema y el teclado · 16-11-2026

DP-21 · Bloque 9 (M2, M3, M4, M5, M16, M21 y M23; O4 a O7). Lo que Miguel vio en el iMin y en la
PC táctil: el teclado salía solo al abrir un diálogo, la pulsación larga seleccionaba texto, el
mapa se cortaba con la barra abierta y Movimientos no se dejaba desplazar.

- **El foco al abrir** (`packages/ui/src/sistema/foco-al-abrir.ts`): con puntero grueso
  (`any-pointer: coarse`) el foco se queda en el contenedor del diálogo y el teclado sale cuando la
  persona TOCA el campo. Vale para `Dialog`, `Sheet` y sus hermanas de `heredado`. El PIN tiene su
  propio teclado y no pasa por ahí (declarado en su contrato).
- **`ArmazonTactil`** se monta una vez en el armazón de las pantallas internas (el portal del
  comensal queda fuera): quita la selección y el menú del sistema en la pulsación larga (salvo en
  campos de texto), mantiene `--alto-visible` y lleva al centro el campo enfocado, una vez.
- **El mapa** (`tacto/MapaDeMesas`) escala el lienzo para que quepa, nunca agranda y respeta un piso
  de 56 px; las posiciones guardadas no se tocan. **La barra lateral** tiene botón de 44 px y
  recuerda su elección en este aparato (`mpos.barra-lateral`). **El corte** ya no enfoca nada al
  abrir y sus dos cajas miden lo mismo.
- **El scroll:** la raíz de la Caja pasa de `overflow-x-hidden` a `overflow-x-clip` (ya no es un
  scroller anidado); contrato: ninguna página de `heredado/pages` usa `overflow-x-hidden`.
- **«Salir», también con la barra plegada.** La barra del mesero y de la cocina nace plegada (lo
  pide el encargo) y los cuatro POS tienen barra fija: «Salir» sólo se pintaba desplegada y quien
  comparte el aparato tenía que abrir el menú para salir. Se decidió sin Miguel, por omisión.
- **Falta probar en aparato:** nada de esto se vio en el iMin ni en la PC táctil. Está en la lista
  de Miguel. El editor de mesas de Configuración y el plano de «Unir mesas» no se escalaron.

## DP-D138 · Cambiar de mesa sin salir del mapa · 16-11-2026

DP-21 · Bloque 10 (M24). «Cambiar de mesa» llevaba a otra pantalla. Ahora el panel de la mesa abre
ahí mismo las mesas libres (primero las de su zona; las demás, con un toque más), pregunta «¿Pasar
la cuenta de la mesa 3 a la mesa 7?» y avisa «La cuenta pasó a la mesa 7». El comando, las mesas
elegibles y quién puede mover la cuenta son los de siempre. «Unir o dividir la cuenta» es un enlace
aparte a «Mesa activa», sólo para la dirección (al mesero esa pantalla no le da dividir).

- **Sigue igual, a sabiendas:** recién abierta la mesa, el botón no aparece hasta volver a abrirla
  desde el mapa (el panel conserva la mesa como estaba al tocarla, sin quien la atiende).

## DP-D139 · Un gasto es un gasto, se registre en la Caja o en Compras · 16-11-2026

DP-21 · Bloque 11 (M22, A11 y H4). Se queda DP-D115 (el efectivo sale del cajón de la caja abierta;
sin caja abierta no se registra), pero ahora se ve.

- **Un solo catálogo** de categorías (`@morphiqpos/domain/gastos`), con contrato: ninguna pantalla
  trae su lista y la base acepta exactamente ésas.
- **De qué caja sale** lo dice el servidor (`gastos.cajon_para_pagar`, dueño, administrador y
  gerente: el cajero no ve el esperado, el conteo sigue a ciegas): «Sale del cajón de Caja
  principal», y si deja el esperado en negativo, un aviso antes de guardar que no bloquea.
- **Compras y gastos** dice «Pagado en efectivo de Caja principal» (`gastos.pagos_de_la_caja`).
- **El corte** (pantalla, PDF y papel salen del mismo documento) trae el renglón «Compras y gastos
  pagados de la caja» y la cascada del efectivo esperado. Sale de los mismos movimientos del cajón
  que el esperado: no se cuenta doble.
- **Queda fuera:** el visor heredado de cortes ya cerrados (Registros) no tiene el renglón nuevo.

## DP-D140 · El ticket a tu gusto · 16-11-2026

DP-21 · Bloque 12 (M10). Dos columnas de interruptores (precuenta y ticket de venta) en
Configuración → Ticket y folios, con vista previa en vivo sobre el mismo `PreCuentaTicket` que se
imprime. Lo guarda `caja.fijar_papel_a_tu_gusto` (dueño y administrador, con auditoría) en
`configuracion.valores.papel_a_tu_gusto`; el camino genérico lo rechaza.

- **Nunca se quitan** los platillos con su importe, el subtotal y el TOTAL. El IVA no tiene
  interruptor (sale sólo con tasa mayor que 0). Quitar el folio del ticket se permite, con su aviso.
- **Por omisión todo encendido:** el ticket de hoy no cambia ni un punto (`test:impresion`).
- **La auditoría guarda nombres apagados, no un objeto por interruptor:** el saneado redacta por
  nombre de clave y «propina» contiene «pin».

## DP-D141 · La Configuración, ordenada en secciones; cada tarjeta guarda lo suyo · 16-11-2026

DP-21 · Bloque 21. De 13 pestañas a 16 secciones en una columna (en el teléfono, la lista y luego
su página). El mapa completo está en `docs/CONFIGURACION-MAPA.md`. Nada se quitó salvo
«Integraciones» (era de demostración, con su cola de sincronización).

- **Los enlaces de antes** (`?tab=…`) caen en su sección nueva. La dirección nueva es
  `/configuracion?seccion=<id>`.
- **Cada tarjeta guarda sólo sus claves** y sólo lo que cambió; los permisos de cada tarjeta son
  los de su pestaña de antes.
- **Dos reglas que salieron al abrirla en el navegador** (`parche-de-la-seccion.ts`):
  `ponerAlDia` —al guardar una tarjeta, las demás se ponen al día SIN borrar lo que se tecleó en
  ellas— y `seToco` —«con cambios» es lo que la persona tocó, no lo que nunca se había guardado—.
- **Lo desconectado o roto** (usar mesas, vender sin existencia, texto legal) se mudó a «Avanzado»,
  plegado, con su línea «qué era». Lo decide Miguel.
- **Los textos que mandan a Configuración** («Configuración → Operación → …») nombran la sección
  de hoy; `destinos-de-los-textos.contrato.test.ts` los lee todos, también los errores del servidor.
- **`heredado/*.jsx` no pasa por lint ni tipos:** una referencia sin declarar truena al abrir la
  pantalla. El recorrido `configuracion-secciones.spec.ts` abre cada sección en tres aparatos.

## DP-D142 · Los colores del iMin se arreglan en el plugin, no pantalla por pantalla · 16-11-2026

DP-21 · Bloque 15 (M25, O12 y O13). El WebView del iMin es un Chromium 99–103. Dos cosas le
faltaban al modo compatible (`scripts/modo-compatible/`), y las dos se arreglan una vez, en el CSS
que sale del build:

- **`lab()`, `lch()`, `oklab()` y `oklch()`** (Chromium 111): la paleta de fábrica de Tailwind 4
  viene en ellos y un motor viejo deja SIN color la propiedad que la usa. El respaldo es el mismo
  valor en `rgb()`, dentro de `@supports not (color: lab(0% 0 0))`, justo después de la regla.
- **`:has(:checked)` y `:has(:focus-visible)`** (Chromium 105): la misma regla sobre una marca
  (`[data-tiene-checked]`, `[data-tiene-focus-visible]`) dentro de `@supports not selector(:has(a))`;
  la marca la pone y la quita `compatibilidad/tiene-de-respaldo.ts`.
- **El velo del PIN** ya no usa `color-mix` en línea: se arma en JS con sus canales ya calculados
  (`compatibilidad/velo-de-color.ts`).
- **Un motor moderno no entra a ningún bloque:** la galería, `test:impresion` y `verify` no cambian
  ni un pixel.
- **Cómo se prueba:** la página `/sistema` enseña cada estado (seleccionado, abierto, marcado, foco) y
  `motor-viejo.spec.ts` compara el color calculado de texto, fondo y borde en Chromium 99 y 103
  contra el Chrome de hoy. **En el iMin de verdad no se ha visto:** va en la lista de Miguel.

## DP-D143 · Lo que el servidor niega no se ofrece; lo que el corte lee, alguien lo escribe · 16-11-2026

DP-21 · Bloque 20 (lo de dinero, seguridad y datos). El inventario completo está en
`docs/reports/012-anexo-inventario.md`.

- **«Eliminar corte»** (Registros) sólo lo ve el dueño y **«Vaciar todas»** (solicitudes del portal)
  sólo dueño y administrador: lo que el comando deja. La pantalla usa el puesto REAL (`usePuesto`),
  no `posUser.rol`, que junta dueño, administrador y gerente. Un contrato ata la pantalla a la
  matriz de permisos.
- **«Mostrar costos al cajero» y la comisión de la terminal** las leía el corte y nadie las podía
  escribir: ahora tienen su tarjeta (Configuración → Caja → «El corte de la caja») y su comando,
  `caja.fijar_ajustes_del_corte` (dueño y administrador, con auditoría); el camino genérico las
  rechaza.
- **El RFC** del negocio se valida (`@morphiqpos/domain/venta/rfc`): 12 o 13 caracteres con su forma;
  vacío se permite.

## DP-D144 · El barrido visual: un piso de 44 px para el dedo, no un arreglo por botón · 16-11-2026

DP-21 · Bloque 16 (M21). Un recorrido con Playwright (`pruebas/e2e/barrido-visual.spec.ts`) mide 14
pantallas en 6 tamaños (1920×1080, 1280×800, 1366×768, 1024×768, 800×1280 y 390×844), con la barra
abierta y plegada, y con el teclado abierto (el alto visible menos 40 %) en el iMin y el teléfono.
Falla con datos: desborde horizontal, blancos de menos de 44 px, texto cortado, tarjetas de una
fila de distinto alto, campos desalineados y lo tapado.

- **El piso de 44 px** (`tacto/blancos-tactiles.css`, token `--altura-tactil`) vale sólo con dedo
  (`any-pointer: coarse`) y sólo dentro del POS (`html[data-pos-tactil]`; el portal del comensal
  queda fuera). Va en `@layer base`: quien pide a propósito un tamaño mayor lo conserva. Con ratón
  nada cambia, así que la galería no se mueve por esto.
- **Los interruptores y las casillas no se estiran:** crece su área de toque, no su dibujo.
- **Lo que sí cambia con ratón:** el nombre del negocio en dos renglones en la barra, los nombres
  de productos e ingredientes en dos renglones en vez de cortados, las tarjetas de Caja →
  Movimientos del mismo alto, y «Cantidad · Unidad · Costo» alineado (apilado en el teléfono).
- **Queda pendiente:** el tablero (8 enlaces de 32 px y un importe cortado a 1024) sólo se retrató;
  las 16 secciones de Configuración se recorren en su propia e2e, no en el barrido; y el barrido
  no corre en la CI (tarda y necesita su base): se corre a mano antes de un cambio visual.
- **Sin probar en aparato:** el teclado del barrido es el alto reducido de Playwright, no el del
  iMin. Antes y después, en `qa/dp21/barrido/`.

## DP-D145 · Sin piso global de 44 px: aplastaba las tarjetas del mesero · 16-11-2026

DP-21 · arreglo urgente del Bloque 16 (corrige DP-D144). El piso global
(`html[data-pos-tactil] :is(button, …) { min-height: 44px }`, sólo con dedo) estuvo en producción
de las 11:18 a las ~14:30 del 16-11 y se quitó.

- **Qué rompía:** con el dedo —el teléfono y también el iMin a 1280—, las tarjetas de platillos de
  «Mesas y pedidos» quedaban de 44 px: sólo el nombre, con el precio encima del borde. Don Poncho
  tiene 117 platillos; con los pocos del restaurante de prueba la rejilla no se llena y no pasa.
- **Por qué:** un `min-height` explícito sustituye al mínimo automático (`min-height: auto`), que es
  el que hace que un elemento de rejilla o de caja flexible nunca mida menos que su contenido. En
  una rejilla con desplazamiento y filas automáticas, la fila toma entonces el mínimo explícito.
  Medido con la hoja de producción: 88 px con ratón, 44 px con dedo; sin la regla, 88 px en los dos.
- **Por qué no se vio:** con ratón no pasa (la galería y la CI de escritorio), el barrido corrió con
  pocos platillos, y el simulador cubre lo que sus bots comprueban, no cómo se ve. Lo enseñó una
  captura de un incidente del simulador, comparada con la del build anterior.
- **Qué queda del Bloque 16:** las tarjetas del mismo alto, el corte sin desborde, los campos
  alineados, los nombres en dos renglones, el área de toque de interruptores y casillas (un
  pseudo-elemento, que no cambia tamaños) y el token `--altura-tactil`.
- **La regla desde ahora:** un blanco de 44 px se da por componente, con su clase
  (`any-pointer-coarse:min-h-(--altura-tactil)`), donde se sabe que el contenido cabe; nunca con un
  selector global sobre `button`. El barrido sigue midiendo los blancos, pero ya no los exige.
- **De paso, el botón «Menú» del teléfono** (Bloque 9) tapaba el número de la mesa en el panel del
  mesero: flota por encima de los diálogos y desde DP-21 es más ancho. El título del panel se
  recorre donde existe ese botón (`max-lg:pl-28`).
- **Pendiente:** dar los 44 px pantalla por pantalla, y medir con el dedo Y con el catálogo lleno
  (un barrido con los 117 platillos de Don Poncho) antes de volver a tocar tamaños globales.

## DP-D146 · DP-22 · Los candados de la cocina en un solo orden, la merma en negativo y el tope por IP · 16-11-2026

Cuatro pendientes del servidor, cada uno con su prueba antes del código y su mutante muerto.

- **H2 · Candados en el mismo orden** (A12 de la semana simulada, que se había parchado con un
  reintento). «Preparar», «Listo», «Entregado» (cuenta y para llevar), el teléfono de estación,
  quitar un platillo y cancelar la cuenta toman AHORA lo mismo y en la misma dirección
  (`restaurante/candados-de-cocina.ts`): cuenta → comandas → platos → líneas de venta, cada tramo
  por id ascendente (`order by id for update`); lo demás (`mesas`, `existencias`) después. Antes,
  «Preparar» no tomaba la cuenta y escribía comanda → platos → líneas, y quitar un platillo
  escribía línea → platos → comanda: se cruzaban. El reintento de `comando.ts` se queda como red de
  seguridad y ahora se cuenta (`reintentosPorConcurrencia()`); la prueba de 200 vueltas cruzadas
  exige cero. Descartado: quitar el reintento (un cruce con otro comando fuera de este orden
  seguiría dando 500).
- **A24 · Merma con la existencia en negativo.** Se registra (la existencia baja más y el conteo
  físico la corrige): es la misma regla que al cobrar (D116) y al cancelar (D57), y lo tirado
  tirado está. Rechazarla era un error que no ayudaba. La guarda `STOCK_INSUFICIENTE` se queda
  para una merma mayor a una existencia POSITIVA (un tecleo). La pantalla avisa por qué sigue en
  negativo. Un conteo o corrección (`inventario.ajustar`) sigue sin dejar la existencia en negativo.
- **A24 · «Valor de inventario» y valuación, la misma regla:** una existencia en negativo vale cero
  y no resta. La valuación del servidor ya lo hacía; la tarjeta restaba. Cambia la CIFRA de la
  tarjeta cuando hay negativos (sube); la tarjeta dice cuántos son. La regla vive en
  `apps/web/src/restaurante/valor-de-inventario.ts`.
- **Lo preparado no regresa; lo no preparado nunca salió.** Comprobado con Postgres para un
  producto por peso y uno por porción: cancelar sin preparar deja el almacén igual, cancelar lo
  preparado lo saca como merma «Por cancelación», y devolver una venta cobrada no repone el
  ingrediente base. El servidor ya cumplía; faltaba decirlo en pantalla (cancelar y devolver).
- **X4 · Tope por IP del laboratorio del proveedor.** Ya contaba por IP (5 intentos, 15 minutos,
  sin mirar negocio ni sesión): ahora hay prueba contra Postgres. Nuevo: el PRIMER intento que el
  tope rechaza (429) de cada ventana deja su fila `proveedor.bloquear` en la auditoría; los
  siguientes no (una persona con sesión no puede llenar la tabla golpeando el 429).
- **Sin migración.**

## DP-D147 · DP-22 · Cómo se hace la auditoría final: el mapa se genera, el arnés se prueba contra sí mismo y el dinero tiene un oráculo aparte · 16-11-2026

La última etapa antes de operar. No cambia la app: cambia con qué se le mide.

- **El mapa total se genera del código** (`scripts/qa-final/generar-matriz.mjs` → `docs/qa-final/MATRIZ.md`
  y `qa/qa-final/datos/matriz.json`): las pantallas salen de `apps/web/app`, quién abre cada una se
  le pregunta a la MISMA función que usa el armazón (`rutaPermitidaParaElPuesto`), los ajustes de
  las listas del puente y de `secciones.ts`, los comandos de la matriz de permisos y las lecturas
  del mapa del puente. A mano sólo van dos archivos de datos: `efectos.json` (qué debe cambiar cada
  ajuste y la prueba que lo demuestra) y `flujos.json`. `--verificar` falla si una clave del código
  no tiene su renglón o si una prueba citada no existe.
- **No es puerta de `verify`:** sus citas `archivo:línea` cambian con cada edición y la pondrían en
  rojo sin que nada esté mal. Se regenera en cada lote.
- **El oráculo del dinero** (`qa/qa-final/oraculo/dinero.ts`) no importa nada de `packages/`: las
  reglas están escritas otra vez, con fracciones exactas, y se prueban contra cifras hechas a mano
  y contra cuentas que producción ya cobró. Si reusara el código que cobra, sólo comprobaría que
  el código es igual a sí mismo.
- **Descartado:** escribir la matriz a mano (se queda vieja el primer día) y medir el dinero de las
  combinaciones con las funciones del dominio (no detecta un error que comparten).

## DP-D148 · DP-22 · La puerta de `heredado/`: los nombres sin declarar detienen `verify` y la CI · 16-11-2026

Lo que DP-21 dejó pendiente (informe 012 §3). Las pantallas de `apps/web/heredado` no pasan por
lint ni por tipos; un `useRef` sin importar tumbó una sección entera de Configuración y sólo se vio
al abrirla.

- **`pnpm verify:heredado`** (`scripts/verificar-heredado.mjs`), después de los tipos, en `verify` y
  en la CI: el compilador lee los 248 archivos de `heredado/` como JavaScript y sólo cuentan
  TS2304 y TS2552 («Cannot find name»). No es una revisión de tipos.
- **Los tipos mal escritos en un comentario de documentación no cuentan** (con `checkJs` el
  compilador también los lee): no corren y no truenan en el restaurante. Había uno en
  `utils/unidadesMedida.js`.
- **Se prueba contra sí misma en cada corrida:** un archivo en memoria con un `useRef` sin importar
  y otro limpio; tiene que marcar el primero y sólo ése. Si no, la puerta falla diciendo que no se
  puede fiar de sí misma.
- **Descartado:** meter `heredado/` al lint y a los tipos de verdad (son miles de diagnósticos de
  un código que no se va a reescribir; R30).
- Destructiva que FALLA: quitar el `useRef` del `import` de `pages/Recetas.jsx`. Inocua que PASA:
  el tipo mal escrito de `unidadesMedida.js`.

## DP-D149 · DP-22 · Producción se configura y se deja en ceros por guion; el día cero es un solo comando · 16-11-2026

Miguel pidió que producción quede lista sin teclear nada (Parte 11 del encargo).

- **`scripts/configurar-produccion.mjs`**: los MISMOS comandos de las pantallas, firmados por el
  dueño de plataforma como `dejar-en-ceros.mjs`, con su auditoría y sin PIN. Lee cómo está cada
  cosa y sólo manda lo que difiere (una segunda corrida no escribe); `--ensayo` no escribe; termina
  verificando. Valores: sin IVA, prefijo «DP», dos cajas («Caja 1» y «Caja 2»), el «Almacén
  principal», la propina la eligen comensales y Caja, el ticket con todos sus renglones.
- **El primer folio (1001 y 101) es un paso aparte** (`--primer-folio`), para DESPUÉS de dejar en
  ceros: el comando sólo lo acepta con los folios en cero y antes del arranque (DP-D128).
- **`pnpm dia-cero`** (`scripts/dia-cero.mjs`), para la víspera de abrir: comprueba, borra la prueba
  física si la hay, repone la configuración y el primer folio, activa el bloqueo H1 y verifica. Por
  omisión ENSAYA; `--en-serio` lo hace, y para borrar pide `--ventas <n>` igual al número que dijo
  el ensayo (quien lo corre confirma que sabe cuántas cuentas son). Se niega, sin borrar nada, con
  una caja abierta, con cuentas anteriores a `--desde`, con otro número de cuentas o si el negocio
  ya opera.
- **«Silenciar notificaciones del administrador» se queda encendido.** Las llamadas del portal las
  atienden los meseros, y sus aparatos suenan siempre; el puesto de mando conserva el aviso en
  pantalla. Se apaga en Configuración → Sonidos y avisos si la gerencia quiere oír el salón. El
  guion lo comprueba; no lo escribe.
- **El bloqueo H1 no se activa en DP-22:** la fecha de apertura no está definida y Miguel va a
  probar en físico. Lo activa `pnpm dia-cero`.
- **Ensayado en clones locales de la copia de producción** antes de tocar producción: configurar,
  repetir, el primer folio negado con cuentas, ceros, primer folio, renombrar aparatos y el día cero
  de un jalón; y los cuatro casos en que debe negarse.
- **Sin migración.**

## DP-D150 · DP-22 · Seis pendientes: el resumen y las propinas salen del servidor; el almacén compra; el cierre no pide lo que no hay · 16-11-2026

DP-22 · rama `dp-22-b19b`. Sin migración.

- **H3 · Registros, «Este año»** (`registros.resumen`, dueño, administrador y gerente): el resumen
  (ventas, costo, utilidad, propinas, compras, gastos y neto) lo suma el servidor sobre el periodo
  ENTERO, en centavos enteros, con la misma consulta de la serie del tablero (extraída a
  `tablero/sumas.ts`: reglas del corte y día del negocio) y no sobre las filas que baja el puente
  (tope de 1 000 por petición). Las listas siguen por ventanas (DP-D118) y, si se truncan, el aviso
  dice «Se muestran las N más recientes de M» (M sólo donde el servidor la sabe: compras y gastos) y
  «el resumen de arriba sí cuenta todas» sólo en las pestañas que el resumen cuenta. **Cambio de
  regla, dicho:** el resumen cuenta lo que el corte cuenta como venta (`ORDEN_VENDIDA`, también las
  devueltas en parte), no sólo `estado = 'pagada'`. La propina es la de los pagos confirmados. Los
  días viajan como fecha del calendario local del aparato y el servidor los lee en la zona del negocio.
- **A23 · Propinas por mesero** (`propinas.del_rango`): total, pendiente, liquidado y total por
  mesero del rango, sumados en el servidor sin tope; el detalle va topado a 300 y dice si hay más. Usa
  el mismo predicado que `propinas.pendientes` y `propinas.liquidar` (`condicionDelPeriodo`). Queda
  igual, y se anota: la tarjeta de propinas del Dashboard (`PropinasDashboardSection`) conserva su
  lectura topada.
- **A5 · El almacén registra compras** (`compras.registrar`, `usar_plantilla` y `guardar_plantilla`).
  **Decidido:** el almacén registra la compra, pero pagarla del cajón sigue siendo de quien lleva la
  caja (DP-D115): con «efectivo» el servidor la rechaza con su instrucción («regístrala con
  transferencia o tarjeta, o pide que la registre la gerencia») y no escribe nada. El diálogo no le
  ofrece «Efectivo» y arranca en transferencia. Los gastos siguen siendo de la gerencia.
- **A6 · El cierre no pide «no recogido» en el restaurante:** «marcar como no recogido» es de la fila
  de la barra. La regla no cambia (la caja no cierra con pedidos cobrados sin entregar); el mensaje
  del restaurante dice sólo «entrégalos o devuélvelos». Los demás giros conservan su frase.
- **A10 · «Editar receta»** (con «Imprimir ficha» y «Eliminar receta») sólo existe con el renglón
  abierto: plegado seguía en la página, a la vista del lector de pantalla y del tabulador.
- **X5 · Plazo de impresión del lado de la página:** `PLAZO_PARA_ENVIAR_MS` = 20 s de SILENCIO de la
  app (cada aviso de avance lo renueva). Vencido, la barra pasa a error con sus tres salidas y el
  reintento lleva el mismo id (la app no imprime doble); lo que la app conteste después ya no cuenta.
- **Pruebas:** `resumen-del-periodo.integracion.test.ts`, `propinas-del-rango.integracion.test.ts`,
  `compras-del-almacen.integracion.test.ts`, `cerrar-con-fila-restaurante.integracion.test.ts` y los
  unitarios y contratos junto a cada pantalla.

## DP-D151 · DP-22 · Lo que el anexo 012 y la auditoría del 16-11 dejaron por decidir · 16-11-2026

Miguel pidió decidirlo con su criterio y anotarlo (encargo DP-22, Parte 9).

- **`PUBLICOS` son tres claves:** `nombre_negocio`, `logo_url` y `background_logo_url`, lo único
  que lee el portal del comensal (`portal/lista-blanca.ts`). Las otras once (colores, fondo, moneda,
  mensaje del ticket…) y el `id` salían en la lectura pública sin que nadie las usara. Un contrato
  mide qué lee `negocioPublico` y exige que la lista sea exactamente eso.
- **Los 32 comandos sin pantalla se quedan sin pantalla,** salvo los que la revisión de «lo que
  falta» (Parte 7) pida. No se borra ninguno.
- **El crédito dice «Hecho por MORPHIQ»** y sigue saliendo sólo en la pantalla de acceso.
- **Lo de «Avanzado» se queda plegado** (DP-D135 y DP-D141), sin cambios.
- **La Caja deja de encolar «la cola de sincronización»** al cerrar: era de la integración de
  demostración que se quitó en DP-21, nadie la consumía y sus filas sólo crecían; y el cajero deja
  de ver su aviso técnico. El comando y su ruta se quedan, sin pantalla.
- **Quién anuncia las comandas.** Sin haber elegido nada en el aparato: anuncia quien entra con el
  puesto de cocina y el teléfono de cocina; los demás puestos (quien mira Cocina desde el aparato
  del dueño o de la caja) no anuncian, salvo que lo enciendan en Configuración → Este aparato. A
  una pantalla de cocina que nunca eligió se le pregunta UNA vez, sin estorbar: «¿Esta pantalla
  anuncia las comandas en voz?»; mientras no conteste, anuncia. Mientras el aparato todavía no
  sabe su puesto, anuncia: una cocina nunca se queda muda. Lo ya elegido se respeta.
  - **Descartado:** llevar en el servidor qué aparato anuncia cada estación (comando, permiso y
    estado nuevos para un caso que se resuelve con una pregunta en el aparato).
  - **Cambia lo instalado:** el aparato de un puesto que no es de cocina y que hoy habla por
    omisión deja de hacerlo hasta que lo enciendan.
  - **El timbre va con la voz** (como desde DP-21): un aparato que no anuncia tampoco suena el
    «Ping» de la comanda nueva; el aviso en pantalla sí sale. Si el timbre sonara siempre, dos
    pantallas de la misma estación seguirían oyéndose doble, que es justo lo que se quiso quitar.
    La e2e `sonidos.spec.ts` lo fija por los dos lados: la cocina suena sin elegir nada, y el
    aparato de la dueña calla hasta que lo enciende en Este aparato.
- **«Silenciar notificaciones del administrador» se queda encendido** (DP-D149).
- **`/sistema`** (el catálogo de diseño, sin sesión y sin datos del negocio) se queda como está:
  es la página con la que se comparan los colores del motor viejo (`motor-viejo.spec.ts`).
- **Sin migración.**

## DP-D152 · DP-22 · «Hoy» es el día del negocio, en el servidor y en las pantallas · 16-11-2026

Hallazgo 1 de la auditoría final (`docs/qa-final/HALLAZGOS.md`). La línea base de `verify` corrió de
noche y una prueba del tablero falló: de día pasa.

- **El defecto:** las pantallas sacaban el día de `new Date().toISOString().slice(0, 10)`, que es
  UTC. Desde las 18:00 de México «Registrar gasto», «Registrar compra» y los gastos fijos
  proponían la fecha de MAÑANA; un gasto en efectivo con esa fecha lo rechazaba el servidor (el
  cajón es el de hoy) y uno con tarjeta se guardaba en el día siguiente sin aviso. En el servidor,
  un gasto o una compra sin fecha tomaba `current_date` de la base, también UTC.
- **La regla:** el día de hoy es el del NEGOCIO, en su zona. En el navegador,
  `apps/web/src/cliente/dia-del-negocio.ts` (`hoyDelNegocio`, con `Intl` y la zona de Don Poncho:
  ni UTC ni el huso del aparato); en el servidor, `reportes/dia.ts` (la zona de la organización),
  también cuando el gasto o la compra llegan sin fecha.
- **Contrato:** ninguna pantalla de `heredado/` ni de `src/` corta un `toISOString()` a diez letras
  para saber qué día es; el único permitido es la aritmética de días de Registros, declarado.
- **`comandoConReloj`** (`produccion.ts`): el mismo envoltorio de comandos con el reloj de quien
  llama, sólo para pruebas contra Postgres que dependen de la hora. Ninguna ruta lo usa.
- **Descartado:** confiar en el huso del aparato (`format(new Date(), …)` de date-fns): una tableta
  con el huso mal puesto cambiaría de día antes o después que la caja.
- **Sin migración.**

## DP-D153 · Bloque 18 · Los PDF de los cortes quedan solos en una carpeta (app de Windows 1.0.2) · 17-11-2026

Hasta la 1.0.1 el PDF del corte se descargaba como en un navegador (a «Descargas», con el nombre que
armaba la página). Con la app de Windows 1.0.2 queda en `Documentos\POS Don Poncho\Cortes\AAAA-MM\`.

- **La app da UNA excepción al «el puente no toca archivos»:** `MorphiqApp.archivos` con dos
  funciones, `guardar({ folio, fecha, base64 })` y `abrirCarpeta()`, y la capacidad `'archivos'` en
  `MorphiqApp.capacidades`. Tres cerrojos: sólo PDF (firma `%PDF-`, tope de 20 MiB), sólo esa carpeta
  (la página NO da nombre ni ruta: la app valida folio y fecha con expresiones estrictas, arma
  `Corte-<folio>-<AAAA-MM-DD>.pdf` y comprueba que el destino quede dentro) y sólo desde el origen
  de producción (ni las pantallas internas de la app pueden llamarlas).
- **La página sólo ofrece esto si la app lo anuncia.** `archivosDeLaApp` exige el puente del contrato
  1, `capacidades` con `'archivos'` y las dos funciones. En un navegador, con la app 1.0.1 o en
  Android: descarga de siempre (la MISMA función de antes) y ningún botón nuevo.
- **Al sellar el cierre,** si la app lo anuncia y el ajuste `descargar_pdf_corte_auto` sigue
  encendido (y el cajero no lo apagó en la pantalla del restaurante), el PDF se guarda solo en la
  carpeta EN VEZ de descargarse. El cierre ya está sellado cuando eso empieza y no lo espera:
  `entregarSinEsperar` vuelve al instante y el guardado tiene un plazo de 30 s. Si falla (archivo
  abierto en otro programa, plazo, disco), la persona ve un aviso con el motivo y puede reintentar
  con «Guardar en la carpeta» o desde Registros → Cortes. **No cae a una descarga a escondidas.**
  Con el ajuste apagado no se guarda solo, como hoy.
- **Registros → Cortes:** por corte, «Guardar en la carpeta» (abre el visor y lo guarda solo, sólo
  con el corte leído entero: un PDF en ceros no es el corte) y un «Abrir carpeta» arriba; el visor
  trae los mismos botones. Texto de ayuda breve con dónde quedan los PDF. Blancos de 44 px.
- **Nombre:** folio como se lee (`DPC-0102`; sin folio o ilegible, `SF-<id de la sesión>`) y día del
  NEGOCIO del cierre (DP-D152), no el del aparato. Guardar el mismo corte otra vez no duplica: igual
  → «ya-estaba»; otro PDF del mismo corte → «reemplazado».
- **El corte de turno no genera PDF hoy** (sólo el cierre). No se inventó uno: «Guardar en la
  carpeta» sí sirve para un corte de turno ya registrado, desde Registros.
- **Descartado:** dejar que la página elija el nombre o la subcarpeta (un solo error la sacaría de
  la carpeta); una ruta configurable; un listado o borrado de archivos desde la página.
- **Sin migración.** Lógica nueva en `apps/web/src/corte/carpeta/`; `heredado/` sólo la llama
  (declarado en `scripts/aspecto-permitido.json`).

## DP-D154 · DP-22 · El barrido de servicio: los 44 px por componente, lo que el arnés no cuenta, y el aviso de por qué Cocina no suena · 17-11-2026

DP-22 · barrido táctil de las pantallas de servicio (entrada con PIN, Caja, Para llevar, mesero,
Cocina, corte y cierre) en los 14 aparatos, con `pruebas/e2e/qa-final/barrido-servicio.spec.ts`.
Arrancó con ~290 hallazgos por aparato de escritorio y ~95 en el teléfono (con el flujo cortado).

- **Los 44 px siguen dándose POR COMPONENTE (DP-D145).** Clase `any-pointer-coarse:min-h-(--altura-tactil)`
  (o `any-pointer-coarse:size-11` en cantidades y cierres) en: `Button`, `Input`, pestañas y su lista,
  la «X» del diálogo, los enlaces de la barra, «Sonido» y «Salir», el modo oscuro, las fichas de zona y
  de categoría, el − / + de la cuenta, los renglones de la comanda y los botones de Cocina. Con ratón
  nada cambia de tamaño. Ningún selector global sobre `button`: el contrato
  `apps/web/src/tacto/blancos-por-componente.contrato.test.ts` ata cada clase a su uso.
- **El botón de cerrar de los avisos** (`sonner`) gana su área de 44 px con un pseudo-elemento
  (`blancos-tactiles.css`) y mide 24 px (WCAG 2.2, 2.5.8); el texto de cada tono se oscurece
  (`avisos.css`) para pasar 4.5:1. No cambia posición, tamaño ni tiempo del aviso.
- **«Abrir caja» con `pointer-events: none` era un estado legítimo:** con la caja ya abierta el botón
  está desactivado y el motivo se ve debajo («Caja abierta desde …»). No se cambia.
- **Cocina vista desde el aparato de la dueña:** DP-D151 deja el aparato sin voz, pero la cabecera
  decía «Voz: ON». Un aviso chico (`src/cocina/AvisoDeSilencio.tsx`) lo dice y apunta a Configuración
  → Este aparato; no sale si el aparato anuncia.
- **Lo que el arnés ya no cuenta (documentado en `tocables.ts` y probado en
  `arnes.exenciones.spec.ts`, cada exención con su caso que SÍ es defecto):** (1) lo cubierto por un aviso
  transitorio (`[data-sonner-toast]`); (2) lo cubierto por una barra o botón `position: fixed` cuando lo
  de abajo está en una lista con desplazamiento o en una página que se desplaza (el carrito del teléfono,
  el botón del administrador); (3) un blanco que el desplazamiento deja ver a medias (no mide menos: se
  ve recortado). Se mide a layout (`offsetHeight`), no a transformación (`active:scale-95` aplastaba la
  tarjeta tocada), y después de que terminan las animaciones.
- **Dos defectos del arnés, no de la app:** quitar el rango del cursor (`removeAllRanges`) recolocaba el
  desplazamiento en el siguiente toque, y el dedo caía donde el blanco ya no estaba (el «7» del teclado);
  y el barrido se detenía en el primer fallo de la prueba, ahora junta la lista completa (`Barrido`).
- **Conocido y sin arreglar (bajo):** en Caja → Movimientos «Entregar el turno» y «Retirar» son dos
  tarjetas lado a lado con descripciones de distinto largo y campos de distinta altura
  (`CorteDeTurno.tsx`, `RetiroDeCaja.tsx`): sus campos no se alinean. Pide `subgrid` o igualar textos.
  El barrido lo lista como `[conocido]` y no lo da por bueno.
- **Cambia el aspecto (para los retratos de la galería de CI):** el pie del cobro de Caja (Cancelar y
  Cobrar, de alto igual al de Descuento), «Caja abierta desde…» (sin el punto medio doble), el pie de
  «Personalizar producto» (separación en el teléfono), el contador de las fichas de zona y la etiqueta
  «Opciones» (contraste), la tabla «Métodos de pago» (enfocable), Historial («Desde»/«Hasta» alineados)
  y el aviso de Cocina. Con el dedo, todo lo táctil crece a 44 px.
- **Sin migración.**

## DP-D155 · DP-22 · Fase D: el dinero combinado y los cambios a media operación · 17-11-2026

Lo que dejó probar cada combinación de ajustes (`packages/app/src/qa-final/`, tablas en
`qa/qa-final/datos/combinaciones/`) contra el oráculo independiente del dinero.

- **La parte de una cuenta dividida vale lo que `cotizar` dice AL COBRAR.** Si el dueño cambia el IVA
  entre dividir y cobrar, el total de la parte ya no es el que la madre sumaba y la base lo cierra
  con `division_cuadra`: el cobro reventaba como «Algo falló» y la parte no se podía cobrar. Ahora
  `venta.cobrar` ajusta a la madre (con su candado) cuando cambió cualquiera de los cuatro importes
  de la parte —con el IVA incluido en el precio el total queda igual y lo que se mueve es el
  impuesto—; lo que se cobra son las partes (ya era la regla de DP-D129 para el redondeo del IVA
  por parte).
- **La regla del IVA a media operación, escrita:** la cuenta toma la tasa VIGENTE AL COBRAR. Cobrar
  con el total de una precuenta vieja se rechaza (`TOTAL_DESACTUALIZADO`) y la Caja relee; una parte
  ya cobrada conserva SU tasa y las que faltan toman la vigente (cada parte es una venta).
- **La propina por porcentaje se calcula en centavos enteros** (`propinaPorPorcentaje`, medio centavo
  hacia arriba, como el servidor) en el diálogo de la Caja y en el del portal. Antes era punto
  flotante sobre pesos: $28,771.50 al 15 % daba $4,315.72 y el servidor $4,315.73.
- **Un precio que cambia no toca lo ya pedido:** la línea guarda el precio con que se pidió; lo que se
  pide después entra al nuevo.
- **Lo que la Fase D dejó a la vista y cómo se decidió (el encargo pide decidir sin preguntar):**
  1. El cambio de PIN de alguien con la sesión abierta NO revocaba esa sesión (vivía hasta vencer).
     **Se arregla** (hallazgo 10): cambiarle el PIN a OTRA persona cierra sus sesiones; cambiar el
     propio no cierra la sesión con la que se está cambiando.
  2. `venta.cobrar` acepta la propina que le manden aunque nadie tenga permiso de elegirla (sólo
     `cuenta.fijar_propina` lo hace valer). **No se cambia antes de abrir** (hallazgo 11): la
     propina que llega al cobro puede venir fijada por el comensal o el mesero, y endurecer el
     cobro arriesga más un cobro legítimo de lo que protege. Va a la lista de después.
  3. El rechazo `TOTAL_DESACTUALIZADO` no trae el total vigente aunque su comentario lo promete
     (hallazgo 12, bajo): se ve en la Caja con el arnés y se arregla si la cajera se queda sin
     saber cuánto cobrar.
  4. No hay descuento por renglón en el restaurante (sólo a la cuenta, repartido entre renglones)
     ni «partes iguales» de dinero (sólo por unidades de cada renglón). **Se queda así:** son
     reglas de dinero y no se cambian en la víspera; van a la lista de lo grande para después.
- **Sin migración.**

## DP-D156 · DP-22 · «Pasar la mesa a otro mesero»: una mesa, y la asignación viaja con ella · 17-11-2026

`restaurante.relevar_responsable` (F-325) existía sin pantalla y relevaba TODAS las cuentas vivas del
que se va. Lo que se decidió al darle su pantalla:

- **Una mesa, no un turno.** El comando acepta un `ordenId` opcional: con él sólo pasa esa cuenta (y
  su mesa); sin él sigue relevando todas las del que se va (el fin de turno, que sigue sin pantalla).
  La cuenta tiene que ser de quien se va; si otra pantalla ya la pasó (o se cerró) se rechaza con
  `ORDEN_NO_ENCONTRADA` y no escribe nada. La lectura de las cuentas toma su candado (`for update`,
  por id): dos pantallas que pasan la misma mesa a la vez se esperan.
- **La asignación de sala viaja con la mesa.** Con la asignación de mesas activa el plano y el panel
  del mesero se filtran por `mesas.empleado_asignado_id`, no por quién atiende; relevar sólo cambiaba
  lo segundo y la mesa seguía en el plano del que se fue y no aparecía en el de quien entró. Ahora la
  mesa asignada al que se va queda asignada al que entra; una asignada a un tercero o a nadie no se
  toca. También en el relevo de turno.
- **Quién la ve: exactamente quien el comando deja** (gerente, administrador, dueño y cajero; en la
  sesión, `administrador` y `caja`). No se inventó ningún permiso: un contrato compara los puestos
  del botón con los del comando. El mesero no (relevar es de quien manda el turno).
- **Dónde:** «Pasar la mesa a otro mesero» en las acciones de la mesa (`AccionesDeLaMesa`, de «Mesa
  activa»), sólo si la mesa tiene a quien la atienda. Elige entre los meseros ACTIVOS (menos el
  actual), confirma con la frase «¿Pasar la mesa 4 de Ana a Beto?», refresca el plano y la mesa y avisa.
- **Auditoría:** el comando ya audita quién sale, quién entra, cuántas cuentas y el consumo
  relevado; ahora también el `ordenId`. El corte queda en `relevos_atencion` (el tramo de quien se va
  se cierra con el consumo de ese momento; el de quien entra se abre).
- **Pruebas:** `relevo.integracion.test.ts` (13, contra Postgres), `pasar-la-mesa.test.ts` y
  `pasar-la-mesa.contrato.test.ts`. Mutantes muertos: sin el filtro de la cuenta, sin la asignación,
  con el mesero entre los roles, sin invalidar el plano, sin la guarda del botón.
- **Sin migración.**

## DP-D157 · DP-22 · El teléfono opcional del pedido para llevar · 17-11-2026

La cajera puede teclear, junto al nombre, el teléfono del cliente del pedido para llevar, para
llamarle cuando está listo.

- **Dónde se guarda:** una columna nueva, `ordenes.telefono_pedido` (migración 194, aditiva, con su
  `check` y su ficha `docs/para-el-maestro/40-telefono-del-pedido-para-llevar.md`), junto a
  `nombre_pedido`. Descartado: `cliente_nombre`/el padrón de clientes (el mismo motivo de la 081:
  nombres y números sueltos ensuciarían la base de la lealtad) y las notas de la orden (no se pueden
  validar ni mostrar aparte).
- **Qué se acepta** (`normalizarTelefonoDelPedido`, `packages/domain/src/venta`): sólo dígitos,
  espacios, guiones y un «+» al inicio; de 7 a 15 dígitos y hasta 20 caracteres. Se limpia (espacios
  de más) y vacío es «sin teléfono». El SERVIDOR valida (`armar_para_llevar`; rechazo
  `ENTRADA_INVALIDA` con el motivo), la pantalla usa la misma regla para avisar antes de enviar y el
  `check` de la base es la última red.
- **Cada armado sella nombre y teléfono** (con o sin él) y descartar el pedido los borra: rearmar el
  borrador sin teléfono no arrastra el del pedido anterior. En el aparato viaja con el borrador (como
  el nombre) y se va con él al vaciar o al cobrar.
- **Dónde se ve:** sólo en la lista de «Para llevar» de la Caja (`para_llevar_del_dia`, tarjetas de
  lo listo y de lo que sigue en cocina). **NO sale en el ticket del cliente:** el ticket (`venta.ticket`)
  trae el renglón «PARA LLEVAR · N · nombre» —el nombre sí sale—, y se decidió que el teléfono no: es un
  dato para la caja, el papel lo puede dejar cualquiera en el mostrador. Tampoco en cocina, ni en el
  puente de datos (`Venta`), ni en la auditoría (ésta sólo dice `conTelefono`).
- **Pruebas:** `telefono-para-llevar.integracion.test.ts` (14, contra Postgres),
  `telefono-del-pedido.test.ts` (dominio, 23) y `para-llevar/telefono-del-pedido.test.ts` (pantalla).

## DP-D158 · DP-22 · La comanda se ajusta al quitar un platillo; el Dashboard y la prueba del laboratorio · 17-11-2026

- **Hallazgo 7.** Quitar un platillo (`restaurante.anular_linea`) sólo cancelaba la comanda sin platos
  vivos: con dos platos —uno ya «listo» y otro por preparar— y el segundo quitado, la comanda seguía
  en «nuevo», la mesa no pasaba a «Esperando entrega» y el mesero no recibía el aviso. Ahora, tras
  anular, cada comanda viva de esa línea se ajusta al mínimo de sus platos y, si cambió, sigue el MISMO
  cierre que cuando la estación mueve un plato (`cerrarElMovimiento`: lo ya cobrado, las líneas y la
  mesa). Si el estado no cambia (el vivo sigue pendiente, o sólo se redujo una cantidad) no escribe
  nada. No toma candados nuevos: va con el orden de `candados-de-cocina.ts`. Prueba:
  `anular-platillo-comanda-lista.integracion.test.ts`; `candados-de-cocina.integracion.test.ts` sigue
  en verde con 0 reintentos.
- **Propinas del Dashboard.** La tarjeta suma en el servidor (`propinas.del_rango`: hoy, los últimos
  siete días y 364 días) y no en el navegador sobre las últimas 2 000 ventas. **Cambia lo que dicen
  «Pendientes» y «Liquidadas»:** antes eran «de las últimas 2 000 ventas», ahora son las del último
  año (364 días, que cabe en el tope del servidor aun con un cambio de horario). Si el servidor no
  contesta la tarjeta lo dice en lugar de esconderse.
- **Prueba de impresión del laboratorio** con plazo: el mismo `PLAZO_PARA_ENVIAR_MS` (20 s de silencio,
  cada aviso de avance lo renueva) que los trabajos de la Caja; vencido, dice «La impresora no
  contestó en 20 s…». Si la primera prueba llega tarde saldrá dos veces (cada prueba lleva su id).
- **Migración:** la de DP-D157 (la 194); esto no añade ninguna.

## DP-D159 · DP-22 · El aviso de insumo bajo: la cuenta sale del servidor y el toque lleva a Inventario filtrado · 17-11-2026

**Contexto.** Inventario ordena por semáforo (agotado, crítico, bajo), pero fuera de esa pantalla nadie se
enteraba: el Tablero tenía una tarjeta «Inventario crítico» que contaba una lista de ingredientes bajada
al navegador (que el puente puede cortar) y no llevaba a ningún lado.

**Decisión.**

- **Comando de lectura `inventario.insumos_bajos`** (`packages/app/src/inventario/insumos-bajos.ts`, ruta
  `POST /api/inventario/insumos-bajos`). Roles: los que leen Inventario (`dueno`, `administrador`,
  `gerente`, `almacen`), paquetes operativos y módulo `inventario`. Cuenta sobre TODOS los insumos
  activos con la existencia de la vista `existencias_por_insumo` (la suma de todos los almacenes) y
  devuelve `{ total, primeros[3] }`: los primeros, del más urgente al menos (crítico antes que bajo; dentro
  de cada nivel, la menor cobertura = existencia ÷ mínimo; a igualdad, el nombre).
- **La regla es `alertasDeMinimo` del dominio** (la que ya existía, sin uso): un piso en cero es «no lo
  vigiles»; con piso (o con piso crítico) cuenta lo que está EN el piso o por debajo, y lo agotado o en
  negativo (DP-D116) cuenta siempre que tenga piso. Un insumo agotado SIN piso no cuenta como «por debajo
  de su mínimo» (no tiene mínimo): sigue saliendo en el semáforo como «Agotado».
- **Tarjeta en el Tablero** (`AvisoDeInsumosBajos`): «N insumos por debajo de su mínimo», los primeros
  nombres («Carne, Crema, Pan y 4 más»), 44 px de alto, y un toque que lleva a
  `/inventario?estado=alerta`. Sin insumos bajos no aparece; si no se pudo leer lo dice. Sustituye a la
  tarjeta «Inventario crítico». Quién la ve: el Tablero sólo lo abren dueño, administrador y gerente
  (el almacén entra directo a Inventario, donde ya ve el semáforo); el comando también lo lee el almacén.
- **Inventario** entiende `?estado=alerta` y tiene el filtro «Por debajo del mínimo», con la MISMA regla
  (`estaPorDebajoDelMinimo`, atada por una prueba de cuadrícula a `alertasDeMinimo`): la lista que se abre
  es la que se contó.

**Lo que el trabajo encontró (y quedó arreglado, DP-D161):** `alertasDeMinimo` lanzaba
`CANTIDAD_INVALIDA` con una existencia en negativo (`cantidad()` no acepta signo) — justo el caso que
DP-D116 vuelve legal.

**Pruebas.** Integración contra Postgres (11): activos, suma de almacenes, piso en cero, en el piso,
negativo, sin fila de existencias, más de mil insumos sin tope, otro negocio, permisos. Unitarias: el
texto de la tarjeta, la cuadrícula contra el dominio y el filtro de la URL. Mutantes en el informe.

## DP-D160 · DP-22 · «Lo más vendido» en Registros: por platillo y por mesero, sumado en el servidor · 17-11-2026

**Decisión.** Las ventas por platillo sólo existían como exportación. Ahora Registros tiene, bajo el
resumen del periodo, la sección «Lo más vendido» (Por platillo | Por mesero).

- **Comando de lectura `registros.lo_mas_vendido`** (`packages/app/src/registros/lo-mas-vendido.ts`, ruta
  `POST /api/registros/lo-mas-vendido`), al estilo de `registros.resumen`: mismos roles (`dueno`,
  `administrador`, `gerente`) y paquetes, mismo periodo (`desde`/`hasta`), el día del NEGOCIO (la zona de
  la organización), sin tope de filas, todo en centavos enteros.
- **Qué cuenta:** líneas no anuladas de cuentas vendidas (`ORDEN_VENDIDA`: lo cancelado y la cuenta madre
  de una división no cuentan; la devuelta entera sigue siendo venta de su día). Lo que se vende por peso
  cuenta sus KILOS, no la pieza de la línea.
- **Las devoluciones restan en el día en que se hicieron** (como el corte: «el histórico no se toca»). Cada
  platillo trae lo vendido, lo devuelto y lo que dejó (neto); la lista va ordenada por el neto. Un platillo
  vendido antes del periodo y devuelto dentro sale con venta cero y neto negativo.
- **Cómo cuadra con el resumen:** `cuentas.ventasCentavos` es la venta del resumen, al centavo; la venta
  por platillo (`vendidoCentavos`, SIN restar devoluciones) más lo que no es platillo
  (`cuentas.ajusteCentavos`: el descuento y los impuestos de la CUENTA) es esa venta. La pantalla lo dice
  en su pie. La venta de los meseros suma la del resumen y su propina suma la propina del resumen.
- **Por mesero:** cuentas, venta (el total de la cuenta, sin propina) y propina confirmada, quien atendió
  la cuenta; «Sin mesero» si no hay quien.
- **Pantalla:** 44 px en los botones, los 10 primeros con «Ver los N», aviso si no se pudo leer. El
  navegador no suma dinero: sólo lo dice (`lo-mas-vendido-del-servidor.ts`).

**Pruebas.** Armado puro (7), integración contra Postgres (16: cuentas anuladas, canceladas, divididas,
por peso, devueltas, día del negocio en el borde 23:59/00:00, más de mil líneas, otro negocio, permisos,
entrada) y presentación (5). Mutantes en el informe.

## DP-D161 · DP-22 · `alertasDeMinimo` ve la existencia en negativo · 17-11-2026

`alertasDeMinimo` (dominio, F-107) usaba `cantidad()` para la existencia, que no acepta signo: una
existencia en negativo —legal desde DP-D116— lanzaba `CANTIDAD_INVALIDA`. Nadie la llamaba, por eso no se
había visto; el aviso de insumo bajo (DP-D159) la usa. Ahora la existencia se lee con signo
(`existenciaConSigno`) y un negativo alerta (crítico si hay piso crítico, bajo si no). Prueba primero
(falló con el error) y mutante (volver a `cantidad`).

## DP-D162 · DP-22 · La app de Windows 1.0.2: cómo se publicó, qué se comprobó y qué no se puede probar aquí · 17-11-2026

- **El orden de la publicación.** Primero el lado POS en producción (lote 2), después la app: release
  `don-poncho-v1.0.2` con el instalador y su `SHA256SUMS.txt`; al canal `canal-don-poncho` el
  instalador y su `.blockmap`, y AL FINAL `latest.yml`, que es lo que hace que las apps instaladas
  la vean. Antes de publicar: las pruebas de la app, el instalador construido del commit unido y la
  prueba de humo sobre la app YA EMPAQUETADA (con sus fuses), que carga el POS de producción.
- **Sólo Windows.** Android sigue en la 1.0.1. `version.json` es compartido y ya dice 1.0.2: el
  siguiente APK que se construya saldrá como 1.0.2 (versionCode 4) sin la capacidad de archivos, que
  es sólo de Windows. La página de descargas resuelve cada plataforma por separado desde el canal
  (`latest.yml` y `android.json`), así que el enlace del APK no se rompe.
- **La actualización se comprobó en la laptop por los dos caminos**, con la 1.0.1 publicada (misma
  suma) instalada y abierta desde el Explorador: «Reiniciar ahora» instala y vuelve a abrir la app
  sola; «Al cerrar» instala al cerrar la app. El aviso dice la versión.
- **El POS dentro de Electron contra el servidor local NO se prueba.** La app sólo le da el puente a
  `https://` y al dominio exacto de producción (`origen.js`), y así se queda: abrirle la puerta a
  `localhost` para probar sería debilitar justo el cerrojo que protege al cajón y a la impresora.
  - **En su lugar:** el arnés táctil corre con Chrome 156, la misma versión mayor que trae Electron
    45, y la app empaquetada pasa su humo contra producción.
- **Guardar el PDF de un corte de punta a punta en la app instalada no se probó:** haría falta
  cerrar una caja en producción con un PIN real, y eso no lo hace un agente. Las dos mitades sí
  están probadas por separado (la app guarda, rechaza y no se sale de su carpeta; el POS detecta la
  capacidad, arma el nombre y no retrasa el cierre). Queda en la lista física de Miguel: tras el
  primer cierre real, ver el PDF en `Documentos\POS Don Poncho\Cortes`.

## DP-D163 · Los ajustes de Configuración tienen que demostrar su efecto (DP-22, 17-nov-2026)

- **Decisión:** cada ajuste de Configuración se da por comprobado sólo con una prueba que se haya visto
  fallar al romper su lector (mutante). El papel se prueba contra el componente real del ticket y del
  corte (`pruebas/impresion/ajustes-del-papel.spec.ts`), las copias por el camino de producción con la
  app falsa (`copias-por-la-app.spec.ts`), el portal en servidor (`ajustes-del-portal.integracion.test.ts`)
  y en el teléfono, y lo de cada aparato con el dedo (`pruebas/e2e/qa-final/ajustes.*.spec.ts`).
  `efectos.json` dice por cada clave su prueba y su estado; lo que no quedó, queda como «por ver».
- **Sin migración.**

## DP-D164 · Lo que el acceso y «Mostrar productos sin imagen» NO hacen (DP-22)

- **Hallazgos que se declaran, no se cambian en la víspera:** (1) el acceso (pantalla del PIN, sin sesión)
  no lee `color_primario`, `color_acento`, `nombre_sistema` ni los logos: la configuración exige sesión y
  los colores no son públicos a propósito (`lo-publico.test.ts`); sólo el nombre sale de la lista de
  personas. Los ajustes valen para el sistema interno. (2) `portal_qr_mostrar_sin_imagen` sólo gobierna el
  menú «A la carta»; en «Menú digital» (el de siempre) no hace nada. **Se queda así** hasta que Miguel
  decida: esconder la casilla en «Menú digital» o hacerla valer.
- **Sin migración.**

## DP-D165 · DP-22 · El costo de un insumo se guarda EXACTO y se redondea una sola vez · 17-11-2026

**Es una regla de dinero** (hallazgo 14 de la auditoría, ALTO). El costo por unidad base —el gramo, el
mililitro, la pieza— vivía en centavos ENTEROS (`insumos.costo_unitario_centavos`, copiado en cada
movimiento del kardex). La leche a $480.00 los 20 L son 2.4 ¢/ml y quedaba en 2 (−16.7 %); el maíz a
4.5 ¢/g, en 5 (+11 %); con siete compras que sumaban $11,570.50, «Valor de inventario» decía $11,552.00.
Lo falseaban el valor del inventario, el costo de cada receta, la merma y el margen de cada platillo.

- **Qué se guarda.** Una columna hermana, `costo_exacto_dmc`: el costo por unidad base en
  DIEZMILÉSIMAS DE CENTAVO (`bigint` ≥ 0; 2.4 ¢/ml = 24 000, 4.5 ¢/g = 45 000), la misma escala de cuatro
  decimales de las cantidades. En `insumos` (el vigente: el promedio ponderado), en `movimientos_stock`
  (el que tenía el insumo al moverse) y en `valuacion_lineas` (con el que se valuó). **Migración 195**,
  aditiva, con su ficha (`docs/para-el-maestro/41-costo-exacto-del-insumo.md`).
- **Con qué precisión.** Una diezmilésima de centavo por unidad base. `costo_unitario_centavos` SE
  QUEDA, no se quita de ningún sitio, y es el exacto redondeado al centavo (medio centavo hacia arriba):
  un `check` por tabla lo exige y un disparador completa la columna que no se escribió (quien sólo
  conoce los centavos deja el exacto en centavos × 10 000). Dos columnas que se contradicen no se pueden
  guardar. El relleno de lo que ya existe es `centavos × 10 000` (lo que esas filas siempre valieron).
- **Dónde se redondea: UNA sola vez, a centavos, al final.**
  - Valor de cantidad × costo = `round(cantidad × exacto / 10 000)`: valuación (dominio
    `valuarInventario`, comando `inventario.valuar`, que además guarda el exacto de cada renglón, y la
    vista `existencias_por_insumo`), kardex, `descuentos_inventario_venta`, `merma_barra_turno`, el
    corte (insumos consumidos y salidas sin venta), el consumo de la casa (suma sobre todos los insumos
    y un redondeo) y la reposición sugerida.
  - El costo de una receta es la SUMA de sus líneas (cantidad × merma × costo exacto) redondeada una vez
    (`recalcularCostosRecetas`): dos líneas de 2.5 ¢ cuestan 5 ¢, no 6. El costo por pieza del
    platillo sigue en centavos enteros. La pantalla (`economiaDelPlatillo`) suma las líneas sin
    redondear cada una y redondea el total, y el puente sirve el importe de la línea sin redondear al
    centavo.
  - El costo promedio ponderado, sobre el exacto: `(existencia × exacto_anterior + total × 10⁸) /
    (existencia + entrante)`, UNA división y UN redondeo (a la diezmilésima). Una existencia en negativo
    cuenta como cero (DP-D116).
- **La tolerancia (di cuál y por qué).** Guardar el promedio redondeado a una diezmilésima por unidad
  deja un error de a lo más Q/20 000 ¢ con Q unidades en el almacén, que se arrastra de una compra a la
  siguiente: `|valor − comprado| ≤ ⌊Σ Q_k/20 000 + ½⌋` ¢ (Q_k: la existencia tras la compra k).
  Consecuencias: una compra de menos de 10 000 unidades base (10 kg, 10 L) vale EXACTAMENTE lo que costó;
  la leche de 20 L y el maíz de 12 kg, también (2.4 y 4.5 son exactos); las siete compras de la prueba
  suman al centavo. Con un mismo insumo comprado varias veces sin consumirse, el valor puede alejarse
  unos centavos (simulación de 200 000 casos: ≤ 5 kg y hasta 6 compras, máximo 3 ¢; compras sueltas de
  hasta 10 kg, 0 ¢). No se cierra más sin guardar el total de lo comprado: si algún día importa,
  guardar el costo en millonésimas.
- **La pantalla.** «Valor de inventario» y el costo del ingrediente salen de lo exacto: el puente lo sirve
  con todos sus decimales (conversión nueva `dinero_fino`, `0.024` pesos el ml; no entra a `centavosDe`
  porque redondearlo a centavos es el defecto) y la tarjeta redondea UNA vez el valor de cada
  ingrediente. «$0.024/ml» confunde y «$0.02/ml» miente: Inventario, el selector de ingredientes y la
  receta lo enseñan **por kilo y por litro** («$45.00/kg», «$24.00/L»), con sub-centavos sólo en piezas
  («$0.998/pieza»). Un insumo de menos de medio centavo por unidad (la sal) ya no sale «sin costo».
- **Dos cosas que cambian y se dicen.** (1) La vista `existencias_por_insumo` ya cuenta una existencia
  en NEGATIVO como cero, como lo hacían la valuación guardada y la tarjeta (antes restaba, sólo la
  leía el valor por renglón de Inventario). (2) La nota del proveedor compara el precio nuevo contra el
  costo EXACTO del insumo (con el de centavos la leche salía 20 % «más cara» de lo que subió).
- **Lo que NO cambia.** Los precios de venta, los totales de las cuentas, el corte (sus totales), las
  propinas, el costo por pieza de un platillo como dato (centavos enteros), las unidades base del
  restaurante y el costo capturado a mano (`crear_insumo`, `actualizar_costo`: centavos por unidad base;
  el exacto sale de las compras).
- **Lo que se dejó con el redondeado, a propósito:** los renglones del corte que sólo MUESTRAN un costo
  unitario (alertas de insumo bajo), `costo_compra_default_centavos` (el costo por unidad de COMPRA: una
  caja, un kilo, no se multiplica por gramos) y todo lo de `productos` y `orden_lineas` (costo por pieza
  de venta).
- **Pruebas.** Integración contra Postgres: `costo-exacto.integracion.test.ts` (8) y
  `costo-exacto-migracion.integracion.test.ts` (6). Propiedad con `fast-check`:
  `costo-exacto.propiedad.test.ts`. Mutantes (todos muertos) en el informe: costo redondeado antes de
  multiplicar, redondeo doble, migración sin relleno y promedio sin ponderar.
- **Encontrado, NO arreglado (fuera de esta decisión):** `inventario.consumo_interno` nunca se había
  corrido contra Postgres y falla ahí: su salida `salida_consumo_interno` exige un `motivo` (el `check`
  `movimiento_stock_salida_con_motivo` y la llave a `motivos_merma`) y `aplicarMovimientos` no lo escribe.
  Y `inventario.registrar_merma`, el traspaso y la devolución escriben el movimiento SIN costo (queda en
  su cero de omisión), así que esa merma sale a $0 en el kardex y en el corte; la que copia el costo es la
  de cancelación, el ajuste y el cobro.

## DP-D166 · «Mostrar productos sin imagen» vale en los dos menús (DP-22, tanda 2)

- **Decisión:** `portal_qr_mostrar_sin_imagen` gobierna el menú digital y el menú «A la carta»: apagada, los
  platillos sin foto no salen en el portal en ninguno; encendida (o sin elegir, como la tiene Don Poncho), salen
  todos y nada cambia. Una sola función (`productosSegunLaFoto`, `menu-digital.ts`) la aplica en los dos.
- **Aclaración a DP-D164:** el acceso (sin sesión) sigue sin leer colores, nombre del sistema ni logos, a
  propósito; el texto de efecto y la ayuda en pantalla ahora lo dicen (se aplican dentro, con sesión).
- **Sin migración.**

## DP-D167 · DP-22 · Cada movimiento del kardex lleva el costo exacto del insumo al moverse; el consumo de la casa por fin escribe su motivo · 17-11-2026

**Es una regla de dinero** (los dos defectos que dejó anotados DP-D165, ahora arreglados).

- **Qué estaba mal.** `inventario.registrar_merma` (la merma manual), `inventario.enviar_traspaso` y
  `recibir_traspaso`, y la devolución de una venta (`regresarAlInventario`) escribían el movimiento SIN
  costo: la columna se quedaba en su cero de omisión y la merma de 2 kg de barbacoa salía a $0 en el
  kardex y en el corte. La merma por cancelación, el ajuste y el cobro ya copiaban el costo.
  `inventario.consumo_interno` nunca se había corrido contra Postgres y ahí fallaba siempre: su salida
  exige un `motivo` (`movimiento_stock_salida_con_motivo` y la llave a `motivos_merma`) y
  `aplicarMovimientos` no lo escribía.
- **Qué se hace.** Cada uno copia, AL MOVERSE, `costo_unitario_centavos` y `costo_exacto_dmc` del insumo
  (`repoStock.costoDelInsumo`; `regresarAlInventario` lo hace en su propio `insert`). El importe del
  kardex y del corte sale de `cantidad × costo exacto`, redondeado UNA vez a centavos (DP-D165). 2 kg de
  un insumo a 3.4567 ¢/g valen 6 913 ¢, no $0.
- **El consumo de la casa y su motivo.** `MovimientoPlaneado` gana `motivo` y `nota` opcionales y
  `aplicarMovimientos` los escribe. `motivos_merma` es un catálogo GLOBAL (no se siembra una clave por
  negocio, como ya dijo la cancelación), así que cada tipo usa una clave que ya existe:
  `personal` → `consumo_personal`, `cortesia` y `degustacion` → `muestra`, `reposicion` →
  `platillo_rehecho`. Lo que el gerente escribió va en la nota del movimiento. Ninguna pantalla de Don
  Poncho llama a este comando (sólo existe su ruta `/api/inventario/consumo-interno`): queda arreglado y
  sin pantalla, que es una decisión de producto aparte.
- **Lo que NO se reescribe.** Los movimientos que ya existen sin costo son historia y se quedan como
  están (sólo hay algo así en copias de QA; producción tenía 0 insumos cuando se escribió DP-D165). Un
  traspaso valúa la entrada con el costo del insumo al RECIBIR, no al enviar; la devolución, con el costo
  de HOY (no con el de la venta): la diferencia, cuando hay, es del tamaño de un cambio de costo entre
  los dos días.
- **Pruebas.** `costo-de-los-movimientos.integracion.test.ts` (4, contra Postgres: la merma, el traspaso
  de salida y entrada, la devolución y el consumo interno), y la unitaria de `consumo-interno.test.ts`.
  Mutantes muertos: merma sin costo, la entrada del traspaso sin costo, el regreso de la devolución con
  costo 0 y el consumo sin motivo; mutación inocua (la nota a 199 caracteres) que pasa.

## DP-D168 · DP-22 · Con el cobro abierto, la Caja también se relee cuando la caja ya había elegido la propina y la cuenta cambió · 17-11-2026

Hallazgo 12 (la prueba en el navegador). Con el cobro de una mesa abierto, el mesero NO puede agregar
platillos (`ORDEN_NO_EDITABLE`: la cuenta pedida ya no es editable, a propósito); lo que sí puede, con el
PIN de un gerente, es quitar uno. Con la propina decidida por la caja («Sin propina») el servidor rechaza
el cobro con `CONFLICTO_ESTADO` / `PROPINA_VIGENTE`, no con `TOTAL_DESACTUALIZADO`, y la Caja sólo releía
con el segundo: el aviso salía pero la pantalla seguía con el renglón quitado, el total viejo y lo
tecleado, y «Cobrar» fallaba igual cada vez. Ahora se relee con cualquiera de los dos (`Caja.jsx`).
Contrato: `total-que-cambio.contrato.test.ts` (4) con tres mutantes. Prueba en el navegador:
`qa/simulador/parte5/total-que-cambio.ts`.

## DP-D169 · DP-22 · Hallazgo 16 (la receta de las opciones de un platillo): NO se construye en este lote; el diseño · 17-11-2026

El dominio (`recetaConOpciones`) y la base (084: `recetas.sustituible_por_grupo_id`,
`modificador_opciones.insumo_sustituto_id` y `factor_cantidad`) ya soportan que una opción sustituya un
insumo o escale la receta, y `cobrar` los usa (`efectosDeOpcionesPorLinea`). Lo que falta es capturarlo, y
son DOS pantallas y dos comandos: (1) el editor de opciones del platillo
(`OpcionesDelPlatilloDialog.tsx` + `grupos-de-opciones.ts`, que hoy no acepta ni el sustituto ni el
factor) y (2) el editor de la receta (`RecetaFormDialog.jsx`, heredada: cada renglón necesita «un grupo
de opciones lo puede cambiar», que `guardarReceta` ya acepta). Es más de una pantalla y toca el
contrato de dos comandos: se reporta, no se construye. Diseño: en cada opción, «Cambia la receta» con
(a) «Cambia un insumo por otro» (insumo, de la misma dimensión: el dominio no inventa conversiones) y
(b) «Cambia las cantidades» (factor, con la vista previa de «1.44× lo que lleva»); en cada renglón de la
receta, «Lo puede cambiar el grupo…». Ayuda breve en pantalla, blancos de 44 px, prueba de integración
(vender la opción baja lo que dice su receta, al gramo) y con el dedo, y la validación de dimensiones al
guardar (hoy una configuración incompatible se ignora en silencio al cobrar).

## DP-D170 · DP-22 · Hallazgos 13 y 17: lo que se encontró · 17-11-2026

- **13 (no se pudo reproducir).** Con el dedo (`tap` de Playwright y el `Input.dispatchTouchEvent` del
  arnés), en tableta 800×1280, Windows 1366×768 al 125 % y 1024×768 (y con la ventana a 1093×614), todos
  los desplegables de «Nueva receta» (categoría, tipo de venta y los tres de «Variable por medida») y de
  «Registrar compra → Nuevo» se abren y eligen, con la opción dentro de la ventana. La guarda queda como
  `qa/simulador/parte5/desplegables-con-dedo.ts`. No se cambió código: no hay defecto que reproducir en
  esta versión.
- **17 (falso positivo de la exploración).** El interruptor «Modo espera en este aparato» SÍ tiene nombre
  accesible (`aria-labelledby` al título de su tarjeta; `getByRole('switch', { name })` lo encuentra): la
  exploración sólo leía `aria-label`. Queda `interruptores-con-nombre.contrato.test.ts` para que no se
  pierda, con la lista de todos los interruptores de Configuración. Lo que SÍ es real y queda abierto: el
  interruptor mide 32×18 px (blanco táctil de 44 px incumplido, en la primitiva compartida `Switch`).

## DP-D171 · DP-22 · «Merma / producto perdido» de Inventario → Ajustar graba una MERMA, con su motivo del catálogo · 17-11-2026

Hallazgo A de la Parte 5. La pantalla mandaba la merma a `inventario.ajustar` con `ajuste_conteo` y el
movimiento quedaba como `ajuste`: el corte (que sólo cuenta `merma` y `salida_consumo_interno`) y los
reportes de merma no la veían. Ahora `inventario.ajustar` acepta `tipo: 'ajuste' | 'merma'` (por omisión
`ajuste`, así que el conteo físico y lo ya escrito no cambian) y con `merma` graba un movimiento de MERMA
(referencia `merma`, costo exacto al moverse, DP-D165) por el mismo camino de `registrar_merma`: sólo resta,
y con la existencia ya en negativo se registra igual (DP-D116, DP-D146).
- **El motivo.** La pantalla no lo captura; el catálogo no trae «perdido» ni «desperdicio» y no se inventan
  claves: se usa `dañado` («Dañado en almacén», no imputable) y la pantalla lo dice bajo el selector: «Se
  anota como merma «Dañado en almacén» y sale en la merma del corte». Lo que la persona escribe va en la nota.
- **Lo ya escrito como ajuste no se reescribe** (es historia: las mermas de prueba del día 0 siguen como
  `ajuste`).
- **Pruebas.** Integración `merma-desde-ajustar.integracion.test.ts` (4: sale en la merma del corte con su
  importe al centavo, 2 000 g × 3.4567 ¢ = 6 913 ¢; el conteo sigue siendo ajuste; sobre un negativo se
  registra; una merma que suma se rechaza), fallaba antes (3 de 4). Unitarias en `ajuste-de-stock.test.ts`.
  Mutantes muertos: sin leer el `tipo`, anotar `ajuste`, sin costo exacto, el diálogo sin `esMerma`, el
  motivo del conteo; la mutación inocua pasa.

## DP-D172 · DP-22 · La Caja se relee por `datos.regla`, no por `codigo` (corrige DP-D168) · 17-11-2026

La prueba en el navegador (`total-que-cambio.ts`) mostró que el arreglo del hallazgo 12 nunca corría: el
servidor contesta `codigo: 'REGLA_DE_NEGOCIO'` y la regla en `datos.regla`; `Caja.jsx` comparaba
`err.codigo === 'TOTAL_DESACTUALIZADO'`, que no coincide jamás (el contrato leía el texto y pasaba). Con el
cobro abierto, el mesero quita un platillo con el PIN del gerente y la cajera toca «Cobrar»: HTTP 422
`TOTAL_DESACTUALIZADO` (o 409 `PROPINA_VIGENTE` si la caja ya había elegido la propina) y la pantalla se
quedaba con el renglón quitado, el total viejo y lo tecleado. Ahora se relee con las dos reglas, leídas de
`err.datos.regla`. Con el build nuevo: `H12-BIEN` (el total pasa de 315.00 a 140.00, lo tecleado se
limpia y el segundo cobro cobra el total nuevo). El contrato exige además que NO vuelva a compararse
`err.codigo`. Mutantes: el viejo `err.codigo`, sin la regla del total y la mutación inocua.

## DP-D173 · DP-22 · La pantalla de Ajustar ya no frena una merma sobre una existencia que ya estaba en negativo · 17-11-2026

DP-D116 deja que lo que pasó por cocina se cobre aunque el almacén diga que no había, y DP-D146 que la merma
de ese insumo se registre igual. El servidor ya lo hacía, pero `AjustarStockDialog.jsx` frenaba CUALQUIER
ajuste que dejara el stock en negativo («El ajuste dejaría el stock en negativo»). Ahora una merma
(`tipoAjuste === 'merma'`) que resta sobre una existencia que ya es negativa se deja pasar y la pantalla lo
dice («La existencia ya estaba en negativo: la merma se registra y el conteo físico la corrige»); lo demás se
sigue frenando. Verificado en el navegador (pan: −2 → −3 → conteo en 10). Contrato en `ajuste-de-stock.test.ts`
con dos mutantes (sin la excepción y la excepción a toda resta) y uno inocuo.

## DP-D174 · DP-22 · Un platillo oculto del POS tampoco sale en el portal del comensal ni se puede pedir desde él · 17-11-2026

Parte 5, «ocultar del portal». «Visible en POS» apagado (Recetas → Editar receta) ocultaba el platillo del
POS (mesero y cajas), pero el portal sólo miraba `activo` y `visible_en_menu_digital`, una columna que NINGUNA
pantalla cambia (sólo la toca archivar un platillo): el platillo oculto seguía en el menú del QR y un teléfono
podía pedirlo. Se midió por pantallas (el Flan oculto: 0 fichas en la mesa y en Para llevar, 1 en el portal).
Ahora el menú del portal (`payloadDelPortal`) y lo que el portal acepta pedir (`cargarProductosDelMenu`) piden
también `visible_en_pos = true`. Es visibilidad, no dinero ni inventario. Integración
`portal-oculto-del-pos.integracion.test.ts` (2, fallaban antes) con dos mutantes (sin el filtro en el menú y
sin el filtro al pedir) y uno inocuo; en el navegador, con el build nuevo, el Flan oculto sale 0 veces en el
portal, en la mesa y en Para llevar, y vuelve al mostrarlo. Además los dos interruptores del editor de la
receta («Activo» y «Visible en POS») no traían nombre accesible: ahora sí, con contrato y mutantes.
**Encontrado, no arreglado:** «Utilidad bruta» de Registros (Hoy) dice $774.20 con 72.4 % de margen, una base de
$1,070.00 de $1,974.50 cobrados: no cuenta lo vendido POR PESO (barbacoa, costillar y arrachera, $904.50), que
no trae costo de receta; el margen del reporte ignora lo vendido por kilo. Es una decisión de producto (¿el
costo del kilo es el del insumo base?) y toca el margen de lo más caro del menú.

## DP-D175 · DP-22 · El día de bots: un día completo con aparatos táctiles, caos programado y árbitro cada hora · 17-11-2026

Perfil `dp22` del simulador (`qa/simulador/perfil-dp22.ts`, lanzador `correr-dp22.ts`). No cambia la app ni
ninguna regla de dinero o de inventario: lo que no cuadre es un hallazgo, no un ajuste.

- **Aparatos.** Los perfiles táctiles del arnés (`hasTouch`, sin ratón; `Locator.click` se vuelve `tap`):
  Caja en Windows 1366×768 al 125 %, mesero en teléfono 360×800 y en tableta 800×1280, las cinco estaciones
  de Cocina en el iMin (Chromium 99, modo ligero), comensales en teléfono 390×844 y dueña/gerente en Windows
  1920×1080. Un navegador por motor (`navegadores.ts`); si falta un motor el informe lo dice.
- **Volumen y reloj.** 64 grupos de mesa y ×4: con 2 y luego 3 meseros, no los 6 de la semana (a ×6 no
  alcanzaban 130 grupos). La semilla manda; la hora pondera las llegadas (comida fuerte de 13:00 a 16:00).
- **Caos con id** (`CAOS_DEL_DIA`): IVA de 16 % a 8 % y de vuelta; quién elige la propina; cupo y nombre
  de las cajas; portal apagado con carritos; estación y categoría nuevas a las 11:00 y reasignar una
  categoría a las 14:00; mover mesas en el editor con el dedo; un mesero nuevo; otro desactivado con mesas
  abiertas (sus cuentas las adopta otro tras repartir las mesas); una tableta que se apaga; la gerente agota
  un platillo y cambia un precio (que ahora regresa). El informe cuenta, por id, lo ejecutado, lo
  rechazado, lo fallido y lo que quedó fuera de un ensayo.
- **El árbitro de cada hora** (`arbitro/hora.ts`) sólo lee y mira un corte asentado (4 min simulados atrás)
  que confirma con un segundo corte: sólo lo que persiste cuenta; lo transitorio se cuenta aparte. Compara
  cobros al centavo, propinas por mesero, retiros y entradas, compras y gastos, inventario al gramo, su
  valor con UN redondeo del costo exacto (`costo_exacto_dmc`, DP-D165), la existencia contra el kardex,
  las comandas (ninguna perdida ni atorada), las invariantes, los 5xx y los errores de consola.
- **Dos oráculos que estaban viejos y ya no:** el consumo de un producto por porción de contenedor es
  750 ml ÷ 16 = 46.875 ml (no 45), y C02 se revisa con la tasa de CADA cuenta cuando el IVA cambia en el día
  (la invariante general lee la tasa de ahora).
- **Cómo repetirlo:** `bash D:/mpos-tmp/dp22/bots/dia-de-bots.sh repetir <semilla>` (ver el README del simulador).

## DP-D176 · DP-22 · Lo que el primer ensayo del día de bots enseñó (del guion, y lo que queda por mirar) · 17-11-2026

- **Del guion, ya arreglado:** la espera de 5 s de `expect` no alcanza con la máquina cargada (el cobro con
  propina fallaba y el reintento veía una propina ya fijada); el doble toque ahora son dos toques;
  «Cerrar» está dos veces en los diálogos heredados (`.first()`); el árbitro contaba filas de comanda y no
  piezas, ni quitaba la presentación del nombre («· medio litro»).
- **Para mirar (no se tapó):** «Cambiar de mesa» no se le ofrece al mesero que atiende la mesa (tres
  veces en el ensayo); «Marcar entregado» y «Pedir cuenta» del mesero a veces no encuentran su botón en
  45 s; los cobros tardan más de 3 s al abrir una cuenta pendiente (con la máquina cargada); un crítico
  de «la pantalla dice $X» después de un intento de cobro abortado, que parece del guion (la propina ya la
  había fijado la Caja). El día completo, con la máquina sola, es lo que lo confirma o lo descarta.
- **Del clon, no de la app:** las fotos del molde apuntan al almacén de otra corrida (puerto 3230) y el CSP
  las bloquea: el árbitro lo declara explicado.
  pierda, con la lista de todos los interruptores de Configuración. El blanco táctil del
  interruptor (32×18 px a la vista) SÍ está cubierto: con el dedo, `blancos-tactiles.css` le da un
  pseudo-elemento de 44×44 px (medido en el navegador: un toque a 20 px del centro cae en el interruptor, a
  30 px no); `qa/simulador/parte5/interruptores.ts` lo mide. No se cambió nada.

## DP-D177 · DP-22 · Parte 7 · El plano del mesero dice cuánto lleva abierta cada mesa · 17-11-2026

Comprobado en la app (teléfono 360×800 y tableta 800×1280): el plano del mesero NO decía nada del
tiempo; el «tiempo de servicio» sólo existía dentro de la mesa. Se agrega, en chico: en la tesela de
una mesa CON cuenta («35 min», «1 h 5 min», «< 1 min»), con su reloj y el nombre accesible «Abierta hace
35 min». En el teléfono es un renglón de la tarjeta; en el plano de tableta y PC, una pastilla chica que
cuelga bajo el borde de la mesa y no tapa nada (va dentro de la mesa-botón: tocarla abre la mesa). Una
mesa libre, en limpieza, pagada o cancelada no lleva tiempo. La hora es la de la cuenta activa
(`ordenes.created_at`), que el puente sirve ahora como `Mesa.abierta_desde` (derivado de sólo lectura, no
público); el «ahora» es el reloj de la pantalla (`useAhora`, el mismo de la cocina): el servidor no manda
su hora en las lecturas, y una tableta con la hora mal pondría minutos mal (se anota, no se inventa). No
hay aviso sonoro ni regla nueva: «mesa sin atender» ya es el color y la palabra del estado («Esperando
entrega», «Cuenta solicitada») más el tiempo. Archivos: `restaurante/tiempo-de-la-mesa.ts` (la cuenta,
6 pruebas), `TiempoDeLaMesa.tsx`, `MesaGridMobile.jsx`, `MesaShape.jsx` y el derivado en `puente/mapa.ts`.
Con el dedo: `qa-final/parte7-mesero.spec.ts` (9). Cambian de aspecto: el plano del mesero (tarjeta del
teléfono y mesa del plano).

## DP-D178 · DP-22 · Parte 7 · Buscar sin acentos y el arqueo por billetes y monedas · 17-11-2026

- **Buscar un producto.** «limón» (con acento) no encontraba «Limonada»: el filtro del pedido sólo pasaba a
  minúsculas. Ahora busca sin acentos ni mayúsculas (`restaurante/buscar-producto.ts`), en la mesa del
  mesero y en el catálogo del pedido de la Caja. La prueba con el dedo (`parte7-mesero.spec.ts`, 8) falló
  primero en la app.
- **El arqueo por denominación.** El servidor ya recibía el conteo por billetes y monedas en el cierre
  (`caja.cerrar`: `denominaciones`, que debe sumar el efectivo contado) y el papel ya lo imprime
  («Conteo por denominación»), pero el diálogo de cierre sólo tenía un campo de total: nadie podía
  capturarlo. Ahora «Contar por billetes y monedas» abre once filas (de $1,000 a 50 centavos) con «−»,
  «+» de 44 px y las piezas tecleables; el total sale de las piezas, es el efectivo contado y viaja con
  el conteo (no puede no sumar). No cambia ninguna regla de dinero: sin usarlo, el cierre es el de siempre. Con el teclado en pantalla, el campo de piezas que se toca se trae al centro (`scrollIntoView`): la primera prueba con el dedo lo encontró debajo del teclado.
  `caja/conteo-por-denominacion.ts` (10 pruebas), `ConteoPorDenominacion.tsx`, `CierreDiarioDialog.jsx` y
  `Caja.jsx`.

## DP-D179 · DP-22 · Parte 7 · Quién autorizó una cancelación sale en el corte y en Registros; lo que no se construye · 17-11-2026

- **Quién autorizó.** Con la cuenta pedida (o su precuenta impresa) cancelar o quitar un platillo lleva el
  PIN de gerencia y la auditoría guardaba quién, pero el corte y Registros sólo decían quién canceló y por
  qué. La lectura (`caja/corte/cancelaciones.ts`) trae ahora `autorizo` (de la auditoría, nulo si no
  hizo falta) y el motivo lo dice así: «Se fueron sin pagar · Autorizó Beatriz»
  (`corte/motivo-de-la-cancelacion.ts`), en la hoja del corte (la misma sección pinta el corte de la
  Caja) y en la lista de Cancelaciones. Prueba contra Postgres:
  `restaurante/cancelaciones-con-autorizacion.integracion.test.ts` (3).
- **Comanda: «volver a mandar» no aplica.** La cocina es por pantalla y la comanda vive en el servidor: la
  cocina recargada, o sin red un momento, la vuelve a ver, y la que se manda mientras no hay red llega al
  volver (`parte7-agotado-y-papel.spec.ts`, 2). No hay comanda impresa que reimprimir.
- **Nota por comensal: no se construye.** Con la nota por platillo («sin cebolla, para el niño») la cocina
  la ve en ese platillo y no en otro (`parte7-mesero.spec.ts`, 10); un comensal es una nota en su platillo.
- **Pasar un platillo de una cuenta a otra:** no se construye; el diseño y el tamaño están en el informe
  de la Parte 7.

## DP-D180 · DP-22 · El costo de lo que se vende por kilo o por porción sale de lo que baja del almacén × el costo exacto del insumo · 17-11-2026

**Es una regla de dinero** (hallazgo 27, medio). En Registros, «Utilidad bruta» decía $774.20 con 72.4 % «sobre una base de $1,070» y dejaba fuera $904.50 de barbacoa, costillar y arrachera vendidos por kilo.

- **La causa.** El renglón de una venta copia su costo de `productos.costo_unitario_centavos` al crearse
  (`restaurante/lineas.ts`, `filaDeLinea`), y esa columna sólo la llena `recalcularCostosRecetas` para los
  platillos con RECETA. Un platillo `estrategia_consumo = 'insumo_base'` (por medida o por porción de un
  contenedor) baja su insumo base pero su costo se quedaba en cero: costo «desconocido» (DP-12.6/13.2), y
  `estadoDelCostoDe` lo contaba «sin receta» y lo sacaba de la base del margen.
- **Dónde se arregla.** Al COBRAR, en la transacción del cobro y antes de cotizar
  (`venta/costo-por-medida.ts`, llamado desde `cobrar.ts`). El costo del renglón sale del MISMO cálculo que
  el consumo: `planearConsumo` (la única que decide qué baja) para esa línea sola × `insumos.costo_exacto_dmc`
  al momento de cobrar (DP-D165), `valorDeLaCantidad`: UN redondeo, a centavos, por renglón. Es el costo con
  que el kardex valúa esa misma salida. No en el alta del renglón: ahí el costo del insumo aún puede cambiar
  y el renglón puede quitarse o cancelarse; al cobrar es el que de verdad salió. No en `productos`: una foto
  vieja por platillo no sabe cuántos gramos se vendieron.
- **Qué se escribe.** `orden_lineas.utilidad_centavos` = total − costo (invariante de F1-04 §7.3, que lee el
  corte y «Lo más vendido»); `costo_unitario_centavos` = el costo por unidad vendida (por kg, por copa),
  redondeado UNA vez desde lo exacto (es lo que leen `costo × cantidad` y `estadoDelCostoDe`); y `cotizar`
  recibe el costo exacto de esos renglones para que `ordenes.costo_total_centavos` sea su suma, sin pasar
  por el redondeo por unidad. Con ello el resumen de Registros, el corte, «Lo más vendido» y el costo
  «conocido / sin receta / receta incompleta» (`costo-conocido.ts`, sin tocarlo) cuentan lo mismo: un
  platillo por kilo con insumo base y costo ya NO es «sin receta».
- **Lo que NO cambia.** Lo que se cobra (`cotizar` sigue calculando el total igual) y lo que baja del
  inventario (`planearConsumo`, sin tocar y llamada con su `soloLoHecho`). Los platillos con receta, `sku` y
  presentación: no entran (la consulta es sólo de `insumo_base`) y sus números son los de siempre. Un insumo
  base SIN costo no inventa uno: el renglón queda como estaba (desconocido, y se dice así).
- **Lo ya cobrado con costo cero NO se reescribe** (es historia, como en DP-D165 y DP-D167): sólo las ventas
  desde este cambio llevan el costo. Si quien dirige quiere el margen de lo anterior, es una decisión aparte.
- **Dos límites a la vista.** (1) Dos renglones del mismo insumo en una cuenta redondean cada uno su costo
  (dos redondeos, ≤ 1 ¢ de diferencia con el kardex, que suma las salidas del insumo y redondea una vez).
  (2) `costo_unitario_centavos` es entero por unidad vendida: un reporte que lo multiplique por la cantidad
  (`reportes/piezas.ts`) puede diferir centavos del costo guardado de la cuenta; el corte y Registros usan lo
  exacto.
- **No cubierto:** la remisión de crédito de ferretería (`ferreteria/credito.ts`) y la merma por cancelación
  usan `planearConsumo` pero no el cobro; sus renglones `insumo_base` siguen su camino anterior.
- **Pruebas.** `venta/costo-por-medida.integracion.test.ts` (7, contra Postgres): ½ kg y 0.35 kg de un insumo a
  34.567 ¢/g cuestan 17 284 y 12 098 ¢ (con centavos enteros serían 17 500 y 12 250); 3 copas de 750 ml ÷ 16 =
  46.875 ml a 2.7345 ¢/ml cuestan 385 ¢ (384 redondeando por copa, 422 con centavos). Mutantes muertos: costo
  en cero, costo con centavos redondeados, redondeo por pieza; mutación inocua (orden explícito) que pasa.
- **Sin migración.**

## DP-D181 · DP-22 · «Registrar compra» desde Inventario sólo se ofrece a quien puede registrarla · 17-11-2026

Hallazgo 28 (bajo). Inventario pintaba «Registrar compra» (el encabezado y la pantalla vacía) a cualquiera que
entrara, sin mirar el puesto, y lo mandaba a Compras.

- **Qué se encontró.** El permiso NO se toca: `compras.registrar` lo tienen dueño, administrador, gerente y
  ALMACÉN (A5: el almacén recibe la mercancía; el efectivo del cajón no, DP-D115), y `puestos.js`
  (`puedeRegistrarCompras`) es su espejo, atado a la matriz por `compras-del-almacen.contrato.test.ts`. Con el
  almacén ya dentro de los que registran, el botón del almacén SÍ lleva a algo (la captura de bot lo muestra: la
  tarjeta «Registrar compra» de Compras). Lo que el bot leyó fue el aviso «las compras y los gastos los registra
  la gerencia»: Compras lo pintaba mientras la plantilla aún no llegaba (`usePuesto()` es `null` hasta entonces)
  y lo sigue pintando para quien de verdad no registra.
- **Qué cambió.** (1) Inventario pinta el botón sólo si `puedeRegistrarCompras(usePuesto())`, en sus dos
  sitios; sin puesto leído no se enseña (como en Compras). (2) Compras no dice «lo registra la gerencia» mientras
  no sabe el puesto (`puesto !== null`). Ni clases, ni textos, ni iconos nuevos: sólo cuándo se pinta.
- **Contrato.** `apps/web/src/inventario/registrar-compra-desde-inventario.contrato.test.ts` lee Inventario y
  Compras SIN comentarios y afirma sobre el trozo que pinta cada enlace a Compras (dos, cada uno detrás de
  `registraCompras &&`). Mutantes muertos: un botón sin guarda, la guarda comentada, Compras sin la comprobación
  del puesto; inocua (un comentario) que pasa.
- **Sin migración.**

## DP-D182 · DP-22 · El día de bots, semilla 2211: «Cambiar de mesa» no estaba en el teléfono · 18-11-2026

El primer día completo (8:00 a 19:00, semilla 2211, la máquina sola) dejó 289 incidentes y 0 diferencias del
árbitro (1,533 comparaciones, dinero al centavo, inventario al gramo, 0 errores 5xx, 0 de consola sin
explicar). De los incidentes, UNO era de la app y los demás del guion.

- **De la app: «Cambiar de mesa» no se ofrecía al mesero en el teléfono.** DP-15.1 se lo dio al mesero en SUS
  mesas, pero el botón sólo estaba en el panel de la tableta y del escritorio (`md:` en adelante); en el
  teléfono el pedido de la mesa vive en la hoja de `MeseroCartFAB`, que sólo ofrecía «Solicitar cuenta».
  Mesero 1 y Mesero 7 (teléfono) no lo encontraron nunca; Mesero 2 (tableta), siempre. Era lo que el
  ensayo (D22-020, 028, 043) dejó por confirmar: el reparto de mesas no tenía la culpa. Ahora la página calcula
  UNA vez `puedeCambiarDeMesaAqui` (la misma `puedeMoverLaCuenta`) y se la pasa a la hoja, que pinta el botón,
  se cierra y abre el panel de las mesas libres. Prueba: `cambiar-de-mesa-en-el-telefono.contrato.test.ts`
  (fallaba 3 de 3; ahora 3/3). Mutantes muertos: botón siempre visible (2 fallan), sin cerrar la hoja (1),
  abrir antes de cerrar (1), regla sustituida por `true` (1, tras reforzar la prueba: el primero sobrevivía) y
  manejador vacío (1). Se declaró en `scripts/aspecto-permitido.json` (`MeseroCartFAB.jsx`, un botón más).
  Límite: la barra del teléfono sólo aparece con pedido o con «Solicitar cuenta» posible; con la cuenta ya
  pedida el mesero del teléfono sigue sin el botón (el panel de la tableta sí lo trae siempre).
- **Del guion, arreglado** (`qa/simulador`): (1) «Marcar entregado»: dos meseros recorren todo el plano y el
  otro entrega primero; el diálogo conserva la foto del encabezado, así que se mira el plano y no es falla si
  ya no dice «Esperando entrega» (8 de los 9 casos coincidían con una entrega ajena de segundos antes). (2) El
  teléfono abre la hoja «Mesa abierta» antes de buscar «Solicitar cuenta» o «Cambiar de mesa», y la tableta ya
  no espera una barra que no existe. (3) El panel de «Cambiar de mesa» enseña primero la zona propia: las demás
  están tras «Ver mesas de otras zonas». (4) El editor del salón, el plano de «Unir mesas» y el mapa del mesero
  muestran una zona a la vez: se busca la mesa en las pestañas; para unir se elige una de la misma zona
  (`zonas.ts`). (5) Al limpiar la principal de mesas unidas la app pregunta «¿Separar mesas o dejarlas
  unidas?» (DP-9.6) y el guion no la contestaba: el diálogo tapaba el plano y se encadenaron decenas de fallos.
  (6) La pestaña se llama «Ajustes del portal» desde DP-21 y su botón «Guardar»; «Editar receta» sólo existe
  con el renglón abierto (A10). (7) S1 movía la mesa 3 hacia la derecha, sobre la 4: ahora hacia abajo.
  (8) K2: la opción «Cocina» debe pedirse exacta. (9) Los dos «críticos» de dinero (D22-057 y D22-098, y el
  D22-032 del ensayo) eran del guion: tras una red caída o una recarga la propina que la Caja había elegido
  quedaba fijada en la cuenta, al reabrirla la pantalla ya no la preguntaba y el libro creía que nadie la
  había decidido; ahora se recuerda por cuenta. (10) La disputa de dos cajas buscaba a la perdedora sólo entre
  las respuestas que no eran 200. (11) Los meseros sientan primero en SUS mesas y sólo mueven la cuenta de
  una mesa que les repartió la dueña (`reparto-de-mesas.ts`): la app sólo se la ofrece al mesero de esa mesa.
  Pruebas unitarias nuevas: `zonas.test.ts` y `reparto-de-mesas.test.ts`.
- **No es de la app, por diseño:** la sesión de la caja vive 12 h fijas desde el PIN (`politica.ts`): un día
  que pasa de las 20:00 la vence (D22-273). Que el día pase de las 20:00 fue consecuencia del encadenamiento.
- **Sin demostrar:** «abrir la cuenta pendiente» tarda ~2.9 s en la Caja (p50), pero casi todo es el toque
  del bot (1.9 s) y no la app (la pantalla responde en 70 ms): el guion ahora mide cada paso.

## DP-D183 · DP-22 · El día de bots, semillas 2212 y 2213: el árbitro y el guion afinados, y lo que queda · 18-11-2026

Con «Cambiar de mesa» en el teléfono (DP-D182) y el guion arreglado, la semilla 2213 cerró con **0
diferencias del árbitro en las 11 horas y en el cierre** (1,562 comparaciones: dinero al centavo, inventario
al gramo, propinas por mesero, ninguna comanda perdida ni atorada), 0 errores 5xx, 0 de consola sin
explicar, 0 incidentes críticos o altos y 174 cobros por $69,641.50. Lo que se aprendió en el camino:

- **El árbitro de las comandas cortaba por la hora de cada fila (D22-058 y D22-059, «críticos» de la 2212).**
  Al dividir una cuenta, una línea de 2 piezas se parte en 1 + 1 y la pieza nueva entra a la MISMA comanda
  con la hora de la división: con la división después del corte, la fila vieja ya traía 1 y la nueva quedaba
  fuera. Las piezas eran las que se mandaron (con el corte por la hora de la COMANDA salen 5 y 5, como el
  libro). Ahora `COMANDAS` une `comandas` y corta por `c.created_at`; su prueba (`hora.test.ts`) falla si
  vuelve `ci.created_at`. No se relajó nada: el árbitro sigue exigiendo todas las piezas.
- **R1 (el traslado de la Caja 2) no se ejecutaba:** el bot de la caja cuenta sus minutos desde que ELLA abre
  (12:40) y el plan decía 420, que son del día; caía a las 19:40. Ahora es `420 - ENTRA_LA_CAJA_DOS` (15:00);
  `perfil-dp22.test.ts` lo comprueba. Sólo corrió en la 2211, que se alargó hasta las 20:30.
- **Más del guion:** «Cómo se ve el menú» está en Configuración → Portal de comensales (la pestaña de Portal
  QR sólo manda allá); la opción «Cocina» se llama «Cocina (general)»; el platillo que la cocina agota después
  de planear una ronda se salta (la pantalla no deja pedirlo); la disputa de dos cajas no juzga una perdedora
  que no llegó a mandar su cobro; el mesero no mueve la cuenta de una cuenta de mesas unidas; la Caja mide lo
  que tarda la PANTALLA en abrir una cuenta (80 ms) y no los toques del bot (1.5 s), que sumaban 2.9 s.
- **Sin arreglar, a la vista:** (1) «Registrar compra» desde Inventario para el almacén (hallazgo 28, lo arregla
  otro agente). (2) El modo espera de la Caja tapa el cobro abierto y se traga el toque («Cobrar $…» de
  D22-038 y D22-042): del guion (no despierta dentro del cobro) y, por diseño, de la app. (3) El encabezado
  del diálogo de la mesa del mesero conserva el estado de cuando se abrió («Esperando entrega» tres minutos
  después de entregar): cosmético, de la app. (4) La barra del teléfono no aparece con la cuenta ya pedida,
  y entonces el mesero del teléfono sigue sin «Cambiar de mesa». (5) Registrar una merma, un retiro o una
  compra tarda 3 a 8 s medidos con todos los toques del formulario: no se pudo separar lo de la app.

## DP-D186 · DP-22 · Los hallazgos visuales 34, 35 y 38 del mesero en el teléfono: la barra se esconde al escribir y se queda con la cuenta pedida · 18-11-2026

Tres hallazgos de la hoja del pedido del teléfono (`MeseroCartFAB.jsx`, 360×800), cerrados con el dedo.

- **34 · La barra «Solicitar cuenta» tapaba la primera tarjeta del resultado con el teclado abierto.** La
  barra es `fixed` abajo; con el teclado en pantalla la ventana se achica y la barra queda encima de los
  resultados. Lo mínimo: mientras un campo de texto tiene el foco (`focusin`/`focusout` del documento), la barra
  no se pinta; al soltar el foco vuelve. Ni la tableta ni el escritorio la tienen (`md:hidden`), así que no
  cambia nada ahí. Si la hoja se cierra con el foco dentro de un campo que desaparece (el navegador no
  siempre avisa), se vuelve a mirar quién tiene el foco para que la barra no se quede escondida.
- **38 · Con la cuenta ya pedida el mesero del teléfono se quedaba sin «Cambiar de mesa».** Se leyó el servidor
  primero: `restaurante.cambiar_mesa` acepta la cuenta en `cuenta_solicitada` (`CUENTAS_VIVAS` de
  `cambio-de-mesa.ts`) y no toca dinero ni inventario. Por eso SÍ se ofrece, con la MISMA regla de siempre
  (`puedeMoverLaCuenta`, una sola definición en `Mesero.jsx`: dirección en cualquier mesa, el mesero en las suyas,
  nadie en una mesa unida). La barra ya no desaparece con la cuenta pedida: dice «Cuenta pedida · Ver pedido» y
  su hoja trae «Cambiar de mesa».
- **35 · Tras cerrar «Pre-cuenta lista» no había otra hoja a la mano.** Con la cuenta pedida, la hoja del
  teléfono y el panel de la mesa (tableta) traen «Imprimir otra hoja de la precuenta», un enlace a
  `/restaurante/precuenta?cuenta=…`, que reimprime y marca la copia («REIMPRESIÓN · 2ª HOJA»). Y los «—» de
  esa pantalla NO se arreglaron con un cálculo en el navegador: el total de una venta es de rol caja
  (`rolesLectura: CAJA`); lo sabe el servidor al pedir la cuenta (que la pestaña que la pidió guarda, y la
  pantalla usa) y al imprimir. Quien llega sin esa respuesta (otra pestaña, otra tableta) ve «—», y la línea
  de la barra ahora dice por qué y qué hacer: «lo calcula el servidor al imprimir (el total es de la caja):
  toca Imprimir y la hoja se completa con él». Es un límite de diseño, declarado, no un defecto.

Pruebas: `apps/web/src/restaurante/visual-pendientes-del-mesero.contrato.test.ts` (fallaban 6 de 7 antes del
código) y, con el dedo, `pruebas/e2e/qa-final/visual-pendientes.spec.ts` («34 · …» y «35 y 38 · …»).
Se declaró en `scripts/aspecto-permitido.json` lo que cambia en `MeseroCartFAB.jsx` y `Mesero.jsx`.

## DP-D187 · DP-22 · Hallazgo 26: «Entregar el turno» y «Retirar» a la misma altura con subfilas · 18-11-2026

Las dos tarjetas de Caja → Movimientos (escritorio, dos columnas desde `lg`) tenían sus campos a distinta altura
porque sus textos de ayuda miden distinto. Sin tocar ningún texto: cada tarjeta es una cuadrícula con SUBFILAS
(`lg:row-span-4 lg:grid-rows-subgrid`, `src/venta/tarjetas-del-cajon.ts`) de la cuadrícula de afuera, con cuatro
filas: encabezado, primer campo, segundo campo y lo demás (avisos y botón). Las dos usan el mismo hueco entre filas
(`--espacio-4`: el corte usaba `-3`) porque con huecos distintos las subfilas no cuadran. Debajo de `lg` siguen
siendo una pila. Se quitó la excepción `[conocido]` del barrido de servicio (`CONOCIDOS` quedó vacío): desde hoy
cualquier falta de alineación ahí tumba la prueba. Pruebas: el contrato de arriba y el barrido en los cuatro
aparatos.

## DP-D188 · DP-22 · Hallazgo 5 (resto): el menú lateral avisa cuando hay más por desplazar · 18-11-2026

En una ventana baja (Windows 1366×768 al 125 % = 1093×614) el menú no cabe: la lista se desplaza, pero
«Compras» se veía cortado bajo «Modo oscuro» sin ninguna pista. `NavegacionConAviso` (`src/tacto/`) envuelve la
lista del menú principal: mientras queda algo por desplazar (`scrollHeight - scrollTop - clientHeight > 2 px`)
pinta al borde de abajo un degradado y una flecha (`data-mas-por-desplazar`, `aria-hidden`,
`pointer-events-none`: no recibe toques ni tapa un enlace); al llegar al final, o si todo cabe, se quita. Se mide al
desplazar, al cambiar el alto de la lista y en cada pintada. Prueba con el dedo: «5 · …» en
`visual-pendientes.spec.ts` (sólo en `win-1366x768-125`). El 11 (propina en el cobro) no se tocó.

## DP-D190 · DP-22 · Los ajustes y tarjetas de Configuración que faltaban, comprobados con el dedo · 18-11-2026

- **Decisión:** lo que se da por comprobado en `efectos.json` lo demuestra una prueba del arnés táctil
  (`pruebas/e2e/qa-final/ajustes-finales/`) que cambia el ajuste en Configuración (Windows 1366×768 al 125 %) y
  mira el efecto en el aparato donde se ve (barra y fondo en Windows; portal en el teléfono 360×800; la entrada
  del nuevo mesero en la tableta), con los DOS estados en la misma prueba. Subir un logo o un fondo exige el
  almacén de archivos: se usa el local del simulador. «Reiniciar sistema» sólo corre contra la base desechable.
- **Lo que NO se da por comprobado:** que el papel salga, que el cajón de verdad salte, la impresora del local y
  la contraseña real del proveedor; el selector de archivos del sistema operativo (se entrega el archivo al
  campo cuando el toque no lo abre). Van a la lista de pruebas físicas.
- **Hallazgo declarado, no cambiado en la víspera:** el mapa de Configuración → Salón no escala: a 1366×768 al
  125 % el lienzo mide ~470 px de CSS y las mesas con posición mayor (3 y 6 de «Interior») quedan cortadas.
- **Sin migración.**

## DP-D194 · DP-22 · La matriz de flujos gana el estado «no aplica»: una función que no existe no es un hueco de pruebas, pero tampoco se esconde · 18-11-2026

- **Decisión:** en `qa/qa-final/datos/flujos.json` un flujo puede declararse `"estado": "no aplica"` con una
  `"razon"` escrita y obligatoria, y sin pruebas enlazadas (o aplica o no). El generador (`scripts/qa-final/matriz/flujos.mjs`)
  no lo cuenta como «sin prueba», lo imprime en la matriz con su razón y lo cuenta aparte en el resumen. Un estado
  desconocido, un «no aplica» sin razón o con pruebas enlazadas son huecos y `--verificar` falla. Lo cubren siete
  pruebas (`flujos.test.ts`) y dos mutantes del agente T mueren (sin exigir la razón; contando «no aplica» como sin prueba).
- **Dos flujos lo usan hoy:** «Descuento por renglón» (el descuento del restaurante es a la cuenta entera; el de
  mostrador por línea es otro flujo, con su prueba; NUEVO.md lo lista como «lo grande para después») y «Para llevar
  desde la mesa» (el para llevar sólo se arma desde la Caja; el mesero no tiene esa entrada).
- **Con qué quedó la matriz:** 104 flujos, 0 sin prueba, 2 «no aplica». Hay enlaces menos fuertes que declaró el
  agente M (Salir con la barra plegada: contrato de texto más un bot; Quitar antes de enviar: sólo el portal en modo
  mesero; Sesión vencida: no a media operación; Cambiar de persona: un paso dentro de otra prueba; los guiones por
  pantallas dependen de que su corrida haya pasado). Se aceptaron; no son lo mismo que una prueba propia.
- **Por confirmar con el dueño:** que «Para llevar desde la mesa» de verdad no exista; el flujo no aparece en
  PLAN.md ni en NUEVO.md y no se halló su entrada en la app. Si existiera, pasa a ser un hueco a probar.
- **Sin migración. No cambia dinero ni inventario.**

## DP-D195 · DP-22 · Lote 8 · El mapa de mesas de Configuración se escala al ancho que hay y cabe entero · 18-11-2026

- **Decisión:** `MesaMapEditor` mide el ancho disponible de su marco (`ResizeObserver`) y, si el lienzo lógico
  (810 px de ancho, o más si alguna mesa quedó más a la derecha, por 600 de alto) no cabe, lo **reduce** con
  `transform: scale(...)` desde la esquina de arriba a la izquierda y le da al marco el alto escalado. Nunca lo
  agranda (1 = tamaño real). El lienzo declara su escala en `data-escala`. Las coordenadas que se guardan
  **siguen siendo las lógicas**: al arrastrar, el movimiento en pantalla se divide entre la escala (y los topes del
  borde también), así que la posición que llega al servidor es la misma que con el lienzo a tamaño real.
- **Por qué:** en Windows 1366×768 al 125 % el lienzo medía ~470 px de CSS con `overflow-hidden` y cortaba las
  mesas 3 y 6 de «Interior» (hallazgo medio de `c-ajustes.md`). Un desplazamiento horizontal no servía: el
  lienzo captura el dedo (`touch-action: none`) y no se puede arrastrar la página desde él.
- **Costo:** en el ancho de 1366×768 al 125 % las mesas se ven a ~0.73 de su tamaño. En la iMin (1920) y en la
  tableta (800×1280) el ancho alcanza o el lienzo ya se reducía: sin cambio a peor (la prueba corre en los tres).
- **Prueba:** `ajustes-finales/tarjetas-personas.spec.ts › mapa-de-mesas…` en `win-1366x768-125`, `imin-1920x1080-c99`
  y `tableta-800x1280`: ninguna mesa cortada, el mapa cabe a lo ancho, y el arrastre con el dedo guarda
  (movimiento ÷ escala) en la base. Antes del código fallaba («mesas cortadas por el borde del mapa»: 3 y 6).
- **Sin migración. No toca dinero ni inventario.**

## DP-D196 · DP-22 · Lote 8 · La hoja del carrito del mesero (teléfono) se cierra sola al quedar vacía · 18-11-2026

- **Decisión:** `MeseroCartFAB` cierra la hoja cuando las piezas del carrito **pasan** de más de cero a cero (se
  recuerda la cuenta anterior en una referencia). Una hoja abierta a propósito con el carrito vacío (para
  «Solicitar cuenta», «Cambiar de mesa» o «Imprimir otra hoja») no se toca: sólo cierra la transición.
- **Por qué:** al quitar el último renglón la hoja se quedaba abierta con el velo encima de los platillos hasta que
  se tocaba el velo (hallazgo bajo de `t-flujos.md`).
- **Prueba:** `flujos-sin-prueba.spec.ts › Pedido · Cantidades…` (teléfono 360×800 y tableta): tras bajar a cero no queda el
  velo (`div.fixed.inset-0[z-65]`). Antes del código fallaba («la hoja y su velo siguen abiertos»).
- **Sin migración. No toca dinero ni inventario.**

## DP-D197 · DP-22 · Lote 8 · El aviso «Solicitud enviada» del portal no tapa el texto de gracias · 18-11-2026

- **Decisión:** el aviso verde de «Solicitud enviada» (3.5 s, pegado al borde de abajo) no se pinta mientras la hoja
  de la valoración está abierta: los dos iban al borde de abajo y el aviso tapaba «¡Gracias! Tu valoración fue
  registrada». El comensal ya vio «¡Cuenta solicitada!» en la hoja de la cuenta; el aviso no aporta nada encima de la
  hoja de valorar.
- **Prueba:** `flujos-sin-prueba.spec.ts › Portal QR · Calificar la visita…` (teléfono): el recuadro del aviso (si se ve) no se
  cruza con el del texto de gracias. Antes del código fallaba.
- **Sin migración. No toca dinero ni inventario.**

## DP-D198 · DP-22 · Lote 8 · «Borrar todos los datos del sistema» dice lo que hace: conserva la configuración y a la gente · 18-11-2026

- **Qué se comprobó (contando filas, base desechable, Windows 1366×768 al 125 %):** con el nombre del negocio bien
  escrito el comando borra el catálogo (27 productos, 6 categorías, 57 recetas, 33 insumos, 33 existencias, 1
  proveedor), las 12 mesas y todo lo transaccional, y deja la organización, su sucursal, las 11 personas con su
  empleo, las 5 zonas de fábrica y las 3 estaciones de cocina; el otro negocio de la base no se toca; el
  rastro queda en `comandos_ejecutados` y la app queda usable (el salón vacío ofrece «Crear primera mesa»).
- **Hallazgo (bajo): la pantalla prometía de más y de menos.** Decía «Resetea la configuración a valores base.
  Conserva tu usuario administrador», y el comando NO toca `configuracion` (sigue idéntica) ni a nadie de la gente.
  No se cambió el comando: resetear la configuración borraría también quién es la persona de plataforma y los
  ajustes del negocio, y esa regla no es de la víspera. Se cambió el texto de la tarjeta y del diálogo.
  **Queda para Miguel:** si «para un cliente nuevo» debe también volver a valores de fábrica la configuración.
- **Observación:** el límite de tasa es de tres operaciones de mantenimiento por hora y por origen **y un nombre mal
  escrito cuenta**. Quien se equivoca dos veces seguidas queda 50 minutos sin poder reiniciar. Es a propósito
  (E10-4); la prueba vacía `limite_tasa` de su base desechable antes de cada intento que debe prosperar.
- **Sin migración. No toca dinero ni inventario.**

## DP-D199 · DP-22 · Lote 8 · «Borrar todos los datos» describe lo que el comando hace con las zonas y las estaciones · 18-11-2026

- **Qué se leyó (revisión independiente de sólo lectura del lote 8):** el texto de la pantalla decía que se conservan
  «las zonas y estaciones de cocina». `reiniciarTodo` (`packages/app/src/mantenimiento/comandos.ts`) borra las zonas
  con el catálogo (`zonas` está en `TABLAS_DEL_CATALOGO`, `purgas.ts`) y las vuelve a sembrar a las 5 de fábrica
  (Interior, Exterior, Terraza, Barra y Otro; sólo si el giro es restaurante). Las estaciones de cocina NO están en
  esa lista: todas se conservan, y sólo se siembra «Cocina general» si no hubiera una general.
- **Decisión:** el texto de la tarjeta y del diálogo dice ahora lo que pasa: las zonas vuelven a las de fábrica (las que
  el negocio creó se pierden) y se conservan la configuración, la gente con sus usuarios y las estaciones de cocina.
  Lo ata `lote8-mapa-carrito-aviso.contrato.test.ts › DP-D198`, recortado al texto de la tarjeta y del diálogo, y que
  no diga que las zonas se conservan.
- **El comando no cambia.** Conservar la configuración es lo seguro. Si el dueño quiere que «para un cliente nuevo»
  también la borre, queda para después.
- **Sin migración. No toca dinero ni inventario.**

## DP-D200 · DP-23 · El toque seguro: un botón que agrega al pedido sólo agrega cuando alguien quiso tocarlo · 19-11-2026

- **La falla (el dueño, en el restaurante, 19-11):** en la rejilla de platillos del mesero «al deslizar se agregan
  platillos» y «al mantener se agregan varios».
- **Qué se reprodujo (`pruebas/e2e/qa-final/toque-seguro-del-mesero.spec.ts`, dedo por CDP y ratón que llega de un dedo,
  1024×768, 800×600, 1280×800 y 800×1280, tras cambiar de categoría):** mantener 800 ms sobre una ficha AGREGABA una unidad en
  el 100 % de los casos (16 de 16, dedo y ratón); un arrastre de 40 px que empieza y termina sobre la misma ficha agregaba
  una unidad con el ratón en los cuatro tamaños y con el dedo en 1280×800; 6 toques seguidos de un panel que rebota
  agregaban 6; Enter sostenido agregaba 8; y la rejilla NO volvía arriba al cambiar de categoría (se quedaba a 1278 px).
  Los arrastres largos (120 y 200 px) que cambian de ficha no agregan: el clic cae en el contenedor.
- **Decisión:** un solo «toque seguro» (`apps/web/src/tacto/toque-seguro.ts`, decisión PURA; `use-toque-seguro.ts`, el gancho que
  mide con Pointer Events; `BotonQueAgrega.tsx`, el `<button>`). Cuenta como toque si, entre bajar y soltar, el puntero se
  movió a lo más `TOLERANCIA_PX` (10, la de las pulsaciones del mesero), ningún contenedor se desplazó, duró menos de
  `MS_PARA_MANTENER` (500 ms) y el navegador no canceló el gesto. Un botón no vuelve a agregar antes de 350 ms y no
  entra otro toque mientras su acción (una promesa) se resuelve. Sigue siendo el `click` nativo de un `<button>`: nombre
  accesible, foco, Enter y Espacio intactos; Enter sostenido no se repite (`event.repeat`).
- **Dónde:** la rejilla del mesero (`Mesero.jsx`), el + / – / quitar del pedido (`ProductoFichaExpandible`, que usa también
  `MeseroCartFAB`), las fichas de Caja / para llevar (`CatalogoDelPedido`), la tarjeta de la Caja de mostrador
  (`ProductCard`), `MesaActivaView` (sin uso hoy; mismas fichas), el menú digital del comensal (`MenuDigital`,
  `MenuALaCarta`: sus fichas abren el detalle y un arrastre no debe abrirlo) y el diálogo del comensal (`ProductoQRDialog`:
  su + / – y «Agregar»). Lo ata `toque-seguro.contrato.test.ts` (recorre TODO el heredado y `src`: ninguna etiqueta cruda
  llama a una acción que agrega desde su `onClick`).
- **Sin migración. No toca dinero ni inventario.** La pantalla en reposo no cambia (ver DP-D203).

## DP-D201 · DP-23 · Ratón y teclado en el toque seguro · 19-11-2026

- **El dedo que llega como ratón** (Windows táctil con pantallas viejas, WebView de Android) no se distingue de un ratón: por
  eso el movimiento (10 px) y la duración (500 ms) valen para TODO puntero, ratón incluido. Un clic normal de ratón dura
  decenas de milisegundos y no se mueve: no se nota. Costo aceptado: un clic de ratón sostenido medio segundo o arrastrado más
  de 10 px sobre una ficha NO agrega (se vuelve a tocar). Preferimos eso a un platillo de más en la cuenta de una mesa.
- **Teclado y lector de pantalla** (Enter, Espacio, `click()` sin gesto) no tienen gesto que medir: sólo cuentan el reposo y la
  acción en curso. Un gesto medido hace más de 1 s no se le atribuye a un clic programático.
- **Chromium 99 (iMin):** sólo Pointer Events, `performance.now` y `scroll` en captura; nada que no exista ahí.

## DP-D202 · DP-23 · Los tiempos del toque seguro · 19-11-2026

- **350 ms** entre dos agregados del mismo platillo (una ficha): rebote de un panel táctil o doble evento. Es una ventana
  fija desde el último agregado, no deslizante: tocar dos veces a propósito con 350 ms o más entre toques suma las dos.
- **200 ms** en el + y el – del pedido y en «Uno más / menos» del comensal (`REPOSO_DE_MAS_Y_MENOS_MS`): una persona no toca
  dos veces a propósito en menos de eso, y no estorba a quien suma varias unidades seguidas.
- **«Mantener» no se reprodujo como rebote del panel:** lo que el dueño ve («se agregan varios») se explica por el clic
  que Chromium dispara al soltar tras una pulsación larga (una unidad por intento) más, quizá, un panel que repite; el
  reposo cubre lo segundo. **No se pudo comprobar en el aparato del restaurante**: queda como pregunta si en su tableta
  siguen agregándose varios con el arreglo (el simulador de panel con rebotes sí queda en 1 o 2).

## DP-D203 · DP-23 · La rejilla de platillos desplaza y nada más · 19-11-2026

- `touch-action: pan-y` y `overscroll-behavior: contain` en la rejilla (`toque-seguro.css`, por el atributo
  `data-rejilla-de-platillos`: el aspecto del heredado no lleva una clase más); al cambiar de categoría o de búsqueda la
  rejilla vuelve arriba (`useRejillaQueVuelveArriba`); la ficha ya no se encoge con `active:scale-95` (se movía bajo la
  yema) y sólo cambia de fondo al presionar (`active:bg-muted/60`).
- Cambia UNA clase por ficha, declarada en `scripts/aspecto-permitido.json` (Mesero, MesaActivaView, ProductCard). La galería
  de CI retrata las pantallas en reposo y esa clase sólo se ve al presionar: no debe alterarla (la CI lo confirma).
- El menú digital del comensal cambia `active:scale-[0.97]` por `active:opacity-85` por la misma razón.

## DP-D204 · DP-23 · Lo que el toque seguro no toca · 19-11-2026

- Botones que NO agregan: Enviar a cocina, Solicitar cuenta, cambiar de mesa, categorías, la barra del carrito (`setOpen`), los
  de «Quitar» del carrito del comensal (`RenglonDelCarrito`: quita, no suma) y «Enviar pedido» del comensal. Un doble toque
  en «Enviar a cocina» ya lo protege la bandera `loading` del pedido.
- La spec del toque no se añadió a la CI: el QA final (`qa-final/`) está fuera de `playwright.config.ts` (`testIgnore`) y
  necesita el servidor de la demo y los motores del laboratorio; se corre en local con `pw.sh <aparato> toque-seguro-del-mesero`.
- No se probó con un panel táctil de Windows real ni con el WebView de la iMin en el aparato; sí con el Chromium de Electron 156
  y, ver informe, con Chromium 99 del laboratorio.

## DP-D205 · DP-23 · Configuración → Apariencia: las tarjetas siguen el ancho del panel, no el de la ventana · 19-11-2026
- **Qué se vio (el dueño, en el restaurante):** en los POS de pantalla casi cuadrada (1024×768, 800×600) las tarjetas de
  «Estilo visual» salían apretadas y deformes: 87 px de ancho cada una, el importe de la vista previa («$439.00») se
  salía de su tarjeta, los nombres se partían letra a letra y la página desbordaba en horizontal (1030 px en una
  ventana de 1024). La causa: `grid-cols-2 sm:grid-cols-4` cambia de columnas con la VENTANA, pero el panel de
  Configuración pierde la barra lateral y el índice de secciones y queda mucho más angosto que ella.
- **Decisión:** las dos rejillas de `SelectorDeApariencia.tsx` (los ocho estilos y las cuatro perillas) usan
  `repeat(auto-fill, minmax(…, 1fr))`: 10,5 rem mínimo por tarjeta de estilo y 8 rem por perilla, y `max(…, 22 %)` para que nunca pasen de cuatro columnas (a 1366 con la barra plegada salían cinco y quedaba una fila de 5 + 3). Las columnas salen del
  ancho del panel, sin container queries (que no existen antes de Chromium 105) ni respaldo. A ancho de escritorio
  (panel de unos 730 px o más) siguen siendo cuatro columnas, de los mismos tamaños de antes.
- **Sin migración. No toca dinero ni inventario.**

## DP-D206 · DP-23 · El día cero, por pasos cuando la configuración del dueño difiere de la de arranque · 19-11-2026

- `pnpm dia-cero -- --en-serio` llama a `configurar-produccion.mjs --primer-folio`, que deja TODA la configuración de arranque
  (dos cajas a la vez, etc.), y su verificación final exige ese cupo. Con el negocio ya configurado por su dueño, los ceros se
  hacen por pasos (`dejar-en-ceros.mjs` y, en el cero final, `operacion-real.mjs`), sin `configurar-produccion.mjs`: lo que hay
  en producción manda.
- Pendiente (no se hizo hoy): que `dia-cero` acepte la configuración vigente en vez de la de arranque.

## DP-D207 · DP-23 · La pimienta de los PIN en los guiones · 19-11-2026

- `cargarEntorno()` toma `PIN_PEPPER` del `.env` local, que no es la de producción. Un guion que ponga un PIN en producción con
  esa pimienta deja a esa persona sin poder entrar. En DP-23 se comprobó ANTES de escribir (los hashes existentes no verificaban
  con la pimienta local y sí con la de producción) y el guion corrió con la de producción en el entorno.
- Regla: ningún guion escribe un PIN en producción sin comprobar antes la pimienta contra una credencial existente y sin verificar
  después cada PIN contra lo guardado. Pendiente: que los guiones que ponen PIN se nieguen si no pueden comprobarla.

## DP-D208 · DP-23 · El usuario de plataforma se va con la entrega · 19-11-2026

- Al dar de baja a «Miguel · Morphiq» se quita su marca de plataforma (DP-13.3b) y nadie ve ni ejecuta los botones de
  mantenimiento que borran en masa. Los guiones de mantenimiento (dejar en ceros, activar la operación, renombrar aparatos)
  exigen esa marca: para el cero final se marca a «Dueño» con `scripts/marcar-plataforma.mjs`, se corre y se le quita
  (`--quitar`) en la misma sesión.
- La contraseña del proveedor sigue valiendo, pero siempre encima de la sesión de alguien del personal y sólo para «Hardware y
  pruebas de impresión».

## DP-D209 · DP-23 · Lo que pidió la revisión independiente del toque seguro · 19-11-2026

- **Candado sólo donde lo que se espera son las opciones.** «Mientras `agregarAlCarrito` resuelve ese platillo, no entra otro» vale
  para el mesero y los demás que abren las opciones del platillo. En la caja de mostrador (`ProductCard` → `addToCart` de `POS.jsx`)
  cada toque manda un comando por red: con el servidor lento (800 ms) un segundo toque legítimo a 500 ms se perdía y la cajera cobraba
  1 en vez de 2. Opción `sinCandado` del gancho y de `BotonQueAgrega`, usada sólo ahí; quedan el reposo de 350 ms y las reglas del
  gesto. `CatalogoDelPedido` (para llevar) y el portal del comensal siguen con candado: lo que esperan son las opciones (lectura en
  caché) y el agregado es local.
- **El rechazo no se silencia.** La liberación del candado vuelve a lanzar el error (`liberarAlTerminar`): un agregado que falla sale
  como `unhandledrejection`, como antes.
- **Un gesto sin terminar caduca** (1 s desde que empezó): si nunca llegó `pointerup` ni `pointercancel`, un clic posterior sin
  puntero (teclado, lector de pantalla) no se mide contra un inicio viejo.
- **Sólo cuenta el desplazamiento de los contenedores del botón.** Se quitó el oyente global de `scroll`: un desplazamiento ajeno
  (la barra de secciones del menú digital, un `scrollIntoView` del teclado en pantalla) ya no anula el toque limpio del comensal.
  Uno en un ancestro del botón o en la página sí.

## DP-D210 · DP-24 · Quién quita y cancela: el mesero ya no; la caja con PIN; la gerencia sin PIN · 20-11-2026

Lo pidió Don Poncho tras la entrega. Sustituye a DP-12.4 (el mesero podía anular y cancelar) y a la parte del mesero de DP-D51.

- **El mesero** sólo quita lo que todavía NO manda a cocina (su carrito, que vive en su pantalla). Ya no anula un platillo
  enviado ni cancela una cuenta: `restaurante.anular_linea` y `restaurante.cancelar_orden` lo dejaron fuera de sus roles y
  `exigirPermisoParaCancelar` lo rechaza además por regla (un rol agregado por error a un comando no se cuela). En pantalla no
  ve los botones. Se quedan con él: mover de mesa, unir mesas, pasar la mesa a otro mesero y liberar una mesa VACÍA
  (`restaurante.liberar_mesa` no cancela consumo).
- **El cajero** quita o cancela SIEMPRE con el PIN de un gerente, administrador o dueño (autorización atada a ESA cuenta y a
  cancelar, de dos minutos). Ya no depende de que la cuenta se haya pedido o impreso, y el ajuste
  `pin_al_cancelar_cuenta_pedida` deja de leerse (una configuración vieja que lo traiga apagado no apaga nada).
- **Gerente, administrador y dueño**, sin PIN. El motivo sigue siendo obligatorio y todo queda en la auditoría con quién lo
  hizo y quién autorizó.
- **La otra puerta:** `restaurante.transicionar_pedido` a «cancelado» (ninguna pantalla lo manda) queda sólo para la gerencia.
- **Lo que sólo se confirmó (Parte 7):** con la asignación de mesas apagada, quien abre o atiende la mesa se queda con ella
  (`portal/sin-asignacion.integracion.test.ts` y una prueba nueva de «el mesero que abre la mesa se queda con la cuenta»). El
  Tablero no se tocó: cambia de día a la medianoche de America/Mexico_City y el corte no lo reinicia.

## DP-D211 · DP-24 · El menú: un solo orden, colores de una paleta y la hoja de comanda como orden inicial · 20-11-2026

Lo pidió Don Poncho tras la entrega.

- **Un solo orden** para el portal QR, la rejilla del mesero, la de la Caja y el buscador: la categoría (su `orden`), el lugar
  del platillo en ella (`productos.orden_en_categoria`, migración 196) y el nombre. Un platillo que nadie ordenó va al final de
  su categoría, por nombre: mientras nadie ordene, el menú se ve igual que antes. Al cambiar de categoría, el platillo pierde su
  lugar (lo anula un disparador, también si el cambio no viene de un comando).
- **Dónde se ordena:** sólo en Configuración → Portal de comensales → «El orden del menú» (↑ ↓ y «En el menú / Oculto»).
  «Personalizar menú» ya no ordena secciones: remite ahí. Ordenan y cambian categorías el gerente, el administrador y el dueño;
  el mesero y la cajera, no. Si dos personas ordenan a la vez, la segunda recibe un conflicto y se vuelve a leer.
- **El color de la categoría** es la CLAVE de una paleta fija de 16 (`cat-1` … `cat-16`), nunca un color suelto: sus valores en
  claro y en oscuro son tokens de la interfaz y su contraste se mide en la CI. La pestaña lleva el color, un punto y el nombre;
  la tarjeta, una franja.
- **Unir y mover:** la categoría que sobra al unir se APAGA, no se borra. Unir categorías y mover platillos se niegan si al
  platillo le cambiaría la estación de preparación.
- **El orden inicial de Don Poncho es su hoja de comanda de papel**, puesto por un guion que usa los comandos de la aplicación
  (`scripts/ordenar-menu-produccion.mjs`): lo que no viene en la hoja va al final de su categoría; los «(extra)» de Cerveza se
  apagan sólo si ninguna cuenta abierta los trae y su lugar lo toma el grupo de opciones «Prepárala».
- **No se crea ningún producto ni se inventa ningún precio.** Quedan pendientes de Miguel: los seis productos de la hoja que no
  existen y el precio del alcohol adicional de Paloma, Charro negro y Piña colada sin alcohol.

## DP-D212 · DP-24 · Las copias se leen al imprimir, y el permiso de la impresora se da desde el error · 20-11-2026

Lo pidió Don Poncho tras la entrega: guardó 2 copias en un POS, otro siguió imprimiendo 1 y un tercero sí imprimió 2.

- **La causa:** las copias vivían en una variable del módulo que sólo llenaba una consulta de la barra de impresión (un minuto
  de caducidad, sin releer al enfocar). Un aparato que no recargaba imprimía con lo que leyó al abrir. El servidor estaba bien.
- **Las copias se leen del servidor en CADA impresión** (`copiasAlImprimir`, una sola función para todos los caminos, con un
  plazo de 4 s). Si el servidor no contesta, sale con la última lectura buena de ESE aparato (en memoria y en su almacenamiento)
  y se dice; si nunca hubo una, sale 1 copia y se dice: el ticket ya cobrado tiene que poder salir.
- **El diálogo de imprimir del navegador también reproduce las copias** (antes las ignoraba). La reimpresión sigue siendo un
  solo papel (DP-20).
- **`SIN_PERMISO`:** el aviso del fallo trae el botón «Dar permiso a la impresora», sin contraseña del proveedor: llama a
  `pedirPermiso(destino)` del puente, dice «Permiso concedido ✓» y reintenta la MISMA impresión (mismo id, con sus copias).
- **La app de Android** declara el filtro `USB_DEVICE_ATTACHED` (clases 7 y 255) para que Android ofrezca «usar de forma
  predeterminada» y el permiso se quede. Va en su repositorio y **no se sube versión ni se publica APK hasta probarlo en el
  iMin**: si su impresora no es USB o Android no la «conecta» al arrancar, queda el botón (un toque por arranque).

## DP-D213 · DP-24 · Unir mesas poco a poco: a un grupo vivo se le agregan mesas · 20-11-2026

Lo pidió Don Poncho tras la entrega: juntan las mesas conforme llega la gente, y unir rechazaba toda mesa que ya estuviera en un
grupo («Sepáralo antes de unir otro»).

- **`restaurante.agregar_a_la_union`**, con los permisos de unir, reusa el núcleo de unir (`sumarMiembros`): no hay un segundo
  camino. **Todo va a la principal de la PRIMERA unión**: la cuenta del grupo no cambia y lo que traen las mesas que entran (su
  cuenta, sus comandas en cualquier estado, sus avisos y sus alergias) se MUEVE a ella.
- **Si la mesa que se agrega es la principal de otro grupo, entra todo ese grupo**: sus mesas pasan a esta unión y la suya se
  cierra sin separar a nadie. Una mesa absorbida en otro grupo no entra sola: se agrega su principal.
- **Qué entra:** las cuentas vivas, incluida la «cuenta pedida» (como al unir). No entran las cobradas, divididas ni canceladas,
  ni una mesa en limpieza o de otra sucursal; y a un grupo que ya se cobró no se le agrega nada. Misma zona y mismo perímetro
  que al unir.
- **Separar** deshace el grupo entero, no la última ampliación, y cada mesa vuelve a donde estaba antes de SU unión. El grupo se
  cobra una vez.
- En el mesero, desde la mesa principal del grupo: «Agregar mesas».

## DP-D214 · DP-24 · La cocina por platillo, el aviso de «listo» al mesero de la mesa y la nubecita · 20-11-2026

Lo pidió Don Poncho tras la entrega. La base ya guardaba el estado de cada platillo; faltaba llevarlo a las pantallas.

- **La cocina mueve cada platillo por separado** (Nuevo / En preparación / Listo), con un bloque por mesa en cada columna y su
  botón para el bloque completo (`restaurante.mover_platillos`: sólo mueve lo que SIGUE en esa columna; un toque tardío sobre un
  platillo que otro cocinero ya adelantó no falla ni lo regresa). Los permisos son los de siempre de la cocina.
- **El estado de la comanda y el de la mesa se derivan de sus platillos** en el servidor (la comanda va en el de su platillo
  menos avanzado). Un platillo suelto que no cambia a su comanda ya no mueve la mesa.
- **«Marcar entregado» entrega platillos, no comandas enteras** (`restaurante.entregar_pedidos`): lo que ya está listo de esa
  estación; la misma tarjeta lo vuelve a ofrecer cuando sale otro. Se conserva la etiqueta «Marcar entregado». Si la cuenta ya
  está cobrada, lo que sale listo se da por entregado.
- **El aviso grande de «listo» es sólo para el mesero de ESA mesa** (el asignado o, sin asignación, quien la atiende), y lo
  decide el servidor (`restaurante.avisos_de_listo`, sólo rol mesero): ni el administrador, ni la caja, ni la vista general. No
  guarda nada: es lo «listo y sin entregar» de sus mesas; quitarlo es «ya lo vi» y lo recuerda el aparato. Nunca tapa los
  botones de la mesa.
- **La nubecita** junto a la mesa dice cada estación («Cocina 2/4», «Bebidas ✓»); el color del estado de la mesa no cambia.

## DP-D215 · DP-24 · La tarjeta de cobro: una sola vista, y se teclea lo que de verdad pasa · 20-11-2026

Lo pidió Don Poncho tras la entrega («la Caja controla TODO al cobrar»). Sustituye al diálogo de cobro de la Caja heredada.

- **Una sola vista** (`TarjetaDeCobro`): los platillos, el subtotal, la propina, las formas de pago, lo recibido, el cambio y el
  total, sin diálogos encimados y sin desplazarse en 1024×768 ni en 800×600. La cuenta la hace un módulo puro y en centavos
  (`cuenta-del-cobro.ts`); el total lo sigue recalculando el servidor.
- **La función pequeña que se agregó:** un teclado de importes dentro de la tarjeta. Los campos no abren el teclado del sistema
  (`inputMode="none"`), que taparía media tarjeta en una pantalla táctil; con teclado físico se teclea igual.
- **Efectivo.** «Recibido» vacío es importe exacto. Un «Recibido» tecleado MENOR a lo que toca en efectivo no se cobra: el botón
  se apaga y dice «Faltan $X en efectivo» (la falla del informe 013: se cobraba como exacto, con «Cambio $0.00»). Los atajos
  (Exacto, $100, $200, $500, $1,000) PONEN lo recibido, no lo suman.
- **Varias tarjetas.** «Dividir en tarjetas» abre Tarjeta 1, Tarjeta 2 y «Agregar tarjeta» (hasta 10; el cobro acepta 12 pagos).
  Lo que se teclea en cada una es lo que se le cobra, con la propina dentro; tiene que sumar total + propina o no deja cobrar y dice
  cuánto falta o sobra. En «Mixto» el resto es efectivo. El ticket dice UNA línea «Tarjeta» con la suma; el corte y Registros
  guardan cada pago por separado.
- **De dónde sale la propina** cuando hay más de un método: primero del efectivo («la cuenta con tarjeta y la propina en
  billete»), luego de la última tarjeta hacia atrás y al final de la transferencia; quien cobra puede decir «con tarjeta» o «por
  transferencia». Nunca un reparto proporcional.

## DP-D216 · DP-24 · La propina se elige en la tarjeta de cobro; se acabó la pregunta aparte · 20-11-2026

- Botones con los porcentajes de la Configuración, «Otro monto» y «Sin propina»; se cambia hasta antes de cobrar. Tocar otra
  propina ES cambiarla a propósito (`cuenta.fijar_propina` con `cambiar`), respetando «una sola verdad» (DP-21 · Bloque 4): viaja
  con la versión de la cuenta y, si cambió, el servidor contesta la vigente y el cobro se rechaza.
- La que eligió otra pantalla (los comensales por el QR, el mesero) llega YA PUESTA a la tarjeta, que lo dice ahí mismo («…Ya
  está puesta en la cuenta; aquí la puedes cambiar»). Ya no hay aviso que interrumpa con «Usar ésa / Cambiarla».
- Cobrar sin haber elegido es «sin propina», decidida por la Caja.
- **El cambio como propina:** cuando sobra cambio aparece «Dejar los $X de cambio como propina». Si se deja, pasa a la propina
  (como monto) y el cambio queda en $0; si no, se entrega. Tocar otro importe u otra propina lo deshace.

## DP-D217 · DP-24 · La Caja modifica la cuenta que está cobrando · 20-11-2026

- **Agregar y Para llevar** (`restaurante.agregar_en_caja`: cajero, gerente, administrador y dueño): el mismo buscador y la misma
  rejilla del pedido para llevar. Lo agregado sale a cocina en ese momento. Una cuenta «pedida» se queda pedida (no vuelve a la
  mesa) y sube su versión, así que un cobro armado con el total de antes se rechaza. «Para llevar» va marcado en la nota del
  renglón y de la comanda («PARA LLEVAR · …»), sin migración. No se le agrega a una parte de una cuenta dividida ni a un pedido
  para llevar (ése se corrige en el suyo).
- **Quitar** un platillo desde la tarjeta usa el diálogo de siempre y la regla de DP-D210: motivo obligatorio; el cajero, con el
  PIN de un gerente, administrador o dueño; la gerencia, sin PIN.
- **Dividir, Descuento y Cancelar** se quedan como estaban, en sus diálogos.
- **«Pasar platillos a otra cuenta» NO existe** en el sistema (informe 013 §12: de 3 a 4 días). Queda como propuesta; hoy no se
  construyó.

## DP-D218 · DP-24 · Liquidar propinas en el corte: el mismo comando, y lo entregado sale del cajón · 20-11-2026

- El corte tiene «Propinas del día» por persona (cuentas atendidas, propina y «Liquidar»), con lo pendiente desde que abrió ESA
  caja. Es opcional. No es un segundo camino: abre el diálogo del Tablero y llama a `propinas.liquidar` con `entregarDeLaCaja`.
- **Lo entregado queda como salida de la caja** (movimiento `propina_entregada`, negativo, por el total liquidado: es lo que se le
  da en billetes a la persona, haya entrado la propina en efectivo o con tarjeta). El efectivo esperado baja lo mismo y el conteo
  cuadra (la otra falla del informe 013). Sin caja abierta en ese aparato no se puede entregar «de la caja».
- **Quién liquida:** la gerencia, sin PIN. La cajera sólo desde el corte y con el PIN de un gerente, administrador o dueño por ESE
  importe (sirve una vez). Desde el Tablero sigue siendo sólo la gerencia y no mueve ningún cajón.
- Al terminar el corte (con su PDF) se ofrece «Liquidar propinas» a la gerencia: es la del Tablero (la caja ya cerró).
- **Quién aparece**, aquí y en el Tablero: sólo quien vende, cobra o atiende cuentas (mesero, cajero, gerente, administrador o
  dueño). Nunca cocina, bebidas ni almacén. La atribución de cada propina (quien atendió la cuenta) no cambió.

## DP-D219 · DP-25 · Varias entregas de propina en el mismo turno: la entrega tiene su propia columna · 21-11-2026

- **Contexto.** DP-D218 guardó la caja de la que salía cada entrega en `liquidaciones_propina.sesion_caja_id`. Esa columna es la
  del REPARTO del turno (087, F-248) y su índice `liquidaciones_un_reparto_por_turno` la hace única por turno: la primera entrega
  del turno pasaba y la segunda salía «Algo falló de nuestro lado» (la verificación de DP-24 lo reprodujo; nada quedaba a medias).
- **Decisión.** La entrega se guarda en su columna nueva, `entregada_en_sesion_caja_id` (migración 197, aditiva, con su llave
  foránea y un índice). Caben todas las entregas que haga falta en un turno, una por una. `sesion_caja_id` y su índice único no
  se tocan: un turno se sigue repartiendo UNA vez.
- **Lo que no se paga dos veces** no cambió y ahora tiene prueba de integración: el reclamo de las órdenes es un solo `UPDATE` con
  `propina_liquidacion_id is null` en el `WHERE` (dos a la vez: sólo una gana), la llave de idempotencia devuelve la misma
  respuesta al mismo toque, y el diálogo ya no manda un segundo toque mientras va el primero.
- **Alternativas descartadas.** Volver el índice de la 087 parcial (`where reparto_base is not null`): no es aditivo y aflojaba la
  protección del reparto. Dejar de recordar la caja de la entrega: Registros ya no podría decir de dónde salió el dinero.
- **Consecuencias.** Producción tenía una sola liquidación (del 19-11, sin caja), así que la migración no rellena nada.

## DP-D220 · DP-25 · Liquidar desde el Tablero pregunta de qué caja sale el dinero · 21-11-2026

- **Contexto.** La liquidación del Tablero (y de Registros) no movía ningún cajón: si el dinero salía de una caja abierta, su
  corte salía con sobrante.
- **Decisión.** Si hay cajas abiertas en la sucursal, el diálogo pregunta «¿De dónde sale el dinero?»: el cajón de cada caja
  abierta (por su nombre, «Caja 1 · Aparato 33») o «Fuera de la caja». Nada viene elegido: sin elegir no se liquida. Con una caja,
  el servidor registra la salida `propina_entregada` en ESA caja (el mismo camino del corte, `sesionCajaId`) y su esperado baja.
  Sin cajas abiertas, el diálogo dice que queda pagada fuera de la caja. Registros dice de cada liquidación «Salió del cajón» o
  «Fuera de la caja».
- **Permisos.** Elegir otra caja es de la gerencia; la cajera entrega sólo de su propio cajón (desde su corte y con PIN). Una caja
  cerrada no se elige, y la caja se toma bloqueada (`FOR NO KEY UPDATE`): si otro la cierra a la vez, la entrega la ve cerrada y no
  se hace.
- **Alternativa descartada.** Sacarlo siempre de la caja del aparato: el Tablero suele abrirse en un teléfono o en la oficina, sin
  caja.

## DP-D221 · DP-25 · El PIN de quitar y de cancelar es de un solo uso · 21-11-2026

- **Contexto.** La firma del PIN de un gerente para quitar o cancelar quedaba atada a la cuenta y a «cancelación», pero no se
  gastaba como la de los descuentos y la del cajón (lo señaló la verificación de DP-24; venía de antes).
- **Decisión.** Las dos pasan por `venta/autorizacion-de-un-uso.ts`, como los descuentos y el cajón: cada firma vale para UNA
  acción, de UNA cuenta, por pocos minutos. Se gasta dentro de la transacción (si la acción se revierte, la firma sigue servible) y
  dos usos a la vez se forman en fila: el segundo recibe «Esa autorización ya se usó…» con `pidePin`, y el diálogo vuelve a pedir el
  PIN. La gerencia y el dueño siguen sin PIN.

## DP-D222 · DP-25 · Cada pago por separado en el detalle de la venta, Registros y el corte · 21-11-2026

- **Contexto.** Lo que DP-D215 no cumplió del encargo (1.4): una venta cobrada con varias tarjetas y efectivo se leía «Mixto» con
  un total por método.
- **Decisión.** Cada pago se lista por separado, en el orden del cobro: «Tarjeta 1», «Tarjeta 2», «Efectivo» (con lo recibido y el
  cambio) y la propina de cada uno; un solo método no lleva número; un pago devuelto lo dice. Sale en el detalle de la venta (Ventas
  y «Ver ticket» de Registros, sin imprimirse en el ticket), en el visor del corte de Registros y en el PDF del corte («Pagos, uno
  por uno», debajo de los totales por método, que se quedan). Los datos son los de `pagos` (la entidad de lectura `PagoDeVenta` y la
  hoja del corte del servidor); nada se recalcula. El ticket del cliente sigue con una sola línea «Tarjeta».

## DP-D223 · DP-25 · Parte 4 · La mesa que cambia es la de la CUENTA, y los toques de la cocina salen en fila por cuenta · 21-11-2026

Lo vio Don Poncho en la capacitación con dos estaciones («terminó la cocina y la mesa siguió naranja», «la palomita no sale»), y la
verificación de la mañana (`mini-jornada-de-cocina`, 3 fallos de 15 con la laptop cargada).

- **Causa 1 (servidor).** Al unir mesas, las comandas de la cuenta absorbida pasan a la cuenta de la principal pero conservan su
  `comandas.mesa_id`. La cocina movía «la mesa de la comanda» (`sincronizarMesa`): lo que se terminaba de la mesa absorbida cambiaba
  una mesa que el mapa no enseña, y la principal se quedaba en «pedido enviado» o «en preparación» aunque todo estuviera listo.
  Ahora `sincronizarMesa` mueve la mesa de la CUENTA (`ordenes.mesa_id`, que en una unión es la principal); `entregar_pedidos` y
  «cancelar lo que faltaba» ya lo hacían así.
  La Parte 6 (DP-D226) ya reapunta `comandas.mesa_id` a la principal al unir, así que las uniones NUEVAS no tienen el defecto en su
  origen; esto queda como segundo cerrojo para las uniones que ya estaban vivas antes de ese cambio (la prueba cubre las dos).
- **Causa 2 (pantalla de cocina).** Los toques salían en UNA sola fila para toda la cocina («`cocina`»): cada «Listo» esperaba a los de
  todas las demás mesas. Con la pantalla cargada el último toque llegaba al servidor 1.6 a 3 s después de verse hecho (medido con la
  CPU estrangulada 4×), y quien lo leía en ese momento veía el platillo todavía «en preparación». La fila es ahora POR CUENTA: los
  toques de una cuenta siguen en orden (un «Listo» nunca adelanta a su «Preparar») y las demás cuentas no se esperan. El servidor ya
  serializa por cuenta, así que no se pierde nada.
- **Causa 3 (servidor, la que SÍ perdía toques).** El `lock_timeout` de 3 s se pone al reclamar la clave del comando y vale para TODA
  la transacción. Cocina y Cantina tocando la misma cuenta con la laptop cargada: la segunda esperaba el candado de la cuenta más de
  3 s, Postgres contestaba 55P03, el servidor lo sacaba como 500 «Algo falló» y el toque —ya pintado en la pantalla— no se guardaba.
  Medido en la mini jornada con CPU 4×: un 500 `restaurante.transicionar_pedido sqlstate=55P03`, y ese platillo se quedó «en
  preparación» en el servidor tras 30 s de espera. Ahora `comando.ts` repite también la espera de candado agotada (55P03), igual que
  el interbloqueo (40P01): la transacción se revirtió entera y repetirla es seguro. La espera de la CLAVE sigue siendo «comando en
  curso».
- **Causa 4 (pantalla de cocina, el «Preparar» que se perdía).** Cada toque sacaba su aviso verde («Platillo en preparación») y en
  el teléfono y la tableta se apilaban hasta cuatro sobre las tarjetas. El toque siguiente caía sobre el aviso y no sobre el botón:
  el navegador veía el clic, pero ningún pedido salía al servidor (medido con la CPU 4× y el trace: abajo+1, arriba+1, clic+1, sin
  POST, y el propio Playwright registra que un aviso de `sonner` interceptó el toque). Ahora los avisos informativos de la cocina
  dejan pasar el toque (`pointer-events: none`, sólo ésos: `AVISO_SIN_TOQUE` en `Cocina.jsx`); el `Toaster` global y cualquier
  aviso con botón (Deshacer, Reintentar, Ver) siguen recibiendo toques, y el contrato lo ata. El «toque seguro» de `tacto/` no
  interviene: la cocina no lo usa.
- **Lo que NO es un fallo** (comportamiento de DP-D214): con dos estaciones la mesa sigue «en preparación» mientras la otra estación
  no termine. Cada estación dice su avance en la nubecita del mapa; hacerlo más visible es la Parte 3.4.
- **Pruebas.** Integración `cocina-de-la-mesa-unida.integracion.test.ts` (en rojo antes del arreglo) y la mini jornada con la CPU
  estrangulada (`COCINA_CPU=4`), que ahora espera a que el servidor llegue a lo que la pantalla ya pintó (DP-7: se pinta antes de
  contestar).
- **Alternativas descartadas.** Derivar la mesa al leer (cambia el contrato del mapa y de los avisos); quitar la pintura anticipada de
  los toques (la cocina vería lento cada toque).

## DP-D224 · DP-25 · Pedir la cuenta con platillos sin entregar: se avisa en el servidor y se pide con confirmación · 21-11-2026

- **Contexto.** El mesero podía pedir la cuenta con la mesa todavía esperando platillos, sin enterarse: la cuenta salía con lo
  que faltaba por llegar y la Caja la cobraba. En la capacitación se pidió que se pueda pedir (a veces la mesa se va), pero
  sabiéndolo.
- **Decisión.** `restaurante.solicitar_cuenta` recibe `aunConPendientes` (booleano). Sin él, si la cuenta tiene platillos vivos
  que no están entregados, rechaza con la regla `CUENTA_CON_PENDIENTES` y NO escribe nada. La lista viaja en `datos.pendientes`
  (texto JSON, porque los datos de un error sólo llevan escalares) y va por estación, en dos bloques: «sin preparar» (nuevo y en
  preparación) y «listos sin entregar». Entregado y cancelado no cuentan; con todo entregado se pide normal. La estación es el
  nombre que la comanda guardó (como esté configurada).
- **Dónde vive.** En el servidor, para que valga igual en la tableta del mesero, en el mapa del administrador y en cualquier
  pantalla futura. Las dos pantallas que piden la cuenta (`Mesero.jsx` y `PedirLaCuentaDialog`) abren el mismo aviso
  (`AvisoDePendientesDeLaCuenta`): «Regresar» no cambia nada y «Pedir la cuenta de todos modos» reintenta con la confirmación
  (con otra clave de idempotencia, porque el cuerpo cambia).
- **Lo que NO cambia.** `portal.pedir_cuenta` (el comensal por el QR) no se bloquea: le llega al mesero, que ve el aviso al pedirla.
  `restaurante.imprimir_precuenta` no cambia el estado de la cuenta, así que no lleva la regla. La Caja no pide cuentas: cobra
  las ya pedidas. Los roles de `solicitar_cuenta` son los mismos.
- **Alternativas descartadas.** La confirmación por omisión (anula la regla); bloquear la cuenta mientras haya pendientes (la
  mesa que se va no podría pagar); avisar sólo en la pantalla (cada pantalla nueva se olvidaría).
- **Consecuencias.** Toda prueba que pida la cuenta sin haber entregado debe mandar `aunConPendientes: true` (o entregar
  antes): se adaptaron las de integración y las e2e sin quitarles afirmaciones. No hay migración.

## DP-D226 · DP-25 · Unir mesas poco a poco, sin forma de equivocarse: unir con una mesa que ya está en un grupo es agregar · 21-11-2026

**Contexto.** Durante la capacitación los meseros unieron mesas cuatro veces con «Unir mesas» y nadie usó «Agregar mesas» (DP-D213). Los
rechazos no quedan en la auditoría, así que no se ve qué intentaron y falló. Con «Unir mesas» una mesa que ya estaba en un grupo daba
«ya pertenece a un grupo»; desde la principal de un grupo, «Unir mesas» abría el mapa sin poder sumar nada; y una mesa absorbida no
decía a cuál estaba unida. Además, al absorber una cuenta el renglón perdía de qué mesa venía, y cocina seguía diciendo la mesa que se
levantó.

**Decisión.**

- **El servidor decide, no la pantalla** (`unir-con-un-grupo-vivo.ts`, `restaurante.unir_mesas`): si alguna de las mesas elegidas (la
  principal o las que se unen) ya está en un grupo, la unión **es** agregar a ese grupo (`restaurante.agregar_a_la_union`, el mismo
  cuerpo, no un segundo camino). Vale para todas las pantallas.
- **Quién queda de principal:** la del grupo que ya existe. Si lo elegido toca **dos grupos**, gana el de la principal elegida (esté en
  él como principal o absorbida); si la elegida está libre, el de la primera mesa que se nombró que ya esté en uno. El otro grupo entra
  **entero**, por su principal, sin separar a nadie (como ya hacía «Agregar mesas»). Si todas las elegidas ya son del mismo grupo no hay
  nada que agregar y se dice («Esas mesas ya están unidas en el mismo grupo.»). Lo que no entra se sigue rechazando como siempre (otra
  sucursal, limpieza, cuenta cobrada, perímetro y zona). Las posiciones que el mapa mande de la principal del grupo y de sus mesas se
  descartan: sólo se mueven las que entran.
- **La carrera que revisó la auditoría de la mañana era real.** `agregar_a_la_union` leía el grupo, sus miembros y los grupos ajenos
  ANTES del candado y no los volvía a leer: dos meseros que agregaban a la vez revisaban el perímetro cada uno sin la mesa del otro, y
  juntos se pasaban del límite (720 de largo contra 640). Ahora se lee, se bloquea y **se vuelve a leer con el candado puesto**; lo que
  aparezca y no estuviera cubierto se bloquea también, y si aun así cambia, se rechaza («Ese grupo cambió mientras se agregaba»).
- **Cada renglón dice de qué mesa vino** (migración 201, aditiva: `orden_lineas.mesa_origen_numero`, nula = es de la propia mesa). Se
  guarda al absorber una cuenta (si ya traía origen, lo conserva) y se muestra «(Mesa 7)» junto al platillo en la cuenta de la mesa y en
  la precuenta. Es una instantánea del número, como `producto_nombre`; no toca importes. En la hoja que imprime el servidor
  (`restaurante.imprimir_precuenta`) cada renglón trae `mesaOrigen`.
- **Cocina dice la mesa principal:** las comandas que pasan a la cuenta del grupo se reapuntan a la mesa principal (`comandas.mesa_id`),
  igual que ya hace «Cambiar de mesa». Los avisos de «listo» (DP-D214) salen de la cuenta, así que van al mesero de la principal.
- **Aviso al unir o agregar:** el comando devuelve `cuentasQuePasaron` y la pantalla dice, por cada mesa que traía consumo, «La cuenta
  de la mesa 7 pasó a la mesa 3.».
- **Pantallas.** En el mapa, con un grupo como ancla las mesas que se pegan (o se tocan) entran a él y el botón dice «Agregar al grupo»
  (no se elige número: queda su principal). Una mesa absorbida dice a cuál está unida, lleva a ella y ofrece «Agregar mesas» (≥ 44 px):
  se ve desde cualquier mesa del grupo.

**Alternativas descartadas.** Rechazar con un mensaje mejor (sigue siendo un error para el mesero); resolverlo sólo en el mapa (otras
pantallas y la API seguirían rechazando); guardar el origen del renglón en una tabla aparte o deducirlo de la comanda (las líneas que
aún no se mandan a cocina no tienen comanda); elegir la principal «la que tenga más mesas» (el mesero ya la conoce: la de siempre).

**Consecuencias.** Una unión elegida con otra principal que la del grupo deja la del grupo: el mesero lo ve en el aviso («queda la N»).
La cuenta de una mesa absorbida desde antes de la migración no trae origen (nada que mostrar). Caja (`TarjetaDeCobro`) no muestra el
origen todavía: es de la Parte 1. Toca `restaurante.imprimir_precuenta` y `Precuenta.tsx` (Parte 2) con el cambio mínimo.
