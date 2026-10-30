# 004 · Diseño, UI y UX (DP-11)

Se llena al cerrar cada paso. Sin secretos ni PIN: los accesos viven en `..\_PRIVADO\` y los PIN
de demo en la carpeta temporal de la PC.

## DP-11.0 · Inventario, línea base y plan (29-10-2026)

- **Qué quedó:** el inventario de pantallas, la línea base de rendimiento y el plan, en
  `docs/diseno/INVENTARIO-DP-11.md`; el medidor `scripts/medir-fluidez.mjs`; DP-D35 (publicación
  paso a paso en `main`), DP-D36 (el diseño va a las pantallas reales) y DP-D37 (id al azar por
  http). Rama `dp-11`.
- **Evidencia:** `docs/reports/evidencia-004/fluidez-antes.json` (CPU 4×, tableta y teléfono).
  `idAlAzar`: unidad y contrato en verde, seis mutaciones muertas, tipos y lint en verde.
- **Escrito en producción:** las posiciones de las 10 mesas (decisión de Miguel: cuadrícula 5×2,
  1–5 arriba y 6–10 abajo), con `scripts/acomodar-mesas.mjs` por `puente.escribir`, el 30-10 entre
  01:06:21 y 01:06:29 UTC. Comparado con exportaciones de antes y después: sólo cambiaron `mesas`
  (10 posiciones), `auditoria` (+10) y `comandos_ejecutados` (+10). Huella de las otras 10
  organizaciones IDÉNTICA (119 tablas). Lecturas: Don Poncho con 0 órdenes y 0 pagos.
- **La demo de `fase-b`** para Miguel quedó en `.work/demo-fase-b` con su lanzador
  `.work/demo-fase-b.ps1` (fuera del repositorio), sobre la base desechable
  `don_poncho_demo_faseb`.
- **Pendientes:** la distribución REAL del salón (hoy es una cuadrícula para que se pueda tocar
  cada mesa): el dueño la ajusta en Configuración → Mesas arrastrándolas.

## DP-11.1 · Morfi en el POS (29-10-2026)

- **Qué quedó:** Morfi en la carga de pantalla completa (al entrar con PIN o recargar: «Cargando
  tu caja», «Cargando las mesas»…), en la carga del menú del portal QR, en la página que no
  existe y en el QR que no lleva a ninguna mesa. Nada se ve antes de 600 ms; las manos quedan en
  la orilla de la tarjeta por cálculo (prueba); nunca dos clips a la vez; se cierra con un toque.
  WebM con transparencia (Chrome, Edge, Firefox, Android), WebP animado a 15 cuadros (Safari, todo
  el iPhone y el iPad, también los navegadores dentro de WhatsApp o Instagram) e imagen fija con
  «reducir movimiento». Interruptor «Mascota Morfi» por negocio en Configuración → Apariencia,
  encendido por omisión (`configuracion.valores.experiencia`, sin migración). DP-D38, ficha 14.
- **Fuente:** `M1gu3hb/Morfi-pet` `c61aab2`, clips 03, 07 y 11 (partido en dormido y despertar
  para DP-11.2). Pesos: WebM 2.2 MB los cuatro, WebP 3.9 MB, fijas 23 KB cada una.
- **De paso, en el teléfono:** Configuración → Apariencia se desbordaba a lo ancho (543 px en un
  teléfono de 412) y el interruptor quedaba fuera. Causa: el `<main>` de `AppLayout` (hijo de
  flex sin `min-w-0`) crecía con el contenido más ancho; y el `fieldset` de las voces no dejaba
  encoger sus renglones. Dos clases, declaradas en `verify:aspecto`.
- **Evidencia:** unidad e integración (Postgres) en verde; 18 mutaciones de la lógica y del
  servidor, 18 muertas (dos sobrevivientes destaparon el caso de los navegadores dentro de apps
  del iPhone y del iPad, que ahora tiene prueba); `verify:adopcion` reconoce `PantallaDeCarga`
  como la espera de una pantalla entera (con su prueba roja/verde); `verify:aspecto` con los
  cambios del heredado declarados.
- **Navegador:** `pruebas/e2e/morfi.spec.ts`, 18 de 18 en escritorio, tableta y teléfono: el 404
  con el clip que SE REPRODUCE y se cierra con un toque; la imagen fija con «reducir movimiento»;
  el WebP (y que carga) con la identificación de un iPhone; el QR sin mesa; la carga larga (en
  300 y 590 ms, con la animación detenida, no se ve; luego sí, con Morfi); y con «Mascota Morfi»
  apagada, sin Morfi, y el interruptor la vuelve a encender (que la pestaña quepa a lo ancho en
  el teléfono también se comprueba).
- **Revisión independiente** (subagente Sonnet, sólo lectura): sin críticos ni altos. Atendido:
  el video lleva su imagen fija de `poster` y, si no se puede reproducir, se queda en ella; el
  WebP cuenta su duración desde que carga; el portal ya no ofrece «Volver a intentar» en un QR que
  no sirve. Anotado sin cambiar: el servidor lee dos veces la fila de configuración al pintar
  (apariencia y experiencia), costo despreciable.

- **Mutaciones de navegador:** 3 de 3 muertas (el 404 que ignora «Mascota Morfi», el `<main>`
  sin `min-w-0` y la carga sin Morfi). En total, 21 de 21.
- **Publicación:** `main` = `6d53338` (avance sin fusión), CI `40987070269` verde; Production
  lista; humo verde (raíz 200, el 404 con «Esta página no existe», los clips servidos, el QR
  inválido con su mensaje); huella de las otras 10 organizaciones IDÉNTICA (119 tablas,
  01:59:58 → 02:23:10 UTC del 30-10). `fase-b`: fusión `dacea35` (dos conflictos de texto
  resueltos con lo de los dos lados), CI `40991954903` verde.

## DP-11.2 · El modo espera (29-10-2026)

- **Qué quedó:** tras unos minutos sin tocar (3 en Caja, Tablero y administración; 2 en Cocina),
  una capa casi negra con la hora de la Ciudad de México, la fecha, el logo y Morfi dormido; hora
  y logo se mueven muy despacio contra el quemado. Al tocar, Morfi despierta y la pantalla vuelve
  tal cual (es una capa: lo tecleado sigue ahí); otro toque se salta el despertar. Nunca en el
  mesero, el mapa, la mesa activa, el portal ni el teléfono de cocina. La despierta sola una
  comanda nueva (Cocina) o una cuenta pedida o un cobro de otra terminal (Caja), sin peticiones
  nuevas: escucha las lecturas que esas pantallas ya hacen. Cocina con comandas por preparar no se
  duerme. Wake Lock mientras el puesto admite espera. Por aparato (Configuración → **Este
  aparato**, pestaña nueva): encendido y minutos. Por negocio (Apariencia): «Pedir PIN al
  despertar», apagado; usa la entrada de siempre con su límite de intentos, sin recargar.
  DP-D39, ficha 15. Sin migración.
- **Hallazgo al probar:** las pruebas adelantaban el reloj de Playwright antes de que la pantalla
  se montara; el modo espera empezaba a contar DESPUÉS del salto. Dos pruebas fallaban por eso y
  una («apagado, no se duerme») pasaba sin probar nada. Ahora cada prueba espera a que la pantalla
  esté pintada antes de mover el reloj (anotado en la ficha 15 para el maestro).
- **Evidencia:** unidad en verde (reglas, preferencia del aparato, reloj, despertador, cambios de
  la lista, experiencia); 18 mutaciones de la lógica, 18 muertas (tres sobrevivieron al principio
  y destaparon huecos reales: minutos de más de una hora, minutos con decimales y la hora con la
  zona del aparato, que en esta PC es la misma que la del negocio); `verify:adopcion`,
  `verify:aspecto` (la pestaña nueva declarada) y los demás guardianes en verde.
- **Navegador:** `pruebas/e2e/modo-espera.spec.ts`, 36 de 36 en escritorio, tableta y teléfono (y
  tres omitidas a propósito: el toque en la PC y el menú lateral en tableta y teléfono),
  con el reloj de Playwright: Caja a los 3 minutos y no antes, con la hora y Morfi; una cuenta
  pedida despierta la Caja; el mesero nunca; Cocina se duerme a los 2, una comanda nueva la
  despierta y con pendientes no se vuelve a dormir; vuelve con lo tecleado y el despertar se
  salta; «reducir movimiento» duerme en la imagen fija; Este aparato (minutos y apagado); y con
  «Pedir PIN al despertar», un PIN equivocado no deja volver y el bueno sí, sin perder lo
  tecleado; recargar no quita el candado y el Tab no sale de su capa; una cuenta pedida despierta
  al PIN y no a la caja, la pantalla del PIN vuelve a dormirse y «Cambiar de persona» lleva a la
  entrada; un diálogo abierto debajo sigue abierto y un toque no cae en el botón de abajo; ni Esc
  dos veces ni un cierre del navegador quitan el PIN; volver a entrar con el PIN quita un candado
  viejo; el PIN encendido en otro aparato vale al despertar; una tecla despierta sin escribir en
  el campo de abajo; y la espera no se queda guardada al cambiar de pantalla. Cada prueba deja la
  cocina, la mesa y la configuración como las encontró.
- **Mutaciones de navegador:** primera ronda 9 de 9 (Cocina que no se mantiene despierta, la
  comanda o la cuenta que no despiertan, el despertar de Morfi, «reducir movimiento», el PIN que
  se ignora o que deja volver con uno equivocado, el interruptor y los minutos del aparato);
  segunda ronda, sobre las correcciones, 9 de 9 (la capa sin `showModal`, sin `pointer-events`,
  despertando con el dedo que baja, dejando salir el foco, el toque o el teclado, sin pasarle el
  teclado a quien la monta, el candado sin guardar y el PIN que no vuelve a dormirse). Tres de
  esas sobrevivieron al principio: la prueba sólo miraba que el diálogo de abajo siguiera abierto;
  ahora pone espías donde escuchan los atajos de la ventana y Radix y exige que no les llegue
  nada. Tercera ronda, sobre lo que encontró la segunda revisión, 7 de 7 (el navegador que la cierra
  y no vuelve, la letra que despierta y cae abajo, entrar o cerrar la sesión sin quitar el
  candado, dormida sin releer la configuración, el candado sin decidirse al despertar, la espera
  guardada al cambiar de ruta). Mutaciones en total: 25 de lógica y 25 de navegador, todas
  muertas.
- **Revisión independiente** (subagente Sonnet, sólo lectura, sobre una copia limpia): sin
  críticos; **cuatro altos, corregidos antes de publicar**: (1) despertaba con el dedo que baja y
  el clic caía en el botón de abajo (ahora despierta con el clic completo); (2) con un diálogo de
  Radix abierto debajo, la capa no recibía toques ni foco; (3) el teclado salía de la capa del PIN
  a la pantalla de abajo; (4) recargar o cambiar de ruta quitaba el candado del PIN. Las dos capas
  son ahora un `<dialog>` modal en la capa superior del navegador (lo de abajo queda inerte) y el
  candado vive en el aparato. Medios atendidos: fondo casi negro en todos los estilos (en «papel»
  era casi blanco), avisos y vistas que quedaban encima, fondo del PIN opaco, el clip de despertar
  con respaldo si no termina, la pantalla del PIN que vuelve a dormirse a los 30 s, foco y teclado
  físico en el PIN, mensajes del PIN (sin conexión, PIN equivocado, bloqueo), la experiencia que
  se mezcla interruptor por interruptor en el servidor, y pruebas que ahora leen la decisión de
  cada revisión en vez de esperar a que React pinte. Bajos: la hora cambia justo al cambiar el
  minuto y el «Toca la pantalla» también se mueve; se quitó una suscripción que nadie usaba.
  Anotado sin cambiar: el tiempo sin tocar se mide con el reloj de pared (un salto de hora lo
  mueve); el candado es de pantalla, no del servidor.
- **Segunda revisión, adversarial** (un flujo de 26 agentes Sonnet, dos a la vez: dos lentes, y
  cada hallazgo a un escéptico que intentó refutarlo; 24 confirmados, que se reducen a estos):
  (1) Esc dos veces o el gesto Atrás de Android cerraban la capa nativa y se saltaba el PIN; ahora
  `closedby="none"` y, si el navegador la cierra igual, se vuelve a abrir; (2) con un diálogo de
  Radix abierto debajo, el toque o Escape lo cerraban, y las teclas llegaban a los atajos de la
  ventana (el F12 de Cobro cobra): la capa ya no deja salir foco, toques ni teclas, y la prueba
  pone espías donde escuchan para exigir que no les llegue nada; (3) «Cambiar de persona» quitaba
  el candado antes de saber si la sesión se cerró: ahora lo quita `POSAuthContext` después de
  `salir`, y entrar con PIN también lo quita (antes uno viejo volvía a pedir el PIN recién
  entrado); (4) el cambio de «Pedir PIN» no llegaba a una tableta quieta: se relee la
  configuración al dormirse y cada minuto dormida, y el candado se decide al despertar. Además:
  la tecla que despierta ya no cae en el campo de abajo, el PIN ignora la autorrepetición y
  Ctrl/Alt/⌘, la espera de una pantalla no se queda guardada al cambiar de ruta, otra pestaña se
  entera del candado, y sin `showModal` (Safari viejo) la capa se abre igual. Anotado sin cambiar:
  que dos pestañas a la vez se sincronicen y el `FOR UPDATE` de dos guardados simultáneos no
  tienen prueba propia (el código se revisó); los interruptores de Configuración pueden pintar un
  valor viejo de la otra llave hasta recargar, sin perder nada (el servidor mezcla).

- **Publicación:** primer CI a mano (`41009188004`) en rojo por dos cosas: la prueba de Cocina
  encontró la cocina de la demo con pendientes de otras suites (ahora resetea la demo al empezar,
  como las demás) y la galería vio la pestaña nueva de Configuración sin declarar (regenerada en
  CI, `41011423713`; se subieron sólo los nueve retratos de Configuración: los demás difieren de 0
  a 6 píxeles). CI de confirmación `41013410279` verde. `main` = `93f2884` (avance sin fusión);
  Production lista; humo verde (raíz, el 404, los clips de dormir y despertar, el QR inválido, y
  el modo espera viaja en los chunks del cliente); huella de las otras 10 organizaciones
  IDÉNTICA (119 tablas, 06:40:29 → 06:51:19 UTC del 30-10). `fase-b`: fusión `2aec862` sin
  conflictos, CI `41016832529`.

## DP-11.3 · Los sonidos de la interfaz (30-10-2026)

- **Qué quedó:** React Bits · Sound Lab instalado como código (motor de Web Audio y 25 recetas,
  sin archivos de audio, suena sin internet), con su licencia en `licencias/`. Un solo gestor con
  el perfil de cada aparato (Apagado, Suave —por omisión, al 70—, Normal, y el volumen) en
  Configuración → Este aparato; se desbloquea con el primer toque; nunca se encima con la voz; un
  mismo sonido no se repite antes de 80 ms y un toque suena una sola vez. Configuración →
  **Sonidos**: cada momento con su sonido y «Oír», el sonido del teclado del negocio y si el
  portal del comensal suena (apagado). DP-D40, ficha 16. Sin migración.
- **El mapa final** (Miguel lo aprueba oyéndolo en Configuración → Sonidos):

  | Momento                             | Sonido                         |
  | ----------------------------------- | ------------------------------ |
  | Toque de botón                      | Felt                           |
  | Teclado de PIN y numérico           | Nib (o Keycap, Thock, Clasp)   |
  | Agregar platillo                    | Pebble                         |
  | Cambiar la cantidad                 | Bead                           |
  | Quitar platillo                     | Fold                           |
  | Cambiar de sección, pestaña o zona  | Notch                          |
  | Abrir / cerrar un diálogo o cajón   | Popover / Fold                 |
  | Interruptor encendido / apagado     | Clasp / Unclasp                |
  | Enviar a cocina                     | Dispatch                       |
  | Comanda lista                       | Check                          |
  | Solicitud atendida                  | Boop                           |
  | Cobro hecho                         | Halo                           |
  | Ticket impreso                      | Receipt                        |
  | Error / aviso                       | Shrug / Hint                   |
  | Modo espera: dormir / despertar     | Dusk / Dawn                    |
  | Entrar con PIN / salir              | Arrive / Retreat               |
  | Comanda nueva (antes de la voz)     | Ping — sin usar: Cocina conserva su timbre y su voz |
  | Solicitud del comensal              | Signal — sin usar: sigue la alerta del mesero con su voz |
  | Meta del día                        | Confetti — sin usar: el sistema no tiene meta del día |

- **Pendiente de Miguel:** con qué sonido se queda el teclado («Block» no existe: Nib, Keycap,
  Thock o Clasp) y si Ping, Signal o Confetti reemplazan lo de hoy.
- **Evidencia:** unidad (el mapa, el perfil, cuándo suena, el gestor con reloj falso, qué suena
  al tocar, lo que aparece, el contrato de las teclas con el servidor) y la integración de la
  experiencia contra Postgres; 22 mutaciones de la lógica, 22 muertas. Navegador
  (`pruebas/e2e/sonidos.spec.ts`, tres aparatos, sin tarjeta de audio: lo que sonó queda en
  `data-ultimo-sonido`): pestaña y sección, interruptor, diálogo que abre y cierra, «Apagado»
  calla y «Oír» suena, el teclado del PIN con el sonido que eligió el negocio, el mesero agrega y
  envía a cocina, y el toque de siempre. Mutaciones de navegador: 8 de 8 (el primer toque que no
  desbloquea, lo que aparece sin sonar, el perfil del aparato que no cuenta o no se guarda, el
  teclado que no sigue al negocio, el PIN que suena como botón, agregar y enviar a cocina sin
  sonar). En total 22 de lógica y 8 de navegador, muertas.
- **Revisión adversarial** (14 agentes Sonnet sobre una copia limpia: audio y rendimiento;
  cableado, licencia y pruebas; cada hallazgo, con un escéptico que intentó refutarlo): 11
  confirmados, todos corregidos antes del commit. Lo que quedó: el audio se reanuda en cada toque
  (iPad lo deja «interrumpido» tras una llamada o al bloquearse); una receta que falló al cargar o
  al sintetizarse no se queda guardada rota; sólo se precarga si de verdad va a sonar; tocar un
  hueco o un texto ya no suena (sólo los controles); los avisos que llegan en grupo suenan; tras
  una acción (agregar, cobrar, enviar) no suenan encima el toque ni el diálogo que se cierra
  (400 ms); si el audio falla, Configuración → Este aparato lo dice, y lo quita cuando vuelve;
  la voz en cola cuenta como voz; despertar suena sólo al tocar. Las llamadas a `sonar` pasaron
  al camino del éxito y un contrato lee el código para exigirlas ahí (23 llamadas; 25 mutantes
  del contrato, 25 muertos, dos de ellos de orden).
- **Lo que encontró el navegador después:** entrar con PIN sonaba 300 ms después de cambiar la
  sesión; para entonces la pantalla ya navegaba sola y la recarga llegaba encima (en tablet y
  teléfono, la siguiente navegación se abortaba). Ahora entrar y salir suenan **antes** de cambiar
  la sesión. Con eso, sonidos y modo espera en los tres aparatos: 55 pasan y 5 se saltan (las de
  escritorio sólo).
- **`verify` local** (sin las puertas de la base viva ni la de Postgres 17, que corren aparte o en
  GitHub): verde; unidad 344 archivos · 4,337 pruebas, integración 45 · 185. `verify:esquema` y
  `verify:rls` en sólo lectura contra la base compartida: verdes. La CI cazó la etiqueta de
  `MesaActiva.tsx` fuera de las 60 líneas que lee `verify:cobertura` (bitácora); la galería se
  regeneró en CI y sólo cambiaron de verdad los 9 retratos de Configuración (la pestaña Sonidos).
- **Publicado** (30-10-2026, 02:47–03:00 hora del centro, fuera de servicio): CI a mano en verde
  (41026095330, 16/16) → `main` = `2feb661` → Production `READY` → humo verde (rutas públicas, el
  gestor viaja en los chunks de la entrada) → huella IDÉNTICA (08:47:15 → 09:00:45 UTC, 119 tablas,
  10 organizaciones). Ninguna escritura en producción. `fase-b`: fusión `16d621b` (un conflicto de
  imports en `Caja.jsx`: se quedan los dos). Después, la licencia de Sound Lab también se sirve en
  `/licencias/` (sale con la siguiente publicación).

## DP-11.4 · El lenguaje de capas, sus estilos y las tres pantallas piloto (30-10-2026)

- **Qué quedó** (rama `dp-11`; se publica entero, ver «Publicación»):
  - **El sistema** (DP-D41): dos valores nuevos de la perilla de elevación, `capas` (sombras
    largas en tres capas teñidas, vidrio ahumado en lo que flota, malla de fondo casi
    imperceptible) y `aero` (el de «Retro»). Vidrio SÓLO en lo que flota —la isla, la cuenta, los
    diálogos y cajones, los menús, los avisos, el dock— y nunca en una tarjeta de una lista; pasa
    solo a superficie sólida con «menos transparencia» o si el aparato no da 60 cuadros (se mide
    una vez en reposo). Tacto (`data-tacto`), halo (`data-principal`, `data-activa`) y presión
    (`--escala-presion`, con resorte) por atributo. Los otros siete estilos no cambian.
  - **Los estilos:** `morphiq` con la marca de Miguel (negro azulado `#0A0E1A`, azul eléctrico
    `#1E5BFF`, acero); `don-poncho` con los colores del logo y `capas` (sigue siendo el de la
    casa); **«Retro»** nuevo (Frutiger Aero inspirado: ventanas de vidrio con brillo, gel,
    escritorio de cielo y agua hecho con CSS propio, sin un logo, fondo ni fuente de nadie). Los
    diez estilos en AA, claro y oscuro.
  - **Claro, oscuro o automático** por aparato (Configuración → Apariencia); automático sigue al
    sistema en vivo.
  - **La navegación** (DP-D42): en táctil (puntero grueso o menos de 64rem: la tableta del local
    mide 1280 px) un dock flotante abajo con las secciones del puesto y «Abrir menú»; con ratón,
    la barra lateral, que flota a un lado. El abanico del dueño se va.
  - **Los tres pilotos**, recompuestos en `src/` con el sistema (mismos comandos, rutas, textos y
    selectores de las pruebas): el **Tablero** (`Dashboard.jsx` de 662 a 246 líneas), **Mesero**
    (el plano, la rejilla, la mesa abierta con la cuenta flotando y el borrador fuera de la
    pantalla: un toque ya no redibuja el salón) y **Caja / Cobro** (con un teclado de cobro
    táctil junto al campo «Recibido», con billetes y «Exacto»; el teclado de PIN, compartido).
