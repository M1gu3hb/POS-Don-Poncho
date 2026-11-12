# El simulador de jornada

Una semana de operación del restaurante, con **bots que usan las pantallas como personas**: meseros,
comensales con el QR, estaciones de cocina, cajeras, gerente, almacén, dueño y caos controlado. Cada
bot es código de Playwright determinista (con semilla), no un agente que improvisa. Al cerrar cada
día, un **árbitro** compara lo que los bots saben que hicieron (el libro) contra lo que dice el
sistema, al centavo y al gramo, y todo lo que no salió como debía queda como **incidente** con su
evidencia.

Se hizo para Don Poncho (DP-18) y sirve igual para el maestro y para cada cliente: cambian la copia,
los nombres del personal y los perfiles.

## Lo primero: producción NO se usa para probar

- **El candado** (`candado.ts`) aborta antes de abrir un navegador o tocar una base si la app no es
  `localhost`, si la base no es local o no se llama `qa_…`, si nombra un proyecto real de Supabase o
  si el proceso corre en Vercel. Lo usan el lanzador, el servidor, la copia y el reloj.
- **Los PIN** de la copia son de prueba: `copia.ts` cambia todos los PIN copiados por PIN de cuatro
  cifras al azar y los escribe en `D:/mpos-tmp/…/pines.json`, fuera del repositorio. Nunca se
  imprimen.
- **El reloj de QA** (mover la hora del negocio) vive sólo aquí: `reloj/precarga.ts` cambia `Date`
  del `next start` del simulador y `reloj/en-la-base.ts` hace que el `now()` de la copia sea el
  simulado. Las dos piezas pasan por el candado y ningún archivo de `apps/` ni `packages/` las
  menciona (`aislado.test.ts` y `reloj/candado-del-reloj.test.ts` lo prueban).

## Lo que hace falta

- Postgres local (el clúster de las copias; aquí, el 5460 con `max_connections=200`).
- Un checkout **compilado** con el mismo código que producción (`next build`), del que `servir.ts`
  arranca `next start`.
- El almacén local de archivos (`almacen-local.ts`) para las fotos: así nada sube al bucket real.
- Chromium de Playwright. La semana abre ~45 contextos a la vez en los picos: corre sola en la
  máquina (16 GB alcanzan sin agentes ni otros servidores).

## Cómo correr la semana

```bash
# 1. La copia: desde la exportación de sólo lectura de la base propia (scripts/exportar-negocio.mjs)
node --conditions=react-server qa/simulador/copia.ts --base postgres://morphiqpos@localhost:5460/qa_dp18_semana \
  --desde "<carpeta de la exportación>" --pines D:/mpos-tmp/qa-dp18-semana

# 2. El reloj en la base de la copia (una vez por copia)
node qa/simulador/reloj/en-la-base.ts postgres://morphiqpos@localhost:5460/qa_dp18_semana

# 3. El almacén de archivos y el servidor (con el reloj puesto en la víspera)
node qa/simulador/almacen-local.ts --carpeta D:/mpos-tmp/dp18/almacen --puerto 54500
node qa/simulador/reloj/fijar.ts --base postgres://…/qa_dp18_semana --archivo D:/mpos-tmp/dp18/reloj.json \
  --sim 2026-11-19T08:00:00-06:00 --factor 6
node qa/simulador/servir.ts --raiz <checkout compilado> --base postgres://…/qa_dp18_semana \
  --puerto 32800 --reloj D:/mpos-tmp/dp18/reloj.json --log D:/mpos-tmp/dp18/servidor.log

# 4. El día 0, por pantallas, y su verificación en sólo lectura
node qa/simulador/dia0/correr.ts --app http://localhost:32800 --base postgres://…/qa_dp18_semana \
  --pines D:/mpos-tmp/qa-dp18-semana/pines.json --reloj D:/mpos-tmp/dp18/reloj.json
node qa/simulador/dia0/verificar.ts --app … --base … --pines … --salida D:/mpos-tmp/dp18/semana

# 5. Un molde por día (para repetir un día que se corta), y el día
node --conditions=react-server qa/simulador/copia.ts --base postgres://…/qa_dp18_molde_d1 \
  --molde qa_dp18_semana --pines D:/mpos-tmp/qa-dp18-molde-d1 --pines-del-molde D:/mpos-tmp/qa-dp18-semana
node --conditions=react-server qa/simulador/correr-dia.ts --dia 1 --app http://localhost:32800 \
  --base postgres://…/qa_dp18_semana --pines D:/mpos-tmp/qa-dp18-semana/pines.json \
  --reloj D:/mpos-tmp/dp18/reloj.json --salida D:/mpos-tmp/dp18/semana --semilla 18 --fijar \
  --publicar docs/qa/semana
```

