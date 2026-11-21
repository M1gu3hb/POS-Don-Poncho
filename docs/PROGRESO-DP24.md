# DP-24 · Los cambios que pidió Don Poncho (la Caja manda)

Bitácora de la etapa. Empieza el **20-11-2026 a las 16:45** (hora del centro), con `main` en `101f86f`
(DP-23, PR #46). La entrega fue el 19-11; mañana se capacita a los meseros.

## Cómo se reparte

| Parte | Qué | Quién | Árbol y rama |
|---|---|---|---|
| 1 | La Caja: tarjeta de cobro nueva, propina, efectivo, varias tarjetas, modificar la cuenta, propinas en el corte | sesión principal, en persona | checkout principal · `dp-24-p1-caja` |
| 2 | Quién quita y cancela (y la confirmación de la Parte 7) | agente Sonnet | `.work/dp18-integrar` · `dp-24-p2-quien-cancela` |
| 3 | El menú: orden, categorías, colores y opciones | agente Sonnet | `.work/dp20-lab` · `dp-24-p3-menu` |
| 4 | Cocina por producto, avisos al mesero y la mesa | agente Sonnet | `.work/dp20` · `dp-24-p4-cocina` |
| 5 | Unir mesas poco a poco | agente Sonnet | `.work/dp24-p5` · `dp-24-p5-unir-mesas` |
| 6 | Impresión: copias y el permiso del iMin (POS y repo de las apps) | agente Sonnet | `.work/dp18-integrar` · `dp-24-p6-copias-y-permiso` |
| 7 | Lo que sólo se confirma | con la Parte 2 | — |
| 8 | Cero final | sólo cuando Miguel escriba «CERO FINAL» | — |

Los agentes no confirman ni suben: dejan el cambio en su árbol; la sesión principal revisa el diff,
corre sus pruebas, confirma, abre el PR y lo une con la CI en verde. Orden de subida: 2, 3, 6, 5, 4 y 1.

## Arranque (20-11, 05:00–06:15 y 16:45–17:00)

- **Skills cargadas:** `engineering:code-review`, `engineering:testing-strategy`, `engineering:debug` y
  `morphiq-prs` (apareció como `morphiq-prs:morphiq-prs`).
- **El mensaje de contexto de la mañana era el de DP-21** (ya hecho); Miguel lo anuló en el encargo de DP-24.
  En la raíz del repo no hay `CLAUDE.md` ni `AGENTS.md` (sólo en `apps/web`), como en etapas anteriores.
- **Línea base:** los dos repos al día y limpios; `pnpm install` en verde; las 40 puertas de `verify` que
  corren en la laptop, en verde (fuera, como siempre, `verify:esquema`, `verify:rls` y `verify:acople`).
  `test:integracion`: 1,107 de 1,107 (179 archivos) sobre una base local migrada desde cero (127
  migraciones, última la 195). Los dos rojos previos fueron del ambiente: el Postgres local 55433 apagado
  tras un reinicio de la laptop y una base vieja que se había quedado en la migración 193.
- **Producción, sólo leída (sesión 5432), 05:19:** desplegado `101f86f`, 0 errores en Vercel en 24 h;
  4 cuentas pagadas del 19-11 (DP-01001 a DP-01004, $2,128.25), 1 caja abierta («Aparato 33») y 1
  cerrada, 6 comandas entregadas, 35 aparatos, cupo de 1 caja, IVA en 0, H1 sin activar, migración 195.
  **Miguel (16:45): son las pruebas de la presentación; NO se borran ni se cierra esa caja; los ceros van
  después de la capacitación, cuando escriba «CERO FINAL».**
- **El catálogo real** se exportó en sólo lectura (16:49) a un archivo fuera del repo para el agente del
  menú: 17 categorías, 107 productos, 13 grupos de opciones con 139 opciones, estaciones «Cocina» y
  «Cantina». Ninguna cuenta usa un producto «(extra)».

## Lo que se aprendió de la laptop hoy (para no repetirlo)

- Con cuatro árboles trabajando a la vez, **una construcción de la app tarda de 20 a 35 minutos** (sola
  tarda 4). Sólo corre una a la vez (candado `D:\mpos-tmp\dp24\candado-build`), así que las pruebas de
  navegador en local se forman en fila. Por eso cada parte se sube a su PR en cuanto sus pruebas
  unitarias y de integración están en verde, y la CI corre las de navegador en paralelo.
- `node scripts/base-desechable.mjs subir` **se cuelga** en esta laptop (su `pg_ctl start` hereda las
  tuberías de Node y no regresa). `D:\mpos-tmp\dp24\e2e-subir.sh` arranca el clúster por su cuenta.
- Para ver una pantalla mientras se trabaja: servidor de desarrollo contra la base desechable
  (`D:\mpos-tmp\dp24\dev-p1.sh`, lanzado con la configuración `caja-dp24`), sin construir.

## Parte 2 · Quién quita y cancela (PR #47 · en producción desde el 20-11, 22:25)

- **Hecho:** el mesero ya no anula lo enviado ni cancela la cuenta (roles de `restaurante.anular_linea`
  y `restaurante.cancelar_orden`, y regla de dominio en `cancelar-con-permiso.ts`); el cajero siempre
  con el PIN de un gerente, administrador o dueño; la gerencia sin PIN; el motivo sigue obligatorio.
  En pantalla el mesero no ve los botones; la Caja pide el PIN de entrada al cajero y nunca a la
  gerencia. Se cerró además la puerta de al lado (`transicionar_pedido` a «cancelado», sólo gerencia).
- **Pruebas:** `quien-quita-y-cancela.integracion.test.ts` (16) y `cancelar-con-permiso.test.ts` (8);
  8 mutantes muertos; la integración de restaurante, caja, portal, puente y mantenimiento completa en
  verde tras ajustar los flujos que daban por hecho que el mesero cancelaba.
- **Parte 7 (sólo se confirma):** con la asignación apagada, quien abre o atiende la mesa se queda con
  ella: `portal/sin-asignacion.integracion.test.ts` (9) y una prueba nueva. El Tablero no se tocó.
- **Lo revisó la sesión principal** línea por línea (toca permisos). Decisión: DP-D210.
- **La CI:** la primera corrida salió en rojo por la limpieza de una prueba (ver «La interrupción»); la segunda,
  **10 de 10**, con «Jornada completa» entera.
- **Producción (20-11, 22:25):** lectura de antes igual a la línea base (4 cuentas pagadas del 19-11 por $2,128.25, la
  caja de «Aparato 33» abierta y una cerrada). Unido a `main` como `2177da7`; el despliegue quedó «READY»
  (`dpl_FLfkBv5W…`). Sin migración. Humo sin sesión y sin cobrar: el de siempre 27 de 27 y las rutas de los lotes
  anteriores 13 de 13. **0 errores de ejecución** en Vercel. Regreso previsto: el despliegue de DP-23 (`dpl_6gRGJSKS…`).
- **Queda anotado:** el simulador de bots (`qa/simulador`) sigue haciendo que el mesero quite platillos;
  no corre en la CI y se ajusta antes de la próxima jornada de bots.

## La interrupción (20-11, 19:05 a 21:40)

La sesión alcanzó su límite de uso a media etapa. Los agentes se detuvieron con su avance en sus árboles, sin
confirmar; nada se desplegó ni se tocó en producción. Se retomó a las 21:40: los agentes de las Partes 3, 4 y 6
siguieron donde iban y la sesión principal volvió a la Caja.

- **La CI de la Parte 2 salió en rojo** en «Jornada completa · restaurante»: la prueba D-5 de las operaciones de
  mesa limpiaba sus dos cuentas cancelándolas con la sesión de la cajera y sin autorización; con DP-D210 el servidor
  lo rechaza, las mesas 3 y 6 se quedaban con cuenta y la caja no cerraba en la prueba 7. No era un defecto de la
  aplicación: era la limpieza de la prueba. Ahora cancela la dueña y se comprueba (commit `81dd968`).

## Parte 3 · El menú: orden, categorías, colores y opciones (PR #48)

- **Un solo orden del menú** (migración 196, aditiva: `productos.orden_en_categoria`, nula; y `categorias.color` acepta
  además las claves de una paleta): la categoría, el lugar del platillo en ella y el nombre (`ordenarMenu`, en el
  dominio). Lo usan el portal QR, la rejilla del mesero, la de la Caja y el buscador.
- **Configuración → Portal de comensales → «El orden del menú»:** ↑ ↓ de 44 px para secciones y platillos, y «En el
  menú / Oculto» por platillo. Seis comandos nuevos de catálogo, con auditoría, sólo para la gerencia; los de orden
  avisan si otra persona ordenó entre tanto.
- **Colores:** 16 de una paleta fija, en claro y en oscuro, con el contraste medido; la pestaña lleva su color y cada
  tarjeta una franja. Se elige al crear o editar la categoría.
- **El guion del menú** (`scripts/ordenar-menu-produccion.mjs`): deja las 16 categorías como la hoja de comanda de papel
  (renombra, une «Ron» y «Brandy», mueve Naranjada, Limonada y Cazuela mezcal), ordena, pone colores, carga «Prepárala»
  y «Preparación» y apaga los 4 «(extra)» de Cerveza. Por comandos, idempotente, con `--ensayo`, y se detiene sin
  escribir si algo no casa. Ensayado contra una base local con el catálogo real: 48 comandos; la segunda corrida, ninguno.
- **Lo que falta de parte del restaurante:** vienen en la hoja y NO existen (no se crearon) Campechanas, Panqués, Café
  americano, Café capuchino, Cuervo especial y Bacardí añejo; y falta el precio de «el tequila (o el alcohol) de su
  agrado es adicional» de Paloma, Charro negro y Piña colada sin alcohol (no se cargó).
- **Pruebas:** integración `catalogo/orden-del-menu` (16) y `restaurante/opciones-de-la-hoja` (7), con catálogo, puente y
  portal completos; unitarias con 20 mutantes; navegador con dedo (`orden-y-color-del-menu.spec.ts`).
- **Lo revisó la sesión principal:** la migración, los seis comandos y sus permisos, el guion de datos y los cambios en
  la rejilla (que es también la de la Caja). Decisión: DP-D211.
- **En producción (20-11, 23:20):** `main` en `515d451`, despliegue `dpl_AYMfwXC3wQxAdREQqxMtGKjJMzpK` en READY. La migración
  196 se aplicó antes de unir (ensayo y aplicación correctos). Humo: 13 bien, 0 mal; las cuatro rutas nuevas de catálogo
  contestan 403; sin errores de ejecución; las 4 cuentas y las cajas, intactas.
- **El guion del menú, primer intento (20-11, 23:22):** no corrió: el encargo al agente traía mal el nombre de la persona
  («Miguel · Morphiq»); la dueña activa de producción con la que firman los guiones es «Dueño», la de DP-22 y DP-23.
- **El menú quedó como la hoja (21-11, 01:35), lo corrió la sesión principal:** ensayo limpio (48 comandos: 19 de categorías,
  4 «(extra)» apagados, 2 grupos, 8 asignaciones, 1 orden de categorías y 14 de platillos), corrida real con 49 ✓ y ningún ✗,
  y el ensayo de después con todas las etapas en «ya está». Por la conexión de sesión (5432).
  **Comparación del catálogo antes y después** (`catalogo-antes-del-menu.json` / `catalogo-despues-del-menu.json`): 107
  productos antes y después, ninguno nuevo ni borrado, **0 precios y 0 nombres cambiados**; los 4 «(extra)» de Cerveza quedaron
  apagados; 16 categorías activas (Brandy se unió a «Ron y Brandy»); 7 opciones nuevas: Michelado $15, Cubano $20, Con clamato
  $30, Con clamato cubano $35 (los precios del encargo, iguales a los de los «(extra)») y las 3 de «Preparación» en $0.
  **No se crearon** (faltan en el catálogo): Campechanas, Panqués, Café americano, Café capuchino, Cuervo especial, Bacardí
  añejo. **Sin cargar por falta de precio:** el tequila adicional de Paloma, Charro negro y Piña colada sin alcohol.

## Parte 6 · Impresión: copias y el permiso de la impresora (PR #49; apps: PR #3 en borrador)

- **Por qué un POS imprimía 1 copia y otro 2:** las copias vivían en una variable que sólo llenaba una consulta de la
  barra de impresión (un minuto de caducidad, sin releer al enfocar). El aparato que no recargaba imprimía con lo que
  leyó al abrir. El servidor estaba bien.
- **El arreglo:** `copiasAlImprimir()` lee del servidor en cada impresión (plazo de 4 s; sin respuesta, la última buena
  de ese aparato, y lo dice). El diálogo de imprimir del navegador, que ignoraba las copias, ahora las reproduce.
- **El permiso:** el fallo `SIN_PERMISO` trae el botón «Dar permiso a la impresora» (sin contraseña), que pide el
  permiso al puente, dice «Permiso concedido ✓» y reintenta la misma impresión.
- **La app de Android** (repo de las apps, rama `dp-24-permiso-usb`): el filtro `USB_DEVICE_ATTACHED` para que el
  permiso se quede. **No se publicó APK: falta probarlo en el iMin** (el procedimiento quedó en `INSTALAR.md`).
- **Pruebas:** `copias-al-imprimir` (dos aparatos contra un servidor que cambia el valor), `pnpm test:impresion` 38 de
  38 (con el caso de cambiar las copias entre tres impresiones sin recargar), integración del ticket (6), 12 mutantes.
- **La primera CI salió en rojo:** el arnés de `pruebas/impresion` seguía usando la variable que se quitó, y dos avisos
  de lint. Corregido en el mismo PR. **No comprobado:** un rollo real ni el iMin. Decisión: DP-D212.
- **En producción (20-11, 23:52):** `main` en `2637e80`, despliegue `dpl_CHga7hXFAmhydcJbiNQdYdcENy8B` en READY. Humo: 13 bien,
  0 mal; sin errores de ejecución; las 4 cuentas y las cajas, intactas. La app de Android no se tocó ni se publicó.

## Parte 5 · Unir mesas poco a poco (PR #51)

- **`restaurante.agregar_a_la_union`:** a un grupo vivo se le agregan mesas las veces que haga falta; todo va a la
  principal de la primera unión; si la que entra es principal de otro grupo, entra todo ese grupo. Unir y agregar
  comparten el mismo núcleo (`sumarMiembros`). En el mesero, «Agregar mesas» desde la mesa del grupo. Sin migraciones.
- **Pruebas:** integración `union-por-partes` (13: tres ampliaciones con comandas en los cuatro estados, separar, cobrar
  una vez y los rechazos), la regresión de unir (51), la zona de restaurante (1,087) y 25 mutantes. La prueba con dedo
  (`agregar-mesas-al-tacto`) no corrió en local: se agregó a la CI. Decisión: DP-D213.
- **SIN UNIR (21-11, 00:21):** la CI de `1777db1` (y la de `4fa2c04`, antes de traer la Parte 6) falla en «Jornada completa»
  sólo en `agregar-mesas-al-tacto.spec.ts` (tablet y teléfono): el botón «Agregar mesas» de la mesa mide 40.8 px de alto y la
  prueba exige 44 (`size="sm"` en `AccionesDeLaMesa.tsx`, igual que sus hermanos). Es un defecto de la parte, no de la unión:
  el PR #51 queda abierto, sin unir. El resto de la CI está en verde. Arreglo probable: darle al botón 44 px al tacto.

## Parte 4 · Cocina por platillo, el aviso de «listo» y la mesa (PR #50)

- **La cocina por platillo:** columnas Nuevo / En preparación / Listo por platillo, bloques por mesa y botón de bloque
  (`restaurante.mover_platillos`). El estado de la comanda y el de la mesa se derivan de sus platillos.
- **El mesero:** una tarjeta por estación con «Listos x de n» y «Entregados x de n»; «Marcar entregado» entrega lo
  listo (por platillo) y la tarjeta lo vuelve a ofrecer.
- **El aviso grande de «listo»:** sólo al mesero de esa mesa, decidido en el servidor (`restaurante.avisos_de_listo`);
  con sonido y vibración, apilable, se quita tocando o deslizando.
- **La nubecita** por estación junto a la mesa en el mapa del mesero. Sin migraciones.
- **Pruebas:** integración con dos estaciones (17) y las zonas tocadas (535), 12 mutantes, navegador con dedo
  (`cocina-por-platillo`, `mini-jornada-de-cocina` con 10 mesas y 2 estaciones).
- **La primera CI salió en rojo, por un defecto de verdad:** en escritorio y tableta el aviso grande quedaba ENCIMA de
  «Marcar entregado» y el mesero no podía tocarlo (el teléfono sí pasaba). Regresó al agente. Decisión: DP-D214.

## Parte 1 · La Caja (sesión principal, en persona)

- **La tarjeta de cobro nueva** (`~/venta/TarjetaDeCobro`, `PagoDeLaTarjeta`, `TecladoDeImportes`): una sola vista con
  los platillos, el subtotal, la propina, las formas de pago, lo recibido, el cambio y el total. La cuenta la hace
  `cuenta-del-cobro.ts` (pura, en centavos) y lo que se teclea vive en `cobro-en-pantalla.ts`. La función pequeña que
  se agregó: el teclado de importes dentro de la tarjeta (DP-D215).
- **Propina en la tarjeta** (DP-D216): porcentajes de la Configuración, «Otro monto» y «Sin propina»; la del portal QR
  llega puesta y se puede cambiar; se acabó la pregunta aparte y el aviso que interrumpía.
- **Efectivo:** atajos, «dejar el cambio como propina», y **un «Recibido» menor al total ya no se cobra** (la falla
  del informe 013).
- **Varias tarjetas:** dividir, agregar, combinar con efectivo y transferencia; si no cuadra no cobra; el ticket, una
  línea «Tarjeta».
- **Modificar la cuenta** (DP-D217): «Agregar» y «Para llevar» (`restaurante.agregar_en_caja`, comando nuevo) y quitar
  con motivo y PIN. **«Pasar platillos a otra cuenta» no existe en el sistema: queda como propuesta, no se construyó.**
- **Propinas en el corte** (DP-D218): «Propinas del día» por persona con «Liquidar», por el mismo `propinas.liquidar`;
  lo entregado sale del cajón (movimiento `propina_entregada`) y el conteo cuadra (la otra falla del 013). En la lista
  sólo quien vende, cobra o atiende.
- **Pruebas:** unitarias de las reglas puras; integración contra Postgres (`tarjeta-de-cobro`, `agregar-en-caja`,
  `liquidar-en-el-corte`: 17); navegador con dedo a 1024×768, 800×600 y 1280×800 (`tarjeta-de-cobro.spec.ts`) y
  `la-caja-manda.spec.ts` (agregar, para llevar, quitar con PIN y liquidar en el corte). Las pruebas que usaban el
  cobro viejo se pusieron al día (`dia-completo-restaurante`, `propina-una-sola-verdad`, `qa/flujos-qa`).

## Decisiones (en `DECISIONES.md`, desde DP-D210)

- **DP-D210** · Quién quita y cancela.
- **DP-D211** · El menú: un solo orden, colores de una paleta y la hoja de comanda como orden inicial.
- **DP-D212** · Las copias se leen al imprimir, y el permiso de la impresora se da desde el error.
- **DP-D213** · Unir mesas poco a poco: a un grupo vivo se le agregan mesas.
- **DP-D214** · La cocina por platillo, el aviso de «listo» al mesero de la mesa y la nubecita.
- **DP-D215** · La tarjeta de cobro: una sola vista, y se teclea lo que de verdad pasa.
- **DP-D216** · La propina se elige en la tarjeta de cobro.
- **DP-D217** · La Caja modifica la cuenta que está cobrando.
- **DP-D218** · Liquidar propinas en el corte: el mismo comando, y lo entregado sale del cajón.

## Estado por parte

| Parte | Estado |
|---|---|
| 1 · La Caja | PR #52, trae main y en la CI |
| 2 · Quién quita y cancela | en producción (20-11, 22:25) |
| 3 · El menú | en producción (20-11, 23:20); falta correr el guion del menú (persona dueña no hallada) |
| 4 · Cocina por producto | PR #50; corrigiendo el aviso que tapa «Marcar entregado» |
| 5 · Unir mesas poco a poco | PR #51, trae main y en la CI |
| 6 · Impresión | en producción (20-11, 23:55) (la app de Android espera la prueba en el iMin) |
| 7 · Lo que sólo se confirma | hecho con la Parte 2 |
| 8 · Cero final | espera el «CERO FINAL» de Miguel |