- **Cómo se hizo:** el sistema, los estilos, el modo y la navegación, aquí; los tres pilotos, tres
  subagentes Sonnet (uno a la vez o dos, cada uno en su worktree, sin commit), integrados y
  verificados aquí. De la integración salieron dos correcciones: la leyenda de Mesero se encontraba
  componiendo clases para esquivar `verify:primitivas` (ahora por atributos `data-`), y la etiqueta
  de la mesa perdía el aire de sus esquinas en los estilos de radio amplio (4.44:1; vuelve a pasar).
- **Una corrección de DP-11.3 que sale aquí:** la primera vez que se abría una mesa, el sonido se
  SINTETIZABA en el toque (medio segundo de hilo con la CPU 4× más lenta). Ahora los sonidos del
  mapa se sintetizan en reposo antes del primer toque, una receta a la vez; el toque sólo reanuda
  el audio. 8 de 8 mutantes muertos.
- **Rendimiento** (`scripts/medir-fluidez.mjs`, CPU 4× más lenta, demo de `main` con `capas`;
  `evidencia-004/fluidez-antes.json`, `fluidez-despues.json` y `fluidez-despues-solido.json`):

  | Aparato  | Acción              | Antes                    | Después                  |
  | -------- | ------------------- | ------------------------ | ------------------------ |
  | tableta  | Mesero: cargar      | 1.8 s                    | 1.3 s                    |
  | tableta  | abrir mesa libre    | 0.40 s · 15.7 fps · p95 283 | 0.39 s · 19.1 fps · p95 267 |
  | tableta  | abrir mesa ocupada  | 1.3 s · 20.5 fps · 5 tirones | 0.57 s · 22.9 fps · 2 tirones |
  | tableta  | Caja: cargar        | 1.6 s                    | 1.4 s                    |
  | tableta  | Tablero: cargar     | 1.4 s                    | 1.2 s                    |
  | teléfono | abrir mesa libre    | 0.40 s · 20 fps          | 0.41 s · 16.2 fps        |
  | teléfono | abrir mesa ocupada  | 0.98 s · p95 533 ms      | 0.55 s · p95 217 ms      |
  | teléfono | Caja: cargar        | 1.6 s                    | 1.3 s                    |

  Abrir una mesa ocupada (lo que pasa todo el día) es 2.3× más rápido en la tableta. Desplazar el
  Tablero varió entre corridas del mismo código de 41 a 57 fps: la medición desplaza mientras
  todavía cargan las gráficas; ya cargado, se desplaza a 60 en tableta y teléfono, con vidrio y
  sin él. El vidrio no cambia los números (con vidrio sólido dan lo mismo). **Pendiente honesto:**
  abrir una mesa todavía no va a 60 cuadros (16–23): el diálogo pinta de un golpe; el siguiente
  paso es partir el primer dibujo del catálogo.