`--fijar` pone el reloj (servidor, base y navegadores) a las 8:00 de la fecha del día. `--hasta N`
hace un ensayo: a los N minutos ya no llega nadie más y el día cierra como uno de verdad. Un día que
se corta se repite completo desde su molde.

## La semilla

Todo lo que varía sale de `semilla.ts` (un generador con semilla, con hijos por bot): misma semilla,
mismo perfil y misma copia dan el mismo día. La semilla del día es `<semilla>-dia-<N>`.

## Los días (`perfiles.ts`)

| Día | Fecha     | Perfil                               | Cuentas de mesa | Reloj |
| --- | --------- | ------------------------------------ | --------------: | ----: |
| 1   | vie 20-11 | normal                               |             130 |    ×6 |
| 2   | sáb 21-11 | pico de fin de semana (el doble)     |             260 |    ×4 |
| 3   | dom 22-11 | con la red mala                      |             130 |    ×6 |
| 4   | lun 23-11 | con cambios de configuración en vivo |             130 |    ×6 |
| 5   | mar 24-11 | tranquilo                            |              70 |    ×6 |
| 6   | mié 25-11 | pico con 2 cajas y traslado          |             200 |    ×4 |
| 7   | jue 26-11 | el pico final, con todo junto        |             260 |    ×4 |

Cada día abre a las 8:00 con las cajas y su fondo, tiene sus picos de 13:30 a 16:30 y termina pasadas
las 19:00, cuando ya no queda nadie en las mesas ni nada por cobrar (tope 20:30): las cajas cierran
una tras otra (una con faltante y otra con sobrante) y el dueño hace el Cierre del día.

## Los roles

| Bot                   | Archivo                   | Aparato                          | Qué hace                                                                                                                                                                                                                 |
| --------------------- | ------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6 meseros             | `bots/mesero*.ts`         | Android 360/412, iPhone, tableta | abren mesas, piden de todo (cada tipo de producto, opciones, notas largas, celebración), rondas, entregan, piden la cuenta, unen y separan, cambian de mesa, cancelan con PIN, atienden el portal y «Llamar a mi mesero» |
| Comensales            | `bots/comensal*.ts`       | teléfonos                        | de 15 a 25 a la vez: escanean el QR, comparten el carrito (2 a 4 teléfonos por mesa), piden, llaman al mesero y piden la cuenta con propina                                                                              |
| 5 estaciones          | `bots/estacion.ts`        | pantalla grande                  | Cocina, Bebidas, Parrilla, Postres y Pulques: preparar, listo, agotados                                                                                                                                                  |
| 2 teléfonos de cocina | `bots/telefono-cocina.ts` | teléfono                         | carrusel, deslizar, la tira de mesas                                                                                                                                                                                     |
| 2 cajas               | `bots/caja*.ts`           | PC y tableta                     | cobran con todos los métodos y mixto, descuentos, propinas, dividir, para llevar con «Entregado», retiros (los de más de $500 con PIN), entradas de cambio, traslado a media jornada y el corte                          |
| Gerente               | `bots/gerente.ts`         | tableta                          | gastos, compras, agotados a media jornada, cambios en vivo (precio, opción, modo del menú)                                                                                                                               |
| Almacén               | `bots/almacen.ts`         | tableta                          | compras, mermas y conteos                                                                                                                                                                                                |
| Dueño                 | `bots/dueno*.ts`          | PC                               | Tablero, Registros, CSV, cortes y el Cierre del día (y que se niegue con una mesa abierta)                                                                                                                               |
| Caos                  | `bots/caos*.ts`           | varios                           | recargar a la mitad, cerrar la pestaña, la red cae 30 a 60 s, PIN equivocado y bloqueo, dos cajas sobre la misma cuenta, doble toque, sesión vencida, cambio de usuario                                                  |

