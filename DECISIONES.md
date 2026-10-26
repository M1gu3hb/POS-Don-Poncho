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
