# Progreso DP-18 · lo que encontró Miguel y la semana simulada con bots

> Si la sesión se corta o se compacta, **lo primero es releer este archivo** y seguir desde «Lo que
> sigue». Sin secretos ni PIN aquí: viven en `..\_PRIVADO\`.

## Arranque (11-11-2026, noche)

- **Skills:** `engineering:testing-strategy`, `engineering:debug`, `engineering:code-review` y
  `morphiq-prs` cargadas. «frontend-design» no existe con ese nombre: la más parecida es
  `anthropic-skills:design-taste-frontend` (o `impeccable`, como en DP-16); se carga en la Parte 5,
  que es la única de diseño.
- **Lo que el encargo dice y el repo no (gana el repo):**
  - no hay `CLAUDE.md` ni `AGENTS.md` en la raíz: sólo los de `apps/web` (la guía de Next en
    `node_modules/next/dist/docs/`);
  - `link.mjs` no está en `scripts/`: vive en `D:\mpos-tmp\dp15-link\link.mjs` (fuera del repo);
  - `verify` completo no corre en la laptop: con `DATABASE_URL_PRUEBAS`, `verify:entorno` exige el
    Postgres 17 del compose y el clúster local es 18; `verify:esquema`, `verify:rls` y
    `verify:acople` leen la base COMPARTIDA y el despliegue (la CI tampoco los corre). Se corre en
    dos tramos con `D:\mpos-tmp\dp18\verify-local.sh`: todas las puertas menos esas tres, y
    `test:integracion` con la base local `dp18_pruebas` (55433), como en DP-16 y DP-17.
- **El entorno estaba trabado:** los dos clústeres locales (55433 y 5460) seguían «en ejecución» desde
  el 09-11 pero no aceptaban conexiones (Windows, `error code 487` al reservar memoria compartida);
  se reiniciaron. Los 17 worktrees viejos de agentes (DP-12 a DP-16, varios con cambios sin commit)
  hacían lentísimos los verificadores que recorren el árbol: se movieron, sin borrar nada, a
  `D:\MIS PROYECTOS\MORPHIQ POS\.work\worktrees-viejos-dp18\` con `git worktree move`; uno
  (`agent-a2283480c75286caa`) quedó bloqueado por Windows y sigue en `.claude/worktrees`.
  `verify:pruebas` ahora salta `.claude` (como ya saltaba `node_modules`): los worktrees de los
  agentes no son pruebas de este árbol.
- Una prueba unitaria (`avisos-caducados.test.ts`) pasó de 5 s con la laptop cargada (16.6 s); sola,
  2 s. Ambiental.

## Producción, sólo leyendo (11-11, 20:00; conexión de sesión 5432, `begin read only` + `rollback`)

- 1 caja abierta: la abrió «Miguel · Morphiq» a las 10:14 en «Caja 2» (la tableta) con fondo $0 y se
  trasladó a «Caja 27» (la PC) a las 10:41. 1 venta: folio A-1, $429.00 en efectivo (10:14). Folios en 2.
- El cupo de cajas: ya era 2; a las 10:38:30 se movió a 1 y medio segundo después a 2; a las 10:40:53
  a 1; a las 10:41:31, «Traer» la caja a la PC. Hoy dice 1.
- El modo del menú: `productos_pos` («A la carta»), guardado a las 10:37:47.

## La copia de la base propia

- Exportación de sólo lectura (`exportar-negocio.mjs`, sin archivos) en
  `_PRIVADO\mudanza\2026-11-11-dp18-copia`: 135 tablas, 1,332 filas.
- `qa_dp18_base` en el clúster local 5460 (`D:\mpos-tmp\dp18\copia.sh`): migrada desde cero hasta la
  192, importada idéntica (filas y md5) y con los 10 PIN cambiados por PIN de prueba que sólo valen
  ahí (`D:\mpos-tmp\qa-dp18-base\pines.json`, fuera del repo).

## Estado por parte

| Parte | Qué | Estado |
| --- | --- | --- |
| 0 | Ubicarse, `verify`, bitácora | hecho: `verify` local en verde (unidad 490 / 5,521, integración 128 / 628, build y verificadores) |
| 1 | Lo que encontró Miguel (un PR) | **en producción** (#24, `197614f`, 12-11): 1.1 a 1.6 con sus pruebas (DP-D110 a DP-D114), 29 mutantes muertos, las 3 e2e nuevas y la CI completa en verde; `dejar-en-ceros.mjs` NO se ha corrido |
| 2 | El simulador | PR #25 (`dp-18-2`): `qa/simulador/` completo (núcleo, sala, cajas, gerencia, almacén, dueño, caos, día 0, árbitro, informes, `correr-dia.ts`, `perfiles.ts`, README); se le siguen sumando los arreglos que enseña la semana |
| 3 | La semana | en curso en `qa_dp18_semana` (copia de la propia, PIN de prueba, reloj de QA): día 0 verificado (36/36); el día 1 se repite (las dos primeras corridas las contaminaron fallas del simulador) |
| 4 | Triage, arreglos, reporte 011 | pendiente |
| 5 | Tres direcciones del menú digital | capturas mandadas a Miguel (A «Papel de la casa», B «Brasa», C «Cartel»); se programa la que elija |

## La Parte 1 (rama `dp-18-1`)

- **1.1** La pestaña del QR invalidaba `['config_remote']` (nadie la lee); ahora `['config']`. La prueba
  de contrato `llaves-de-consulta.contrato.test.ts` encontró 34 invalidaciones huérfanas más en 14
  pantallas (reapuntadas o quitadas) y exige que cada sección de Configuración mande sólo su parche
  (`parche-de-la-seccion.ts`). 4 mutantes muertos.
- **1.2** La causa, de la auditoría de producción: no fue caché ni carrera; DP-D74 callaba la caja de
  la tableta cuando cabía otra, y Miguel movió el cupo 2→1 entre las dos visitas. `caja.estado` trae
  `otrasCajas` siempre y la Caja las enseña («Trasladar aquí», «Abrir otra caja aquí (N de M)»), cada
  4 s, al volver a la pestaña y al cambiar el cupo. 5 mutantes muertos.
- **1.4** M1 (candado de la terminal y del borrador), M3 (lo de ayer sin entregar), M5 (la opción por
  renglón repartida al dividir; lo de peso ya cuadraba) y M6 (el piso de las opciones: editor, guardar,
  asignar y vender). Pruebas en rojo antes del arreglo; 12 mutantes muertos.
- **1.3** Portal QR → «Personalizar menú» con la vista previa; recorrido contra una copia de la base
  propia: guardado, otra pestaña, recarga y el portal de la mesa (capturas en `D:\mpos-tmp\dp18\p1\`).
- **1.6** `dejar-en-ceros.mjs` y `mantenimiento.reiniciar_folios`, probado en una copia con la venta y
  la caja de Miguel (negativas, ensayo, en serio y una segunda corrida). **No se ha corrido en
  producción.**
- **1.5** La guía de entrega con lo nuevo.
- **Al pasar `verify`:** los cambios de aspecto declarados con su motivo en `aspecto-permitido.json`
  (la caja vieja `CajaEnOtraTerminal.jsx` la sustituye la nueva; el aviso «No hay cambios que guardar»;
  la pestaña «Personalizar menú»); «Personalizar menú» gana su vacío (negocio sin platillos) y sus
  piezas se declaran en la puerta de adopción; el marco del teléfono usa tokens; lint (conversiones
  redundantes: el cliente de `pg` ya entrega `int8` como `BigInt`).
- **Una trampa del entorno:** si Playwright no encuentra el 3200 respondiendo, su `webServer` rehace el
  build y borra el `.next` del servidor que arrancaba. Esperar a que responda antes de correrlo.

## El simulador: lo que encontró el agente A

- El reloj de QA (`reloj/precarga.ts`) rompía `/api/datos/consultar` con «Date.parse is not a
  function»: Next copia `Date` y sólo heredaba los estáticos por el prototipo. Arreglado (se copian
  como propios); los servidores se reiniciaron con el arreglo.
- La copia de la propia trae la caja de Miguel abierta y el cupo en 1: el día 0 tiene que dejar el cupo
  en 2 (o traer la caja).
- `LIMITES.entrar` (20 entradas con PIN por 5 minutos por IP; local, todo es la misma IP) puede
  estorbar a la semana completa: a revisar en el día 0.

## La Parte 5

Don Poncho no tiene fotos de platillos (121 activos, 0 con foto, 48 con descripción): las capturas usan
11 fotos de muestra de Wikimedia con licencia libre (`D:\mpos-tmp\dp18\p5\fotos\CREDITOS.md`). Las tres
hojas y las 18 capturas están en `D:\mpos-tmp\dp18\p5\capturas\`.

## El cierre de la Parte 1

- La galería pidió declarar `/portal-qr` (la pestaña nueva): se regeneró en CI con
  `actualizar_galeria` y sólo se comprometieron los 9 retratos de Portal QR; la regeneración reescribe
  todos, y los de Cocina salían con el pie de la barra lateral unos píxeles distinto (en la vuelta
  del PR coincidían con los viejos).
- `verify` local tropezó dos veces con Windows: al restaurar un mutante, `writeFileSync` falló con
  `UNKNOWN` (-4094) y dejó el mutante en el árbol (`precio.ts`, `cierre.ts`). Se restauraron con
  `git checkout` y se siguió desde esa puerta.
- Fusionado con squash y en producción el 12-11 a las 5:20 (Vercel «Ready», el acceso responde 200).

## El simulador integrado (12-11)

- Lo que encontró B en el día 0 y su ensayo (para el triage de la Parte 4): asignar estación a una
  categoría da 422 (`estacion_preparacion_nombre` viaja al guardar); crear un producto «por porción
  de contenedor» da 500; los productos por peso y por porción quedan con `estrategia_consumo = sku` y
  la venta no baja su insumo; «Registrar compra» sin almacén da 422 y ninguna pantalla crea el
  almacén; una compra en efectivo sale del cajón de la caja abierta.
- Pendiente de B: el cierre de caja dentro del día no llegó a mandar `/api/caja/cerrar` (aislado sí
  cierra). Se diagnostica con el ensayo de `correr-dia.ts`.
- **La laptop se apagó** hacia las 3:00 del 12-11 a media integración: se perdieron el ensayo en curso
  y el agente de cajas a medias (se retomó); no se perdió código. Postgres se recuperó al arrancar.
- El primer ensayo con todo el personal salió mal y enseñó dos cosas del simulador (no de la app):
  20 entradas con PIN a la vez ahogan el servidor de la laptop (ahora el personal llega escalonado y
  la entrada no espera el evento `load`), y el fin del día se calculaba con la hora del reloj, que
  vuelve a 0 a medianoche: pasado el tope, el día «dejaba de estar terminado» y los bots siguieron
  3 horas (ahora `fin-del-dia.ts`, con su prueba).

## Lo que sigue

El ensayo de un día con todo el personal, el cierre de caja, lo del agente, `verify` y el PR de la
Parte 2. Luego la semana. La Parte 5 espera la elección de Miguel.

## La semana (Parte 3)

- **Cómo corre cada día:** `D:\mpos-tmp\dp18\correr-un-dia.sh N [repetir]` para el servidor, saca el molde
  del inicio del día (`qa_dp18_molde_dN` y la carpeta de salida), levanta el servidor con el pool
  limpio y corre `correr-dia.ts`. Los informes se publican en `D:\mpos-tmp\dp18\publicar\` y entran al
  repo con la Parte 4. La salida completa (con la evidencia) vive en `D:\mpos-tmp\dp18\semana\`.
- **Día 0** (jueves 19): por pantallas, 3 minutos; verificado en sólo lectura, 36/36. Cerró la caja
  heredada de la copia contando $429.00 (la venta de prueba de Miguel). 6 incidentes reales de la app
  (los mismos del ensayo de B; el de la caja heredada ya no sale: lo arregló la Parte 1).
- **Día 1, primera corrida (×6):** 135 min reales; 31 de 130 grupos atendidos. La contaminaron fallas
  del simulador: la Caja 2 siguió con una página cerrada, un mesero pidió porciones fraccionarias y
  se atoró, la propina esperada no seguía al descuento, un borrador para llevar sobrante. 10 críticos,
  todos falsos (del guion). Se repite.
- **Día 1, segunda corrida (×3):** a las 14:00, las 20 mesas ocupadas a la vez; a las 15:00 la tarde
  se atoró: tras un cobro con caos, la caja consultaba la base con el id de la llegada (no es uuid), el
  cobro hecho se tomaba por fallido y la cuenta quedaba «cobrándose» para siempre. Se cortó y se repite.
- **12-11, la laptop se apagó** a media semana; se retomó desde el molde del día 1.
- **Día 1, tercera corrida (×3, se paró a las 15:30):** 7 críticos, todos falsos y del guion: el
  carrito del mesero sobrevive a la recarga y un intento fallido se iba en la ronda siguiente (la base
  tenía justo los renglones de más), los pagos de la disputa de dos cajas se buscaban con el id de la
  llegada, y el portal no pedía la cuenta con «Sin propina» (la tesela se llama «Sin propina 0%»): 5 de
  20 mesas atoradas. El Mesero 4 (tableta) no vio una mesa en todo el día: el mapa son `div` sin rol.
  Guardada en `D:\mpos-tmp\dp18\corridas\d1-rep2\`.
- **Día 1, cuarta corrida (×3, se paró a las 17:00):** 9 críticos, todos falsos y del guion (la app
  cuadró al centavo cada uno): el pago mixto con propina no llenaba «¿Cómo se pagó la propina?», el
  reintento perdía el descuento ya aplicado y la división heredaba ese descuento. Además: unir mesas
  (el plano tiembla), las pestañas de zona del Mesero 3 (las mesas 9 y 10 sin mesero todo el día), la
  mesa con 🎉 delante, la parte de una cuenta dividida que se daba por cobrada, el tope del 30 % de la
  gerente. Con 20 mesas y estancias de ~66 min el reparto de llegadas no alcanzaba las 120 cuentas: se
  calibró (946d0a4). Guardada en `corridas\d1-rep3\`. Todo corregido en `dp-18-2` y probado con sondas
  (carrito, zonas, tableta) antes de la quinta corrida.
- Lo que el simulador encontró de la app, en `D:\mpos-tmp\dp18\triage-borrador.md` (para la Parte 4):
  A1–A17; los nuevos de estas corridas son el interbloqueo de «Preparar» (A12, 500), los «−»/«+» del
  carrito sin nombre (A13), botones repetidos al dividir (A14), el mapa de mesas sin rol ni foco en
  tableta y escritorio (A15), el diálogo del portal en modo mesero que se sale de la pantalla a 360 px
  (A16) y los campos del pago mixto sin etiqueta (A17).
- **13-11, cambio de prioridades (entrega el lunes 16):** las fallas que estorbaban para operar el
  lunes (A1–A4, A11 decidido en DP-D115, A12, A15, A16, A17) se arreglaron en una rama aparte y están
  en producción (#26, f8420ba). El resto de A1–A18 queda para la Parte 4. Una falla del simulador ya
  no detiene el día: se anota como prueba mal hecha, se esquiva y el día sigue.
- **Día 1, quinta corrida (×3, completa, aceptada con notas):** 258 min reales. 207 cobros por
  $133,911.74 (128 de mesa, 79 para llevar), 119 cuentas, 927 renglones, 32 descuentos, 10 divisiones,
  24 cambios de mesa, 3 uniones, 7 cancelaciones, 7 retiros, 2 gastos, 3 compras, 2 mermas. 9 críticos,
  todos falsos (propina de las partes de una cuenta «Sin propina» del portal); el libro cuadró 1696 de
  1703 (3 propinas del guion, 2 de inventario del build viejo —A3, ya en producción— y 2 del dueño, que
  se cayó con la sesión vencida). Guardada en `corridas\d1-rep4\`.
- **El día 1 no cerró:** llegó al tope de las 20:30 con 12 mesas ocupadas, 6 grupos en fila y sus dos
  cajas abiertas, y el día 2 no pudo abrir caja (cupo de 2). Prueba mal hecha: `cierre-forzado.ts`
  cerró por la app lo que quedó (9 cuentas canceladas con motivo; Caja 30 y Caja 49 cerradas contando
  justo lo esperado) y corre ya al final de cada día. Para que no se repita (96fc0da): quien espera mesa
  más de 45 min se va, a las 18:45 ya no se sienta a nadie, ninguna estancia pasa de las 19:00 y la
  cajera vuelve a entrar antes de cerrar si su sesión venció (A18: la sesión dura 8 h y el día 11).
- **Días 2 a 7:** en cadena con `D:\mpos-tmp\dp18\correr-la-semana.sh 2 7` desde el 13-11, 02:45.