- **Evidencia:** unidad 4,539 pruebas; mutantes 25/25 (sistema), 8/8 (sonido), y los de los
  subagentes (51 Caja, 5 Tablero, 54 Mesero); navegador: navegación 5/5 (en tableta y teléfono,
  el dock), jornada completa 3/3, estados de mesa 20/20 (diez estilos), restaurante 9/9, sonidos
  19/19, solicitudes 3/3, portal 3/3, operaciones 17/17, PIN al despertar 9/9, modo del aparato
  6/6, estilos y contraste 22/22, apariencia del negocio 13/13.
- **Sin migración.** La apariencia del negocio ya vivía en `configuracion.valores`; el modo y el
  vidrio, en el aparato.
- **Capturas y video:** `evidencia-004/dp11-4/` tiene seis hojas de contacto (escritorio, tableta y
  teléfono, en claro y oscuro: el Tablero, el mapa de Mesero, la mesa abierta, la Caja y el cobro,
  en `don-poncho`, `morphiq` y «Retro») y `recorrido-tableta.webm` (abrir una mesa, agregar,
  enviar a cocina y cobrar con el teclado, con el estilo de la casa). Las 90 capturas sueltas se
  rehacen con `node scripts/capturar-pilotos.mjs` contra la demo local (`docs/DEMO-LOCAL.md` §5).
- **Las imágenes de referencia** («Mesa 08», carruseles) que menciona el encargo no llegaron a la
  sesión: el lenguaje salió del texto del encargo.
- **CI:** galería regenerada `41057249862` (verde); confirmación `41061664223`.
- **Publicación (pendiente, con aviso a Miguel):** es un cambio grande de diseño y el restaurante
  abre de día, así que sale fuera del horario de servicio. Al publicar: CI a mano en verde sobre
  el commit → `main` → Production `READY` → **fijar `capas` en la apariencia de Don Poncho** por
  el comando de apariencia (hoy guarda `sombra`, la de su alta; sin eso producción no estrena el
  lenguaje), con huella antes y después y exportación del negocio → humo → huella → fusión en
  `fase-b` (choques esperados en `Mesero.jsx`, `Caja.jsx`, `Dashboard.jsx` y la galería: allí
  vive «unir mesas», cuyo efecto líquido entra al lenguaje en esa fusión).
- **Después, la pausa:** sin el OK de Miguel no se recompone ninguna otra pantalla (DP-11.5).