El día 0 (`dia0/`) deja el negocio listo **por pantallas**, como el dueño: usuarios, las 3 estaciones
de prueba, 10 mesas más con su QR, los 10 productos de prueba (uno de cada tipo), opciones con precio
en productos reales, insumos, recetas, compras y mermas, y la configuración (cupo de 2 cajas,
descuentos y retiros con PIN, alertas de cocina, modo del menú y propina del comensal).

## El volumen

Mínimos de un día normal: ≥120 cuentas de mesa, ≥25 para llevar, ≥700 platillos, ≥60 pedidos del
portal, ≥10 uniones, divisiones y cambios de mesa, ≥15 cancelaciones, ≥20 descuentos, ≥8 retiros,
≥3 gastos, ≥2 compras y ≥3 mermas; en el pico, las 20 mesas ocupadas a la vez. El informe del día
dice cuánto hubo de cada cosa.

## El libro y el árbitro

- `libro.ts`: cada bot anota lo que **sabe** que hizo y lo que **debe** pasar (el dinero por método,
  la propina, el descuento, la cancelación, el canal, la estación, el inventario esperado). Nunca lo
  que dice el servidor.
- `arbitro/`: al cerrar el día compara campo por campo contra el corte de cada caja, el Cierre del
  día, Registros, el CSV, el Tablero, el inventario (receta × ventas + compras − mermas), las compras
  y los gastos, y corre las invariantes de la base en sólo lectura.

## Los incidentes y el informe

- `incidentes.ts` escribe `INCIDENTES.jsonl`; `informe-incidentes.ts`, `INCIDENTES.md`. Cada
  incidente lleva id, día y hora simulada, bot, rol y aparato, pantalla, qué hizo, qué esperaba, qué
  pasó, la evidencia (captura, consola, red, `correlationId`), si es repetición, si se reprodujo, la
  gravedad (crítico, alto, medio, bajo) y la clase (UI, UX, servidor, permisos, concurrencia, dinero,
  inventario, red, rendimiento, prueba, extraordinario).
- Lo lento también es incidente: una acción de más de 3 s o una pantalla que tarda más de 15 s en
  enterarse de un cambio (`tiempos.ts`).
- `informe.ts` escribe `DIA-N.md`: el volumen, el libro contra el sistema, los incidentes y los
  tiempos (p50 y p95 por acción). Con `--publicar`, los informes y los incidentes se copian al repo;
  la evidencia se queda en la carpeta de salida.

## Las piezas

| Archivo                                                              | Qué es                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `candado.ts`                                                         | el candado de producción                                                              |
| `copia.ts`                                                           | arma o clona la copia, con PIN de prueba                                              |
| `reloj/`                                                             | la fórmula, el reloj del servidor, el de la base y cómo fijarlo                       |
| `servir.ts`, `almacen-local.ts`                                      | el servidor del simulador y el almacén de archivos                                    |
| `entorno.ts`, `sesion.ts`, `aparatos.ts`                             | argumentos, entrar con PIN y despertar el modo espera, los aparatos                   |
| `mundo.ts`, `horario.ts`, `pedido.ts`, `catalogo.ts`                 | lo que el personal comparte, las llegadas, qué se pide, el catálogo leído de la copia |
| `bots/`, `pantallas/`                                                | cada rol y cómo usa cada pantalla                                                     |
| `dia0/`                                                              | el día 0 y su verificación                                                            |
| `libro.ts`, `arbitro/`, `incidentes.ts`, `tiempos.ts`, `informe*.ts` | lo esperado, la comparación y los informes                                            |
| `perfiles.ts`, `correr-dia.ts`                                       | los siete días y el lanzador                                                          |
