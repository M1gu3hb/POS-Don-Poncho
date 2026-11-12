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
- Lo que el simulador encontró de la app, en `D:\mpos-tmp\dp18\triage-borrador.md` (para la Parte 4).
