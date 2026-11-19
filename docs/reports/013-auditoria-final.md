# 013 · DP-22 · La auditoría final: ¿está listo para operar todos los días?

- **Fechas:** lunes 16-11-2026 (hacia las 20:50, hora de CDMX) → miércoles 18-11-2026. Pruebas físicas de
  Miguel: la noche del 18-11. Entrega al restaurante: jueves 19-11.
- **Dónde:** sesión local de Claude Code en la laptop de Miguel; agentes Sonnet en árboles propios,
  cada uno sin commit y revisado por la sesión principal. Seis PR (#37 a #42), cada uno con su CI y,
  en los cinco primeros, su humo y su revisión de Vercel.
- **Producción no se usó para probar.** Todo se probó en local o sobre una copia. En producción sólo
  se leyó (conexión de sesión, 5432, transacciones de sólo lectura), se aplicaron las migraciones 194 y
  195 (aditivas) y se hizo la Parte 11 (configurar y dejar en ceros).
- **Sin secretos ni PIN en este documento.** Ningún PIN real lo tecleó un agente.
- **Quién escribió esto:** el agente redactor, sólo con lo que dicen las fuentes del §11. El veredicto
  (§1) y la calificación (§7) son **PROPUESTA DEL REDACTOR**: el director los confirma o los cambia.
- Bitácora: `docs/PROGRESO-DP22.md`. Hallazgos: `docs/qa-final/HALLAZGOS.md`. Lo nuevo:
  `docs/qa-final/NUEVO.md`. Decisiones: DP-D146 a DP-D183.

## 0 · Lo esencial, en diez líneas

1. **Veredicto propuesto (PROPUESTA DEL REDACTOR): NO**, tal como el encargo define el SÍ («SÍ sólo si
   se cumple todo esto»). De las siete condiciones, **tres se cumplen** (cero críticos y altos
   abiertos; el dinero al centavo y el inventario al gramo; producción en ceros y configurada, con
   la marca de que la hora de Vercel del lote 6 no consta), **tres no se cumplen** (el día de bots
   limpio, lo visual y cada ajuste comprobado) y **una no se puede afirmar** (la matriz «en verde»).
2. **Lo que dice la lectura honesta:** no hay ningún defecto conocido de dinero, de inventario ni de
   datos, ni crítico ni alto, abierto. Lo que impide el SÍ es de otra clase: un día de bots que no se
   puede llamar «limpio» al pie de la letra, 5 hallazgos bajos abiertos (algunos visuales), 7 ajustes
   y 8 tarjetas de Configuración sin comprobar en el navegador y 52 flujos de la matriz sin prueba
   nombrada.
3. **Nada de esto se ha visto en un aparato de verdad.** Esa es la prueba de esta noche (§8).
4. **Calificación propuesta (PROPUESTA DEL REDACTOR): 87 / 100** (el 012 dio 86). Desglose en §7.
5. **Producción:** en ceros (0 cuentas, 0 cajas), configurada, siguiente folio «DP-01001». El bloqueo
   del arranque (H1) **no está activo a propósito**: se activa con `pnpm dia-cero -- --en-serio`
   después de la prueba física (§9).
6. **Cuarto día de bots (semilla 2214):** su informe (`b-dia-4.md`) no existía cuando se redactó esto.
   Todo lo que dependa de él dice «PENDIENTE · cuarto día de bots» y puede cambiar el veredicto de
   la condición 5 y, tal vez, la 4.

## 1 · El veredicto: cada condición del encargo, una por una

**PROPUESTA DEL REDACTOR: NO.** Si el director confirma que el cuarto día de bots sale limpio y decide
dar por buenos los puntos «no se puede afirmar» de abajo, el veredicto puede pasar a SÍ; eso lo
decide él, no este documento.

| #   | Condición del encargo (Parte 12)                                                                      | Evaluación                | Evidencia                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 0 hallazgos críticos o altos abiertos                                                                 | **Se cumple**             | `HALLAZGOS.md`: críticos 0; altos 6 encontrados, 4 arreglados (1, 8, 14, 31) y 2 descartados al reproducirlos (13, 20); abiertos 0. Reserva: el hallazgo 1 (la fecha después de las 18:00) quedó arreglado «falta su e2e táctil con el arnés» y su detalle dice «E y V pendientes»; el hallazgo 8 dice «E pendiente» (verlo en la Caja). El arreglo está probado contra Postgres y con mutantes.      |
| 2   | La matriz completa en verde (o con su «no aplica» justificado)                                        | **No se puede afirmar**   | `MATRIZ.md`: 0 huecos del mapa (`--verificar`); pero de 104 flujos, **52 aparecen «sin prueba»** y los otros 52 «con prueba, por recorrer con el arnés». Muchos de esos 52 sí se ejercitaron (las ternas del dinero, la Parte 5 por pantallas, el día de bots), pero la matriz no lo enlaza. Ver §10, punto 1.                                                                                            |
| 3   | Cada ajuste con su efecto comprobado y las combinaciones en verde                                     | **No se cumple del todo** | De los 78 ajustes del negocio, **59 comprobados**, **7 «por ver en navegador»** (§5.3), 12 sin propósito en un restaurante o fuera de la operación (escondidos o anotados) y 0 sin explicar. De las 17 tarjetas de Configuración, 9 comprobadas y **8 «por comprobar»**. Combinaciones: 27 filas de pares de ajustes y 112 ternas del dinero contra el oráculo, en la integración que pasó la CI (10 de 10). |
| 4   | El dinero al centavo y el inventario al gramo en todas las pruebas y en el día de bots                | **Se cumple**             | Día 2211: 0 diferencias en 11 horas y cierre (1,533 comparaciones). Día 2213: 0 diferencias en las 11 horas y el cierre (1,562 comparaciones: dinero al centavo, inventario al gramo, propinas por mesero, ninguna comanda perdida o atorada). Día 2212: 0 en el cierre. Pruebas: ternas del dinero, Parte 5 (62 de 62 contra el libro). El cuarto día: PENDIENTE · cuarto día de bots.                 |
| 5   | El día de bots limpio                                                                                 | **No se cumple**          | `b-dia.md`, veredicto del árbitro: «¿hay un día LIMPIO? **NO, estrictamente**». La 2213 es limpia en dinero, inventario, propinas, comandas, 5xx y consola, pero no ejecutó R1 y dejó unos 15 incidentes medios. Resultado del cuarto día: PENDIENTE · cuarto día de bots.                                                                                                                                |
| 6   | En lo visual: 0 desbordes, recortes ni encimados abiertos, y axe sin violaciones graves ni críticas   | **No se cumple**          | Abiertos bajos visuales: hallazgo 34 (la barra flotante tapa la parte baja de la primera tarjeta con el teclado abierto), 35 (la Precuenta enseña «—» hasta tocar «Imprimir»), 26 (dos tarjetas con campos a distinta altura) y el residuo del 5 («Compras» se ve cortado en 1093×614). Axe: el único crítico que se anotó (hallazgo 2) está arreglado; **no hay un resumen final de axe** en las fuentes. |
| 7   | Producción desplegada, configurada, en ceros, con `pnpm dia-cero` listo y 0 errores en Vercel         | **Se cumple, con una marca** | Lotes 1 a 5: «READY», humo 0 fallas, 0 errores de Vercel en la hora siguiente. Parte 11 hecha. `pnpm dia-cero` (ensayo): «nada que borrar». Lote 6: 0 errores al desplegar; su hora siguiente (11:55) y su humo **no constan** en las fuentes que recibí (§10, punto 6).                                                                                                                              |

### Lo que falta para un SÍ, dicho exactamente

1. **Un día de bots limpio** (condición 5): una corrida completa con el caos entero (incluido R1, el
   traslado de la Caja 2) y con los últimos arreglos del guion. Es el cuarto día. PENDIENTE · cuarto
   día de bots.
2. **Lo visual abierto** (condición 6): cerrar o aceptar por escrito los hallazgos 26, 34 y 35, y tener
   un resumen final de axe de las pantallas de operación.
3. **Ajustes y matriz** (condiciones 2 y 3): comprobar en el navegador los 7 ajustes visuales y de
   portal y las 8 tarjetas, o decidir que se prueban en la prueba física; y enlazar a la matriz la
   evidencia de los 52 flujos sin prueba nombrada.
4. **El cierre de lo del lote 6** (condición 7): el humo y la hora de Vercel.

## 2 · Los números

### 2.1 · Qué se cubrió

Fuente: `docs/qa-final/MATRIZ.md` (generada sobre `e4e0a70`; en el lote 6 se regeneró y quedó con 0
huecos) y `qa/qa-final/datos/`.

| Cosa                          | Cantidad                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| Pantallas (rutas)             | 34 (28 con sesión) y 108 ventanas (diálogos, confirmaciones y paneles)                                |
| Aparatos del arnés            | 14 perfiles, todos con dedo; 29 revisiones por aparato en el barrido de servicio                      |
| Ajustes                       | 96: 78 del negocio y 18 de este aparato                                                               |
| Ajustes con su efecto comprobado | 68 de los 96 (59 del negocio y 9 de este aparato); 77 si se cuentan también las 9 tarjetas comprobadas |
| Tarjetas de Configuración     | 17: 9 comprobadas, 8 por comprobar                                                                    |
| Combinaciones                 | 27 filas de pares de ajustes; 112 ternas del dinero (IVA × propina × descuento × división × pago)     |
| Cambios a media operación     | 11 casos; `cambios-a-media-operacion.integracion.test.ts` pasa 13 de 13                               |
| Flujos                        | 104 en la matriz: 52 «sin prueba» y 52 «con prueba, por recorrer con el arnés» (ver §10, punto 1)     |
| Comandos del restaurante      | 128, de los que 32 no tienen pantalla                                                                 |
| Lecturas del puente           | 26 entidades                                                                                          |
| Parte 5 por pantallas         | 62 de 62 contra el libro                                                                              |
| Huecos del mapa               | 0                                                                                                     |

### 2.2 · Hallazgos por severidad (38)

| Severidad | Encontrados | Arreglados | Descartados | Abiertos |
| --------- | ----------: | ---------: | ----------: | -------: |
| Crítico   |           0 |          0 |           0 |        0 |
| Alto      |           6 |          4 |           2 |        0 |
| Medio     |          19 |         17 |           2 |        0 |
| Bajo      |          11 |          4 |           2 |        5 |
| Por ver   |           1 |          0 |           1 |        0 |
| Falta     |           1 |          0 |           0 |        1 |
| **Total** |      **38** |     **25** |       **7** |    **6** |

- **Arreglados (25):** 1, 2, 3, 4, 7, 8, 9, 10, 14, 15, 18, 19, 22 y 23 (lotes 1 a 4); 12, 24, 27, 28,
  29, 30, 31, 32, 33 y 36 (lote 5); 37 (lote 6). Todos en producción.
- **Descartados (7)** al reproducirlos (no eran defectos de la app): 5, 6, 13, 17, 20, 21 y 25.
- **Abiertos (6):** el 11, 26, 34, 35 y 38 (bajos, anotados y sin cambio antes de abrir) y el 16
  («falta»: función grande, §12).

### 2.3 · Funciones nuevas (7, de `NUEVO.md`)

| #   | Qué                                                                                              | Decisión | En producción        |
| --- | ------------------------------------------------------------------------------------------------ | -------- | -------------------- |
| 1   | Los cortes en una carpeta (PDF del corte solo en `Documentos\POS Don Poncho\Cortes\AAAA-MM\`)    | DP-D153  | POS: lote 2; app 1.0.2 publicada |
| 2   | El aviso de insumo bajo en el Tablero                                                            | DP-D159  | lote 3               |
| 3   | Lo más vendido (por platillo y por mesero) en Registros                                          | DP-D160  | lote 3               |
| 4   | Pasar la mesa a otro mesero                                                                      | DP-D156  | lote 3               |
| 5   | El teléfono en los pedidos para llevar (migración 194)                                           | DP-D157  | lote 3               |
| 6   | El arqueo por billetes y monedas al cerrar la caja                                               | DP-D178  | lote 5               |
| 7   | El tiempo de cada mesa en el plano del mesero                                                    | DP-D177  | lote 5               |

Además, de la revisión «¿aquí debería poder…?» (16 preguntas, tabla completa en `NUEVO.md`): 8 ya
funcionaban y se comprobaron (1, 2, 5, 6, 7, 8, 11 y 16; con reparos en la 2, la 11 y la 16, que son
los hallazgos 35 y 34 y el de «Registros abre en Cortes»), 6 se construyeron (4, 9, 10, 12, 13 y 14,
que son las funciones 4, 6, 3, 7, 2 y 5), 1 no se construye por diseño (15, la nota por comensal) y 1
es grande y va a §12 (3, pasar un platillo de una cuenta a otra). El aviso de mesa sin atender (parte
de la 12) tampoco se construye: sería una regla nueva.

### 2.4 · Pruebas nuevas

- **Archivos de prueba nuevos desde `63977e1` hasta la rama** (contados con `git diff`, sólo archivos
  añadidos): **109**, de los que 81 son `.test.ts(x)` (27 de ellos de integración contra Postgres) y
  28 son `.spec.ts` (e2e, impresión y arnés). El cambio total: 507 archivos, 6 commits (uno por lote).
- **Suite unitaria completa, lote 6:** 677 archivos y 7,285 pruebas (3 omitidas), todas en verde
  (`r-lote6.md`). En el lote 5: 674 archivos y 7,274 pruebas; integración (venta, registros, caja,
  inventario, restaurante, portal): 121 archivos y 680 pruebas (`r-lote5.md`).
- **Mutantes:** cada arreglo y cada función nueva lleva su mutante; los agentes de entrega de los
  lotes 5 y 6 corrieron mutantes propios sobre lo ajeno y tres sobrevivieron al principio (§3).
- **El arnés se prueba contra sí mismo:** 45 de 45 en tres perfiles y tres mutantes del arnés
  tumban su autoprueba.
- **No tengo la cuenta total de «pruebas» (casos) nuevas** por lote; sólo la de archivos y las
  cifras de las suites de arriba.

### 2.5 · Los días de bots y sus semillas

Día de 8:00 a 19:00, ×4, con árbitro cada hora, sobre `b1d630d` más los arreglos que se le sumaron
(DP-D175, DP-D182, DP-D183). Informe: `b-dia.md` (los tres primeros). Entre medias hubo dos arranques
cortados a propósito (2212 a las 10:30 y a las 9:30) para arreglar y recompilar; no cuentan.

| Semilla | Duración | Cobros                    | Importe    | Árbitro                                                                                          | Incidentes                                  |
| ------- | -------: | ------------------------- | ---------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| 2211    |  188 min | 171 (50 mesa, 121 llevar) | $64,878.10 | 0 diferencias en 11 horas y cierre (1,533 comparaciones), 0 5xx, 0 consola                       | 289 (2 «críticos» de dinero, del guion)     |
| 2212    |  169 min | 154 (62 mesa)             | $84,528.20 | 0 en el cierre; 2 «críticos» a las 14:00 (guion del árbitro)                                     | 139                                         |
| 2213    |  168 min | 174 (68 mesa, 106 llevar) | $69,641.50 | 0 diferencias en las 11 horas y el cierre (1,562 comparaciones), 0 5xx, 0 consola sin explicar   | 76: 0 críticos, 0 altos, 0 «dinero»         |
| 2214    |  PENDIENTE · cuarto día de bots | PENDIENTE · cuarto día de bots | PENDIENTE · cuarto día de bots | PENDIENTE · cuarto día de bots | PENDIENTE · cuarto día de bots |

- **Movimiento del día 2213:** 44 mesas, 13 pedidas por el portal (32 pedidos), 10 unidas, 27 cambios de
  mesa, 8 divididas, 17 cancelaciones, 3 cortes; 11,036 toques, 0 clics.
- **Caos del 2213:** ejecutados P1-P3, C1 a C8 (con sus «r»), S1, S1r, K1, K2, K2r, M1-M3, N1, N2, A1 y
  A2. **No ejecutado: R1** (el traslado de la Caja 2): el plan lo ponía al minuto 420 desde que abre la
  Caja 2 (12:40) y caía a las 19:40; sólo corrió en el 2211. Se arregló el perfil (`perfil-dp22.ts`,
  con prueba) y **no se verificó en un día completo**. Resultado de R1 en el cuarto día: PENDIENTE ·
  cuarto día de bots.
- **Lo que el árbitro y los bots enseñaron:** un defecto de la app (hallazgo 37: «Cambiar de mesa» no
  se ofrecía en el teléfono del mesero; arreglado, DP-D182); del guion, muchos (selectores del
  teléfono, «Marcar entregado», la pregunta «¿Separar mesas o dejarlas unidas?» sin contestar, tres
  «críticos» de dinero que eran del guion); del árbitro uno (al dividir una cuenta la pieza nueva
  entra a la misma comanda con otra hora y el corte por fila contaba una menos; ahora corta por la
  hora de la comanda, DP-D183, **sin relajar el oráculo**).

### 2.6 · Los lotes y la producción

| Lote | PR   | En `main`  | Cuándo (CDMX)  | Migración | CI                                | Humo sin cobrar            | Vercel, hora siguiente             |
| ---- | ---- | ---------- | -------------- | --------- | --------------------------------- | -------------------------- | ---------------------------------- |
| 1    | #37  | `ff03687`  | 17-11, 05:59   | ninguna   | 10 de 10 (2ª corrida)             | 38 revisiones, 0 fallas    | 0 errores (revisado 07:12)         |
| 2    | #38  | `829b13d`  | 17-11, 07:53   | ninguna   | 10 de 10 (3ª corrida, `9965fb8`)  | 38 revisiones, 0 fallas    | 0 errores (revisado 09:00)         |
| 3    | #39  | `e4c45f5`  | 17-11, 15:03   | 194       | 10 de 10 (2ª corrida, `6931ff1`)  | 27 de 27 y rutas nuevas, 0 fallas | 0 errores (revisado 16:06)  |
| 4    | #40  | `6b76050`  | 17-11, 20:37   | 195       | 10 de 10 (5ª corrida, `1023576`)  | 27 de 27, 0 fallas         | 0 errores (revisado 21:43)         |
| 5    | #41  | `e4e0a70`  | 17-11, 23:45   | ninguna   | 10 de 10 (`0f107d1`)              | 0 fallas                   | 0 errores (revisado 00:50, 18-11)  |
| 6    | #42  | `ca7e6f1`  | 18-11, 10:48   | ninguna   | 10 de 10 (`3a102d4`)              | no consta en las fuentes   | 0 al desplegar; la hora siguiente se revisa a las 11:55 y su resultado no consta en las fuentes |

- Migraciones en producción: hasta la **195** (127 aplicadas). Las dos de esta auditoría (194 y 195)
  son aditivas y se ensayaron antes (aplicar y revertir) con el código anterior aún desplegado.
- **Producción hoy** (`produccion-final.txt`, 17-11 23:58): 0 cuentas, 0 cajas, 0 comandas, 0 carritos, 0
  pagos, 10 mesas libres, siguiente folio «DP-01001» (cuentas 1001, cortes 101), 35 aparatos sin
  ningún «Caja N», «Almacén principal», IVA «Sin IVA», prefijo «DP», dos cajas («Caja 1» y «Caja
  2»), «silenciar notificaciones del administrador» encendido. La lectura posterior al lote 6 se
  comparó con esa; su resultado no consta en las fuentes.
- La **app de Windows 1.0.2** está publicada en `canal-don-poncho` y se vio llegar a una 1.0.1 instalada
  en la laptop por los dos caminos («Reiniciar ahora»: instalada y reabierta sola a los 22 s del
  aviso; «Al cerrar»: instalada en 25 s).

## 3 · Lo que salió mal en el camino, y cómo se cazó

Nada de esto llegó roto a operar. Se dice porque explica por qué se repite tanto «se corre todo, no
sólo lo nuevo».

1. **El arreglo del hallazgo 12 que se desplegó y no funcionaba.** En el lote 4 (DP-D168) la Caja
   debía releer la cuenta cuando el total cambió desde la precuenta; el arreglo comparaba
   `err.codigo`, pero el servidor manda la regla en `datos.regla` (y el contrato leía el texto). Se
   desplegó y **no llegaba a ejecutarse**. Se vio al probarlo con el dedo en tableta, se corrigió en
   el lote 5 (DP-D172) y quedó visto funcionando: el total pasa al nuevo y el segundo cobro cobra.
2. **La migración 195 no corría desde cero.** En una base nueva las migraciones van en una
   transacción y su `update` tocaba filas de demostración de la 042 y la 043, que llevan un motivo
   escrito a mano; Postgres rechazaba. **Lo cazó la CI** (quinta corrida), que migra desde cero;
   en producción no habría fallado (no tiene esas filas). Arreglo `ae66054`. Lección: una migración
   con relleno se prueba también desde cero.
3. **Las comprobaciones locales del lote 5 reportaban 0 por un error del guion**, es decir, un «todo
   en cero» que no probaba nada. Lo cazó la CI. (Según el encargo del director; el detalle no está
   en los archivos de fuente que recibí.)
4. **Informes de agentes que dijeron «verde» sin estarlo.** Lo documentado: en el lote 1 las pruebas
   por zona estaban en verde y `verify-lote1` encontró 19 unitarias en rojo (la base falsa no
   entendía `in` dentro de un `or`; un texto partido en dos renglones rompió un contrato); en el lote
   3 un conflicto sin resolver quedó en `aspecto-permitido.json` porque la lista de conflictos se
   cortó con `head`; en el lote 5 el agente del costo por medida entregó una prueba «de receta
   igual» que estaba vacía (sus insumos costaban 0) y un mutante sobrevivía; en el lote 6, otro
   mutante sobrevivía porque la prueba sólo buscaba el nombre del botón. En todos los casos lo cazó
   la revisión de la sesión principal, un mutante propio o la CI.
5. **Otros golpes de la CI antes de unir (no llegaron a `main`):** una prueba de sonidos con una
   suposición vieja (lote 1); botones con alto fijo (`verify:primitivas`) y dos contratos de ayudantes
   de prueba mal ubicados (lote 2); `verify:cobertura` que sólo lee 60 líneas (lote 3); errores de
   lint, una constante duplicada y botones «Cerrar» repetidos en pruebas viejas (lote 4);
   `verify:aspecto` por dos archivos heredados sin declarar y una línea sin formato (lote 5).
6. **Falsos hallazgos.** El 5 era un falso positivo del arnés; el 20 (el cierre en el iMin) era la
   máquina cargada; el 21 era un toque de la prueba que caía bajo el pliegue. Se descartaron al
   reproducirlos, no antes: durante un tiempo contaron como defectos.
7. **Una regresión visual en DP-21** (el piso de 44 px) llegó a producción y se vio por una captura; en
   DP-22 el arnés mide 44 px por componente (DP-D154) y el contrato
   `blancos-por-componente.contrato.test.ts` lo ata.

## 4 · Lo que NO se pudo probar aquí

Todo esto va a la lista física (§8). Nada de lo de abajo se ha visto en un aparato real.

- **El POS dentro de la app de Windows contra el servidor local.** La app sólo acepta `https://` y el
  dominio exacto de producción, a propósito (DP-D162). Se probó el Chromium 156 del arnés (el mismo
  motor que trae Electron 45) y el humo de la app empaquetada (10 de 10 en la 1.0.2).
- **Guardar el PDF de un corte de punta a punta en la app instalada.** Haría falta cerrar una caja en
  producción con un PIN real.
- **Impresoras, cajón y papel reales.** El papel se probó contra el emulador de impresora y el
  componente real del ticket y del corte.
- **El iMin físico** (motor, colores, teclado y táctil del aparato), probado en Chromium 99 y 103 de
  escritorio.
- **La tableta real, el teléfono real del mesero y el del comensal.** Todo con el toque emulado por el
  arnés (CDP).
- **El Wi-Fi del local.** Los cortes de red de 30 s se probaron en los bots, no en el local.
- **Nada con PIN reales.** Ningún agente los tecleó.
- **El botón «Cambiar de mesa» del teléfono en un teléfono real** (sólo prueba de contrato y los 27
  cambios del día 2213).
- **El teclado táctil de Windows**, el sonido y la voz oídos en la bocina del aparato.

## 5 · Lo abierto

### 5.1 · Hallazgos abiertos

| #   | Sev.  | Qué                                                                                       | Por qué no se cambió                                                                              |
| --- | ----- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 11  | bajo  | El servidor acepta una propina al cobrar aunque nadie pueda elegirla en Configuración     | Endurecer el cobro arriesga romper un cobro legítimo (la propina puede venir fijada por el comensal o el mesero). A la lista de después. |
| 26  | bajo  | Caja → Movimientos: los campos de «Corte de turno» y «Retiro de caja» no quedan a la misma altura | Cosmético, declarado en el barrido. Pide `subgrid` o igualar textos.                              |
| 34  | bajo  | Pedido del mesero, teléfono 360×800: con el teclado abierto la barra flotante tapa la parte baja de la primera tarjeta | Se alcanza desplazando.                                                                          |
| 35  | bajo  | Precuenta en tableta: tras cerrar «Pre-cuenta lista» no hay botón para otra hoja (sólo por el menú Precuenta) y esa pantalla enseña «—» hasta tocar «Imprimir» | Anotado, sin cambio antes de abrir.                                                               |
| 38  | bajo  | Pedido del mesero, teléfono: con la cuenta ya pedida la barra desaparece y el mesero no tiene «Cambiar de mesa» | Anotado, sin cambio antes de abrir.                                                               |
| 16  | falta | No hay pantalla para darle receta a las OPCIONES de un platillo                           | Es una función grande (§12). Mientras tanto una opción no cambia el inventario: baja la receta base. |

### 5.2 · El día de bots sin un día LIMPIO estricto

Ver §2.5 y la condición 5. Los tres primeros días no cumplen «limpio» al pie de la letra: la 2213,
la mejor, no ejecutó R1 y dejó unos 15 incidentes medios, de guion o de medición (agotado que gana a
la ronda planeada ×5, modo espera tapando un cobro ×2, portal ×4, medidas de merma, retiro y cierre
de caja, «Registrar compra» ajeno). Quedaron **sin arreglar y anotados:** el modo espera durante el
cobro; la lentitud de los formularios (merma, retiro, compra y cierre de caja medían 10.9 s en la
2213, sin causa demostrada: no se pudo separar lo de la app de lo de los toques del bot); el hallazgo
38; y la sesión de la Caja de 12 h fijas (por diseño). Cuarto día: PENDIENTE · cuarto día de bots.

### 5.3 · Los ajustes de Configuración sin comprobar en el navegador

Fuente: `qa/qa-final/datos/efectos.json` y `MATRIZ.md`. De los 78 ajustes del negocio:

- **59 comprobados.**
- **7 «por ver en navegador»** (no hay prueba que los demuestre; son visuales o de aparato):
  `background_fit`, `background_image_url`, `background_logo_url`, `background_opacity`, `logo_url`,
  `experiencia.sonidos_en_el_portal` y `portal_qr_cuenta_modo` (éste tiene pruebas de servidor y de
  portal, pero la matriz lo deja «por ver»).
- **12 sin comprobar a propósito:** 10 «sin propósito en un restaurante» y escondidos (`bascula_etiqueta`,
  `color_secundario`, `formato_export_default`, `modo_presentacion_activo`, `moneda`,
  `presentacion_ultimo_acceso`, `simbolo_moneda`, `usa_barra`, `usa_cocina`, `usa_mesas`), `paquete_modo`
  («no se cambia en la operación», sólo por comando de plataforma) y `permitir_venta_sin_stock`
  («escondido en Avanzado», nadie lo lee hoy: manda la opción de cada producto).

De las 17 tarjetas que no guardan una clave, **8 «por comprobar»:** Mapa de mesas, Proveedores, Usuarios
POS, Exportar datos actuales, Importar datos desde archivo, Impresora de este aparato, Laboratorio del
proveedor y Reiniciar sistema para cliente. (Varias tienen pruebas e2e nombradas, pero no se dieron por
comprobadas con mutante.)

De este aparato: 9 comprobados y 9 que son memoria del navegador (no ajustes).

### 5.4 · El bloqueo H1 no está activo

A propósito (DP-D149): la fecha de apertura no estaba definida y Miguel prueba en físico. Mientras no
esté activo, **lo cobrado se puede borrar** con los guiones de mantenimiento. Lo activa
`pnpm dia-cero -- --en-serio` (§9), y desde ese momento lo cobrado ya no se borra.

### 5.5 · Más reservas, de menor tamaño

- Remisión de crédito de ferretería y merma por cancelación **no** pasan por el costo por medida; lo
  ya cobrado con costo cero no se reescribe (lo cobrado antes del lote 5 queda en cero).
- Dos renglones del mismo insumo en una cuenta redondean cada uno (hasta 1 ¢ contra el kardex).
- `PropinasDashboardSection.jsx` todavía lee una lista que puede venir cortada (sobra del agente 2).
- El encabezado del diálogo de la mesa conserva «Esperando entrega» unos minutos (cosmético).
- La galería de la CI del lote 6: 12 de 81 retratos difieren sólo por ruido de dibujo y no se copiaron.

## 6 · Lo que se comprobó, para que se sepa dónde sí hay evidencia

- **Dinero:** ternas del dinero (112) y pares de ajustes (27) contra un oráculo aparte; 11 cambios a
  media operación; la propina al medio centavo (hallazgo 9); la cuenta dividida con el IVA cambiado
  (hallazgo 8); el costo exacto de los insumos en diezmilésimas de centavo con un solo redondeo
  (hallazgo 14: siete compras de $12,000.00 valían $11,948.50 en «Valor de inventario» y ahora
  valen $12,000.00); el costo de lo que se vende por kilo o por porción (hallazgo 27).
- **Inventario al gramo:** Parte 5 completa por pantallas (catálogo, compras, recetas, ventas por los
  cuatro canales, alertas, conteo, merma, valor y reportes contra el libro: 62 de 62).
- **Servicio con el dedo:** el barrido de las pantallas de servicio en 14 aparatos (entrada con PIN,
  Caja, Para llevar, mesero, Cocina, corte y cierre).
- **Seguridad de la operación:** cambiar el PIN de otra persona cierra sus sesiones (hallazgo 10);
  los candados de la cocina (200 cruces sin un 500); el tope por IP del laboratorio.
- **Configuración:** 77 puntos con su prueba, cada una vista fallar al romper su lector (DP-D163).

## 7 · Calificación del POS en la nube

**PROPUESTA DEL REDACTOR: 87 / 100** (en DP-21: 86). Es un juicio, no un cálculo; el desglose sirve
para discutirlo.

| Eje                                                              | Puntos | De  | Por qué                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | -----: | --: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dinero e inventario                                              |     29 |  30 | Cuatro hallazgos de dinero encontrados y arreglados con prueba y mutante; 0 diferencias en tres días de bots. Resta un punto: lo cobrado antes del lote 5 por kilo o porción queda con costo cero.                                                       |
| Pruebas, mapa y ajustes                                          |     16 |  20 | Arnés propio que se prueba a sí mismo, 109 archivos de prueba nuevos, la CI en 10 de 10 en cada lote. Resta: 52 flujos sin prueba nombrada en la matriz, 7 ajustes y 8 tarjetas sin comprobar en el navegador, y dos fallos que sólo la CI o la sesión cazaron (§3). |
| Operación simulada (días de bots)                                |     16 |  20 | Tres días con el árbitro en cero diferencias y 0 críticos ni altos en el mejor. Resta: ningún día limpio al pie de la letra, R1 sin ejecutarse, formularios lentos sin explicar. Cuarto día: PENDIENTE · cuarto día de bots.                             |
| Producción lista                                                 |     14 |  15 | Seis lotes en verde, humo en cero fallas en cinco de ellos, 0 errores de Vercel, producción en ceros y `pnpm dia-cero` listo. Resta un punto: H1 sin activar y lo del lote 6 sin constar.                                                                |
| Lo visto en aparatos reales y lo visual                          |     12 |  15 | Nada se ha visto en un iMin, una tableta o un teléfono reales; 5 bajos abiertos (algunos visuales); sin resumen final de axe. Es la misma razón que bajó la nota en DP-21, y la prueba de esta noche es lo que la subiría.                                |
| **Total**                                                        | **87** | **100** |                                                                                                                                                                                                                                                      |

- **Qué la subiría a 90 o más:** que la prueba física de esta noche salga sin hallazgos graves; un
  cuarto día de bots limpio; la matriz con la evidencia enlazada de los 52 flujos; los 7 ajustes
  visuales y las 8 tarjetas comprobados; y un resumen final de axe.
- **Qué la bajaría:** que en la prueba física falle algo de lo de §4 (impresión, cajón, PDF en la
  app, Wi-Fi) o que el cuarto día de bots deje un incidente de dinero o de inventario.

## 8 · La lista física para Miguel

Lo que sólo se puede comprobar con los aparatos reales. Está en el orden de un día real. Antes de
empezar: ten a la mano el iMin, la tableta, el teléfono del mesero, un teléfono «de comensal» (con
el Wi-Fi del local), la impresora con papel y el cajón. **Los PIN los tecleas tú**; aquí no se
escribe ninguno. Apunta la hora y lo que viste en cada paso.

### 8.1 · Dos minutos por aparato (Parte 11.5)

En cada aparato, al abrir la app por primera vez:

| #   | Qué hacer                                                              | Qué debe ver                                                                                                                                                    |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Abrir la app. Si trae la 1.0.1, dejar que se actualice                  | Aparece el aviso «POS Don Poncho tiene una actualización · La versión 1.0.2 ya está lista». Con «Reiniciar ahora» se instala y la app se abre sola; con «Al cerrar», se instala al cerrarla. |
| 2   | Configuración → Este aparato: ponerle nombre                           | El nombre queda y se ve en la Caja de los demás aparatos.                                                                                                       |
| 3   | «¿Tiene cajón?»: decir que sí o no y probarlo                          | Si lo tiene, el cajón se abre al probarlo.                                                                                                      |
| 4   | Una impresión real («Imprimir prueba»)                                 | Sale la hoja de prueba por la impresora de ese aparato, a 58 u 80 mm según el papel, en menos de 20 s. Si la impresora no responde, la pantalla avisa en vez de quedarse colgada. |
| 5   | El teclado táctil real de Windows (tocar un campo de texto)            | Aparece el teclado y el campo sigue a la vista. En el iMin y en las PC táctiles: ver que la pulsación larga no selecciona texto ni saca «copiar».                |
| 6   | El sonido y la voz                                                     | La voz de aviso se oye y el volumen (apagado, suave, normal) cambia lo que se oye.                                                                              |
| 7   | «Esta pantalla anuncia las comandas»                                   | Sólo la pantalla de cocina anuncia; la del dueño no (aparece el aviso de que no suena y dónde encenderlo).                                                       |

### 8.2 · Un día real, en orden

| #   | Qué hacer                                                                                                                              | Qué debe ver                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Abrir caja en el iMin** (con un fondo)                                                                                               | «Caja abierta desde…» con la hora; el botón «Abrir caja» queda desactivado y dice por qué. La caja se llama «Caja 1» (o «Caja 2» si la abres en dos aparatos: debe dejarte abrir dos a la vez, no tres).                                                                                                                              |
| 2   | **Una mesa de punta a punta, con el mesero en el teléfono:** abrir la mesa, pedir 2 o 3 platillos, mandar a cocina                       | El pedido aparece en la pantalla de cocina y suena la comanda nueva. La mesa del plano dice cuánto lleva abierta («5 min», con el reloj del aparato).                                                                                                                                                                                  |
| 3   | **Cocina:** marcar «Preparar» y luego «Listo» en cada platillo                                                                           | Con el último platillo «Listo» la mesa pasa a «Esperando entrega» y el mesero recibe el aviso (sonido o voz). Prueba también: quitar un platillo cuando el otro ya está «Listo»: la comanda debe quedar «Listo», no en «Nuevo».                                                                                                      |
| 4   | **En el teléfono del mesero:** buscar «limón» en el menú; abrir la hoja del pedido; tocar «Cambiar de mesa»                              | «Limonada» aparece aunque escribas «limón». En la hoja hay «Cambiar de mesa», además de «Solicitar cuenta»; elegir una mesa libre mueve la cuenta con su propina y su lugar en el plano. (Nuevo del lote 6: nunca se ha visto en un teléfono real.)                                                                                |
| 5   | **La cuenta y el cobro en efectivo:** pedir la cuenta (con propina elegida por el comensal o la caja), imprimir la **precuenta**; cobrar en efectivo | La precuenta sale en la impresora con el nombre, la dirección y los renglones que elegiste en «El ticket a tu gusto». El cajón se abre al cobrar en efectivo. El ticket sale con el folio de la serie «DP» (la primera cuenta después del día cero es «DP-01001») y la propina aparte.                                                  |
| 6   | **Otra mesa cobrada con tarjeta** (y una cuenta mixta, efectivo más tarjeta)                                                           | El ticket suma lo mismo que la pantalla, al centavo; en el corte la tarjeta aparece aparte.                                                                                                                                                                                                                                              |
| 7   | **Para llevar, con teléfono:** en la Caja, «Pedido para llevar» con nombre y el teléfono del cliente                                    | El teléfono es opcional; se ve en la lista de para llevar. **No** sale en el ticket ni en cocina. El teclado táctil de Windows deja escribir el número.                                                                                                                                                                                |
| 8   | **El portal QR desde un teléfono real** (con el Wi-Fi del local o con datos): escanear el QR de una mesa; ver el menú; pedir algo; pedir la cuenta con propina | El menú carga, sólo salen los platillos visibles y no los agotados; el pedido llega al mesero (o a cocina, según el ajuste); al pedir la cuenta el comensal ve su precuenta y su propina cuadra con la de la Caja. Prueba también «Necesito ayuda»: debe sonar o avisar en el aparato del mesero.                                          |
| 9   | **Cancelar con clave de gerencia:** con una cuenta ya pedida, cancelar un platillo o aplicar un descuento                                | Pide la clave de gerencia (la tecleas tú), pide el motivo y no deja sin motivo. Un mesero solo **no puede**. Queda «Autorizó … · motivo» en el corte y en Registros → Cancelaciones.                                                                                                                                                  |
| 10  | **Corte de turno** (en Caja → Movimientos)                                                                                             | Enseña los números del turno **sin cerrar la caja** y sin mover los folios.                                                                                                                                                                                                                                                              |
| 11  | **Cerrar la caja del día, sin «Contar por billetes y monedas»:** teclear sólo el total del efectivo                                      | El cierre se hace como siempre; el diálogo se cierra a los pocos segundos (en el motor del iMin tarda unos 5 s). Si el PDF no se pudo guardar, el aviso dice que la caja sí se cerró.                                                                                                                                                  |
| 12  | **Cerrar otra caja (o la siguiente) «Contando por billetes y monedas»:** 11 filas con − y +, y las piezas se pueden teclear              | El total sale de las piezas y es el efectivo contado; el conteo sale en la hoja del corte («Conteo por denominación») y el efectivo cuadra con lo cobrado.                                                                                                                                                                              |
| 13  | **El PDF del corte en la carpeta:** abrir `Documentos\POS Don Poncho\Cortes\AAAA-MM\` en la laptop o el aparato de Windows con la app 1.0.2 | Está el PDF del corte con su folio («DPC-…») sin haber tocado nada. En Registros → Cortes, «Guardar en la carpeta» y «Abrir carpeta» funcionan. (En un navegador esos botones no aparecen: es lo esperado.)                                                                                                                           |
| 14  | **Reimprimir la precuenta y el ticket** («copias de impresión» en 2 si quieres probarlo)                                                | La precuenta dice «REIMPRESIÓN · 2ª HOJA» (o 3ª); con 2 copias, «ORIGINAL — CLIENTE» y «COPIA — NEGOCIO». El papel dice lo mismo que la pantalla.                                                                                                                                                                                     |
| 15  | **El cajón a mano con PIN** (Abrir cajón sin cobrar)                                                                                    | Pide el PIN de quien puede y el cajón se abre.                                                                                                                                                                                                                                                                                          |
| 16  | **En la tableta, crear una receta eligiendo «Variable por medida»** (Recetas → Nueva receta → «Tipo de venta»)                           | El desplegable se abre dentro de la pantalla y se puede elegir con el dedo (es el hallazgo 13, que no se reprodujo en el emulador: 27 de 27 desplegables; aquí es la prueba real). Si no se puede, anótalo: sería un hallazgo alto.                                                                                                      |
| 17  | **En la tableta, registrar una compra y una merma** (Compras y gastos → «Registrar compra»; Inventario → Ajustar → «Merma / producto perdido») | La compra sube el «Valor de inventario» sin perder centavos; la merma sale en el corte y en el kardex con su costo (no en $0). Si el almacenista tiene su propio puesto, «Registrar compra» sólo se le ofrece a quien puede registrar compras.                                                                                       |
| 18 | **Cortar el Wi-Fi 30 s en un aparato con una cuenta abierta y volver a conectar**                                                       | El aparato se recupera sin perder la cuenta ni cobrarla dos veces.                                                                                                                                                                                                                                                                      |
| 19 | **Ver el tiempo de cada mesa abierta** al cierre de la prueba                                                                           | «N min» es razonable según el reloj del aparato (usa la hora del aparato, como la cocina). Si un aparato tiene la hora mal, el tiempo saldrá mal: revisa la hora de cada uno antes de empezar.                                                                                                                                         |
| 20 | **Cerrar todas las cajas** al terminar                                                                                                  | Ninguna caja abierta. `pnpm dia-cero` se niega mientras haya una abierta (§9).                                                                                                                                                                                                                                                          |

Lo que veas distinto a la columna de la derecha, anótalo con la hora y una foto: es un hallazgo nuevo.

## 9 · Cómo dejar todo listo después de la prueba física

Con todas las cajas cerradas, desde el checkout del POS (`docs/RUNBOOK.md` §8.2):

1. **Ensayo:** `pnpm dia-cero` (sin más). No escribe. Dice cuántas cuentas de prueba hay y lo que
   haría.
2. **En serio:** `pnpm dia-cero -- --en-serio --ventas <n>`, con `<n>` igual al número de cuentas
   cobradas que dijo el ensayo (si no hay ninguna, basta `--en-serio`). En este orden: comprueba que
   no haya cajas abiertas ni operación real; borra las cuentas de la prueba (con su inventario de
   vuelta), las cajas y sus cortes; repone la configuración de arranque y el primer folio (1001 y
   101); deja como «Aparato N» los aparatos que se llamaban «Caja N»; **activa el bloqueo H1** con la
   hora del servidor (desde ese momento lo cobrado ya no se borra); y verifica leyendo: 0 cuentas, 0
   cajas, 0 comandas, 0 carritos, las mesas libres y el siguiente folio «DP-01001».
3. **Se niega, sin borrar nada,** si hay una caja abierta, si el número de cuentas no es el de
   `--ventas`, si hay cuentas anteriores a `--desde` (por omisión 2026-11-16) o si el negocio ya
   opera. Ante cualquier negativa: no insistir, leer el mensaje y avisar.
4. El renombrado sólo toca los aparatos que se llaman exactamente «Caja N» (`renombrar-aparatos.mjs`):
   los nombres que les pongas en la prueba se quedan.
5. Si hay que deshacer el bloqueo, **sólo cuando Miguel lo pide**: `scripts/operacion-real.mjs
   --quitar` (RUNBOOK §8.3).

## 10 · Lo que no pude sacar de las fuentes o no cuadra entre ellas

Para que el director lo vea antes de firmar:

1. **Los flujos de la matriz.** `MATRIZ.md` dice 52 de 104 flujos «sin prueba» y los otros 52 «con
   prueba, por recorrer con el arnés». Los nombres de la lista sin prueba (cobrar con tarjeta,
   cobro mixto, dividir en partes iguales, el corte en papel, Registros, los ajustes de este
   aparato…) están cubiertos por otras pruebas (ternas del dinero, impresión, Parte 5, día de bots),
   pero **la matriz no enlaza esa evidencia**. Lo dejé como «no se puede afirmar» y no como
   cumplido.
2. **Dos números de ajustes comprobados.** La matriz resume «68 con su efecto comprobado» (ajustes
   del negocio y de este aparato) y `efectos.json` y la bitácora del lote 4 dicen «77» (ahí entran
   también las 9 tarjetas comprobadas). Uso ambos y digo qué cuenta cada uno.
3. **Texto viejo en `HALLAZGOS.md`.** El hallazgo 12 dice «por desplegar» y el 37 «por desplegar», y el
   párrafo del resumen dice lo mismo del 37; ya están en producción (lote 5 y lote 6). La tabla tiene
   la severidad correcta; el estado hay que actualizarlo.
4. **Número de comandos.** La bitácora de arranque dice 124 y `ESTADO.md` dice 126; la matriz
   regenerada dice 128. Uso el de la matriz (el más reciente).
5. **Cuarto día de bots** (`b-dia-4.md`): no existía al redactar. Marcas «PENDIENTE · cuarto día de
   bots» en el §0, §1 (condiciones 4 y 5), §2.5 (fila 2214 y R1), §5.2 y §7.
6. **Lote 6:** el humo (`humo-produccion.sh 6`), la lectura de producción posterior y la hora
   siguiente de Vercel (11:55) no constan en las fuentes: `hechos-lote5-y-parte11.md` dice «ver abajo»
   y no hay nada abajo. El director debe anotarlos.
7. **Comprobaciones del lote 5 con «0» por un error del guion:** lo tomo del encargo; no encontré el
   detalle en los archivos.
8. **Resumen final de axe** y de «desbordes, recortes y encimados» de todas las pantallas de operación:
   no existe en las fuentes; sólo el barrido de servicio (DP-D154) y los hallazgos anotados.
9. **Número total de pruebas nuevas (casos):** sólo archivos (109) y las cifras de las suites.

## 11 · Fuentes

`docs/qa-final/HALLAZGOS.md`, `NUEVO.md`, `ESTADO.md`, `PLAN.md`, `MATRIZ.md`;
`qa/qa-final/datos/efectos.json`, `flujos.json` y `combinaciones/`; `docs/PROGRESO-DP22.md`;
`DECISIONES.md` (DP-D146 a DP-D183); `docs/RUNBOOK.md` §8; `docs/reports/012-cierre-antes-de-instalar.md`
(estilo y calificación anterior); y, fuera del repo, `D:\mpos-tmp\dp22\encargo.md` (Parte 12),
`ORQUESTA.md` y `informes\` (`hechos-lote5-y-parte11.md`, `r-lote5.md`, `r-lote6.md`, `i-informe.md`,
`b-dia.md`). Los 109 archivos de prueba nuevos se contaron con `git diff --name-status 63977e1..HEAD`.

## 12 · Lo grande que queda para después (con su tamaño)

Nada de esto se toca antes de abrir. Tamaños de `NUEVO.md`.

| Qué                                                                                                                       | Por qué no entra                                                                                                                                                                                                                  | Tamaño          |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| La receta de las OPCIONES de un platillo (hallazgo 16): que «con doble carne» o «sin queso» cambien lo que baja del inventario | El dominio, la base y el cobro ya lo soportan; faltan el editor de opciones y el de la receta y el contrato de dos comandos. Diseño en DP-D169. Mientras tanto, una opción no cambia el inventario: baja la receta base del platillo. | 1.5 a 2 días    |
| El descuento por renglón (hoy es a la cuenta entera) y las partes de una cuenta dividida en dinero igual                    | Cambia reglas de dinero (prorrateo, impuestos por renglón, el papel).                                                                                                                                                              | 2 a 3 días      |
| Pasar un platillo de una cuenta a otra (entre dos mesas)                                                                  | Hay que mover el renglón y su plato de cocina, recalcular totales, propina y descuento de las dos, re-sincronizar las dos mesas y tomar los candados en orden: toca cocina, dinero y comandas.                                      | 3 a 4 días      |

De lo menor que queda: el hallazgo 11 (que el servidor no acepte propina si nadie puede elegirla), los
bajos 26, 34, 35 y 38, la lentitud de los formularios sin explicar, el modo espera durante el cobro,
el aviso de mesa sin atender (sería una regla nueva), y los 7 ajustes y 8 tarjetas por comprobar
(§5.3).
