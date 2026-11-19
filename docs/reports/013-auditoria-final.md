# 013 · DP-22 · La auditoría final: ¿está listo para operar todos los días?

- **Fechas:** lunes 16-11-2026 (hacia las 20:50, hora de CDMX) → miércoles 18-11-2026. Pruebas físicas de
  Miguel: la noche del 18-11. Entrega al restaurante: jueves 19-11.
- **Dónde:** sesión local de Claude Code en la laptop de Miguel; agentes Sonnet en árboles propios,
  cada uno sin commit y revisado por la sesión principal. Siete PR (#37 a #43), cada
  uno con su CI y, en los seis primeros, su humo y su revisión de Vercel. El lote 7 (el último) está en
  PR, **por desplegar**.
- **Producción no se usó para probar.** Todo se probó en local o sobre una copia. En producción sólo
  se leyó (conexión de sesión, 5432, transacciones de sólo lectura), se aplicaron las migraciones 194 y
  195 (aditivas) y se hizo la Parte 11 (configurar y dejar en ceros).
- **Sin secretos ni PIN en este documento.** Ningún PIN real lo tecleó un agente.
- **Quién escribió esto:** el agente redactor y, para el lote 7, el agente de entrega, sólo con lo que
  dicen las fuentes del §11. **El veredicto (§1) lo fijó el director: «NO todavía».** La calificación
  (§7) sigue siendo una **propuesta**: el director la confirma o la cambia.
- Bitácora: `docs/PROGRESO-DP22.md`. Hallazgos: `docs/qa-final/HALLAZGOS.md`. Lo nuevo:
  `docs/qa-final/NUEVO.md`. Decisiones: DP-D146 a DP-D194 (con huecos: los números 184, 185, 189 y
  191 a 193 no se usaron).

## Actualizaciones fechadas del veredicto

- **Lote 8 (18-11, noche): el veredicto NO cambia (sigue «NO todavía») ni la calificación.** Los fija el director tras el
  sexto día de bots. Lo que cerró el lote 8 (rama `dp-22-octavo-lote`, sin migraciones, **por desplegar**):
  **lo visual abierto** (39, 40 y 41: el mapa de mesas a 1366×768 al 125 % ya cabe entero, la hoja del
  carrito se cierra sola al quedar vacía, el aviso ya no tapa el texto de gracias; cada uno con su prueba
  que fallaba antes y pasa después en los aparatos que tocan, sin faltas nuevas en el barrido de servicio de
  Windows y del teléfono), y **dos ajustes de Configuración**: `sonidos_en_el_portal` demostrado en sus dos
  estados y «Borrar todos los datos» demostrado contando filas (borra catálogo, inventario, recetas,
  proveedores, mesas y lo transaccional; conserva organización, sucursal, gente, zonas, estaciones y
  configuración; el otro negocio no se toca; la app queda usable). Hallazgo nuevo, bajo, **44**: la
  pantalla prometía resetear la configuración y el comando no lo hace; se corrigió el texto y queda para
  Miguel decidir si debe resetearla. `efectos.json`: **90 comprobados, 0 por ver en navegador, 2 por
  comprobar** (impresora y cajón, laboratorio: aparato real). **Lo que NO cierra:** nada se vio en un
  aparato real, no hay un resumen final de axe, el día de bots limpio sigue pendiente, y «Importar» con fila
  repetida (42) y dos usuarios con el mismo nombre (43) siguen abiertos.
- **18-11 (redacción de este documento): NO todavía.** Un sexto día de bots corre esta noche sobre el
  código final (informe previsto: `b-dia-6.md`, en la carpeta de informes de la orquesta). Si sale limpio, el
  director cambia el veredicto a SÍ **en una nota fechada aquí, encima de ésta**. Mientras no exista
  esa nota, el veredicto vigente es el de abajo. Ver también qué otras condiciones no se cumplen (§1):
  un sexto día limpio **no basta** por sí solo.

## 0 · Lo esencial, en diez líneas

1. **Veredicto (lo fijó el director): NO todavía**, tal como el encargo define el SÍ («SÍ sólo si
   se cumple todo esto»). De las siete condiciones, **cuatro se cumplen** (cero críticos y altos
   abiertos; la matriz sin flujos sin prueba, con reservas; el dinero al centavo y el inventario al
   gramo; producción en ceros y configurada), **tres no se cumplen** (el día de bots limpio, lo
   visual y cada ajuste comprobado). Ver §1.
2. **Lo que dice la lectura honesta:** no hay ningún defecto conocido de dinero, de inventario ni de
   datos, ni crítico ni alto, abierto. Lo que impide el SÍ es de otra clase: ningún día de bots
   reunió «limpio» al pie de la letra (en los cinco el dinero y el inventario cuadran en el cierre,
   pero cada uno tuvo algo: un error del árbitro, un fallo del guion), un hallazgo **medio** nuevo y
   abierto en lo visual (el mapa de mesas de Configuración corta mesas a 1366×768 al 125 %), 4 bajos
   nuevos, y 3 tarjetas y 1 ajuste de Configuración sin comprobar en el navegador.
3. **Nada de esto se ha visto en un aparato de verdad.** Esa es la prueba de esta noche (§8).
4. **Qué significa para la prueba física de esta noche:** la app **puede probarse**. Está en producción
   (lotes 1 a 6, `ca7e6f1`), configurada y en ceros. Lo que no se cumple (arriba) es lo que decide
   «operar todos los días», no lo que impide probar. El lote 7 (lo visual de V, Configuración, la
   matriz) **no está en producción** hasta que el director lo una; esta noche se prueba sin él salvo
   que lo una antes.
5. **El sexto día de bots corre esta noche sobre el código final:** si sale limpio, el veredicto se
   actualiza a SÍ en una nota fechada al principio de este informe (§ «Actualizaciones fechadas»); pero
   un día limpio no cierra, por sí solo, las condiciones 3 y 6.
6. **Calificación propuesta: 89 / 100** (el 012 dio 86; la propuesta anterior de este informe, 87).
   Desglose en §7. Sigue siendo una propuesta.
7. **Producción:** en ceros (0 cuentas, 0 cajas), configurada, siguiente folio «DP-01001». El bloqueo
   del arranque (H1) **no está activo a propósito**: se activa con `pnpm dia-cero -- --en-serio`
   después de la prueba física (§9).
8. **Cinco días de bots (semillas 2211 a 2215):** en los cinco, 0 diferencias del árbitro en el cierre
   (dinero al centavo, inventario al gramo); las diferencias por hora fueron del árbitro o del guion;
   0 errores 5xx y 0 de consola en los cinco. Todo el caos se ejecutó entre el 2214 y el 2215. Ningún
   día reunió todo a la vez (§2.5).
9. **La matriz:** 104 flujos, 0 sin prueba, 2 «no aplica» con su razón. Hay enlaces menos fuertes que
   el agente M declaró (§10, punto 1).
10. **Lo que no se pudo verificar** está en el §4 y el §10: entre otras cosas, dos líneas que el agente
    de Configuración cambió por eslint después de su última corrida verde, sin mutantes en sus pruebas,
    y la falta de capturas «antes» del agente de lo visual.

## 1 · El veredicto: cada condición del encargo, una por una

**VEREDICTO: NO todavía** (fijado por el director). Cuatro condiciones se cumplen y tres no. El SÍ
exige las siete; un sexto día de bots limpio resolvería la 5, no la 3 ni la 6.

| #   | Condición del encargo (Parte 12)                                                                    | Evaluación                       | Evidencia                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 hallazgos críticos o altos abiertos                                                               | **Se cumple**                    | `HALLAZGOS.md`: críticos 0; altos 6 encontrados, 4 arreglados (1, 8, 14, 31) y 2 descartados al reproducirlos (13, 20); abiertos 0. Reserva: el hallazgo 1 (la fecha después de las 18:00) quedó arreglado «falta su e2e táctil con el arnés» y su detalle dice «E y V pendientes»; el hallazgo 8 dice «E pendiente» (verlo en la Caja). El arreglo está probado contra Postgres y con mutantes. Abierto hoy: 1 medio (39) y 5 bajos (11, 40, 41, 42, 43), más el 16 («falta»).                                                |
| 2   | La matriz completa en verde (o con su «no aplica» justificado)                                      | **Se cumple, con reservas**      | `MATRIZ.md`: 0 huecos del mapa (`--verificar`); 104 flujos, **0 sin prueba** (eran 52), 2 «no aplica» con su razón (descuento por renglón y para llevar desde la mesa; el generador ganó ese estado, DP-D194). Reservas: enlaces menos fuertes que declaró M (§10, punto 1); «Para llevar desde la mesa» está declarado «no aplica» sin que el dueño lo haya confirmado; el resto se llama «con prueba, por recorrer con el arnés»: tener prueba no es haberla corrido hoy.                                                |
| 3   | Cada ajuste con su efecto comprobado y las combinaciones en verde                                   | **No se cumple del todo**        | `efectos.json` (113 puntos): **90 comprobados** (lote 8: `sonidos_en_el_portal` demostrado en sus dos estados y `reiniciar-sistema` demostrado contando filas), **0 por ver en navegador**, **2 por comprobar** (`impresora-y-cajon` y `laboratorio`: lo que exige aparato real va a la lista física), 12 sin propósito en un restaurante o fuera de la operación y 9 que son memoria del aparato. Combinaciones: 27 filas de pares de ajustes y 112 ternas del dinero contra el oráculo, en la integración que pasó la CI (10 de 10). |
| 4   | El dinero al centavo y el inventario al gramo en todas las pruebas y en el día de bots              | **Se cumple**                    | Cinco días: 0 diferencias del árbitro en el cierre de los cinco (1,533 · 2211; 1,562 · 2213; 1,640 · 2214; 1,523 · 2215 comparaciones; el 2212, 0 en el cierre). Las diferencias por hora fueron del árbitro o del guion y ya están explicadas y arregladas (§2.5). Pruebas: ternas del dinero, Parte 5 (62 de 62 contra el libro).                                                                                                                                       |
| 5   | El día de bots limpio                                                                               | **No se cumple**                 | `b-dia.md` y `b-dia-4.md`. El 2214 ejecutó los 30 eventos del caos (R1 incluido) pero el árbitro dio 1 diferencia «crítica» por hora (error del árbitro, arreglado) y una cuenta quedó sin cobrar (error del guion, arreglado). El 2215 cuadró en las 11 horas y el cierre, con 0 críticos y 0 altos, pero ejecutó 29 de 30 eventos (S1r falló: guion, arreglado sin verificar). **Ningún día reunió todo a la vez.** Falta uno con el código final.                                                                                      |
| 6   | En lo visual: 0 desbordes, recortes ni encimados abiertos, y axe sin violaciones graves ni críticas | **No se cumple**                 | Cerrados hoy en el lote 7 (por desplegar): 34, 38, 26 y el resto del 5; el 35, cerrado en parte (la hoja trae «Imprimir otra hoja de la precuenta»; el «—» del total se queda porque el total es de rol caja). **Cerrados en el lote 8 (por desplegar):** el 39 (el mapa de mesas de Configuración se escala y cabe entero a 1366×768 al 125 %, en el iMin y en la tableta), el 40 (la hoja del carrito se cierra sola al quedar vacía) y el 41 (el aviso «Solicitud enviada» ya no tapa el texto de gracias), cada uno con su prueba e2e; el barrido de servicio de Windows y del teléfono, 8 de 8 sin faltas. **Abiertos en lo visual:** ninguno conocido. Axe: **no hay un resumen final** en las fuentes. |
| 7   | Producción desplegada, configurada, en ceros, con `pnpm dia-cero` listo y 0 errores en Vercel      | **Se cumple**                    | Lotes 1 a 6: «READY», humo 0 fallas, 0 errores de Vercel en la hora siguiente de cada uno (el lote 6: humo 10:53, 0 fallas; Vercel revisado a las 11:55, 0 errores; lectura de producción idéntica a la de la Parte 11). Parte 11 hecha. `pnpm dia-cero` (ensayo): «nada que borrar». El lote 7 está en PR y no es parte de esta condición hasta que se despliegue.                                                                       |

### Lo que falta para un SÍ, dicho exactamente

1. **Un día de bots limpio** (condición 5): una corrida completa con el caos entero (R1 y S1r) y con los
   arreglos finales del guion y del árbitro. Es el sexto día, que corre esta noche sobre el código final;
   su informe será `b-dia-6.md`.
2. **Lo visual** (condición 6): el mapa de mesas de Configuración (39) y los bajos 40 y 41 quedaron
   arreglados en el lote 8 (por desplegar); falta un resumen final de axe de las pantallas de operación.
3. **Ajustes** (condición 3): la prueba de sonidos del portal y «Borrar todos los datos» quedaron
   demostrados en el lote 8; falta pasar a la prueba física lo que exige aparato real (impresora, cajón,
   contraseña del proveedor).
4. **Confirmar con el dueño** que «Para llevar desde la mesa» no existe (condición 2).
5. **Desplegar el lote 7** (humo, lectura y la hora de Vercel), para que lo visual cerrado hoy llegue
   a producción.

## 2 · Los números

### 2.1 · Qué se cubrió

Fuente: `docs/qa-final/MATRIZ.md` (regenerada en el lote 7 con `pnpm qa:matriz`: 0 huecos) y
`qa/qa-final/datos/`.

| Cosa                          | Cantidad                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| Pantallas (rutas)             | 34 (28 con sesión) y 108 ventanas (diálogos, confirmaciones y paneles)                                |
| Aparatos del arnés            | 14 perfiles, todos con dedo; 29 revisiones por aparato en el barrido de servicio                      |
| Ajustes                       | 96: 78 del negocio y 18 de este aparato                                                               |
| Ajustes con su efecto comprobado | 74 de los 96 (65 del negocio y 9 de este aparato); 88 de los 113 puntos de `efectos.json` si se cuentan también las 14 tarjetas comprobadas |
| Tarjetas de Configuración     | 17: 14 comprobadas, 3 por comprobar (impresora y cajón, laboratorio, reiniciar sistema)               |
| Combinaciones                 | 27 filas de pares de ajustes; 112 ternas del dinero (IVA × propina × descuento × división × pago)     |
| Cambios a media operación     | 11 casos; `cambios-a-media-operacion.integracion.test.ts` pasa 13 de 13                               |
| Flujos                        | 104 en la matriz: 0 «sin prueba», 2 «no aplica» con su razón y 102 con prueba (ver §10, punto 1)       |
| Comandos del restaurante      | 128, de los que 32 no tienen pantalla                                                                 |
| Lecturas del puente           | 26 entidades                                                                                          |
| Parte 5 por pantallas         | 62 de 62 contra el libro                                                                              |
| Huecos del mapa               | 0                                                                                                     |

### 2.2 · Hallazgos por severidad (43)

> **Lote 8 (18-11, noche):** el 39, el 40 y el 41 quedaron arreglados (por desplegar) y se halló el 44 (bajo, arreglado: el texto de «Reiniciar sistema»). Con eso: 44 encontrados, 33 arreglados, 7 descartados y 4 abiertos (11, 16, 42 y 43); medio, 20 encontrados y 18 arreglados; bajo, 16 encontrados y 11 arreglados. La tabla de abajo es la de la redacción.

| Severidad | Encontrados | Arreglados | Descartados | Abiertos |
| --------- | ----------: | ---------: | ----------: | -------: |
| Crítico   |           0 |          0 |           0 |        0 |
| Alto      |           6 |          4 |           2 |        0 |
| Medio     |          20 |         17 |           2 |        1 |
| Bajo      |          15 |          8 |           2 |        5 |
| Por ver   |           1 |          0 |           1 |        0 |
| Falta     |           1 |          0 |           0 |        1 |
| **Total** |      **43** |     **29** |       **7** |    **7** |

- **Arreglados (29):** 1, 2, 3, 4, 7, 8, 9, 10, 14, 15, 18, 19, 22 y 23 (lotes 1 a 4); 12, 24, 27, 28,
  29, 30, 31, 32, 33 y 36 (lote 5); 37 (lote 6): éstos 25, todos en producción. Y **26, 34, 35 y 38
  (lote 7, por desplegar)**: el 35 «en parte» (la hoja ofrece otra precuenta; el «—» del total se
  queda, es de rol caja y ahora la pantalla lo explica). Del 5 («Compras» cortado en una pantalla
  baja) se cerró también lo que quedaba (un degradado y una flecha avisan que hay más), pero el 5 ya
  contaba como descartado (falso positivo del arnés).
- **Descartados (7)** al reproducirlos (no eran defectos de la app): 5, 6, 13, 17, 20, 21 y 25.
- **Abiertos (7), nuevos de hoy marcados:** el 11 (bajo, anotado); el **39 (medio, nuevo): el mapa de
  mesas de Configuración no escala y corta las mesas 3 y 6 de «Interior» a 1366×768 al 125 %**;
  el **40, 41, 42 y 43 (bajos, nuevos)**: el velo de la hoja del carrito en el teléfono, el aviso que
  tapa el texto de gracias, «Importar» sin bloquear una fila repetida y dos usuarios con el mismo
  nombre; y el 16 («falta»: función grande, §12). Ninguno toca dinero ni inventario.

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
los hallazgos 35 y 34, cerrados hoy en el lote 7, y el de «Registros abre en Cortes»), 6 se construyeron (4, 9, 10, 12, 13 y 14,
que son las funciones 4, 6, 3, 7, 2 y 5), 1 no se construye por diseño (15, la nota por comensal) y 1
es grande y va a §12 (3, pasar un platillo de una cuenta a otra). El aviso de mesa sin atender (parte
de la 12) tampoco se construye: sería una regla nueva.

### 2.4 · Pruebas nuevas

- **Archivos de prueba nuevos desde `63977e1` hasta la rama** (contados con `git diff`, sólo archivos
  añadidos): **109**, de los que 81 son `.test.ts(x)` (27 de ellos de integración contra Postgres) y
  28 son `.spec.ts` (e2e, impresión y arnés). El cambio total: 507 archivos, 6 commits (uno por lote).
  **El lote 7 añade 13 archivos de prueba más** (5 `.test.ts`, dos de ellos de integración contra
  Postgres, y 8 `.spec.ts`: el arnés táctil de Configuración, los flujos sin prueba y lo visual).
- **Suite unitaria completa, lote 6:** 677 archivos y 7,285 pruebas (3 omitidas), todas en verde
  (`r-lote6.md`). En el lote 5: 674 archivos y 7,274 pruebas; integración (venta, registros, caja,
  inventario, restaurante, portal): 121 archivos y 680 pruebas (`r-lote5.md`).
- **Mutantes:** cada arreglo y cada función nueva lleva su mutante; los agentes de entrega de los
  lotes 5 y 6 corrieron mutantes propios sobre lo ajeno y tres sobrevivieron al principio (§3). En el
  lote 7 el agente de entrega corrió dos sobre lo visual (R1 y R2): **los dos sobrevivían** porque la
  prueba de contrato sólo buscaba texto; se reforzó y ahora mueren. El agente de los flujos
  (T) corrió mutantes sobre sus pruebas de integración y el generador: todos murieron. El de
  Configuración (C) **no hizo mutantes** de sus pruebas nuevas (§4).
- **Suite unitaria completa, lote 7:** 680 archivos y 7,307 pruebas (3 omitidas), todas en verde; la
  integración de las zonas del lote (inventario, portal, restaurante, compras) en verde; tipos, lint y
  las puertas `verify:` en 0.
- **El arnés se prueba contra sí mismo:** 45 de 45 en tres perfiles y tres mutantes del arnés
  tumban su autoprueba.
- **No tengo la cuenta total de «pruebas» (casos) nuevas** por lote; sólo la de archivos y las
  cifras de las suites de arriba.

### 2.5 · Los días de bots y sus semillas

Día de 8:00 a 19:00, ×4, con árbitro cada hora, sobre `b1d630d` más los arreglos que se le sumaron
(DP-D175, DP-D182, DP-D183); los días 2214 y 2215 sobre el código del lote 6 (`957f143` en la rama
local de pruebas, el mismo contenido que `ca7e6f1`) y, el 2215, con tres arreglos del guion y del
árbitro. Informes: `b-dia.md` (los tres primeros) y `b-dia-4.md` (el 2214 y el 2215). Entre medias hubo
dos arranques cortados a propósito (2212 a las 10:30 y a las 9:30) para arreglar y recompilar; no
cuentan. **Son cinco días corridos, 2211 a 2215.**

| Semilla | Duración | Cobros                    | Importe    | Árbitro                                                                                                                                                  | Incidentes                                                         |
| ------- | -------: | ------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 2211    |  188 min | 171 (50 mesa, 121 llevar) | $64,878.10 | 0 diferencias en 11 horas y cierre (1,533 comparaciones), 0 5xx, 0 consola                                                                               | 289 (2 «críticos» de dinero, del guion)                            |
| 2212    |  169 min | 154 (62 mesa)             | $84,528.20 | 0 en el cierre; 2 «críticos» a las 14:00 (guion del árbitro)                                                                                             | 139                                                                |
| 2213    |  168 min | 174 (68 mesa, 106 llevar) | $69,641.50 | 0 diferencias en las 11 horas y el cierre (1,562 comparaciones), 0 5xx, 0 consola sin explicar                                                          | 76: 0 críticos, 0 altos, 0 «dinero»                                |
| 2214    |  188 min | 177 (65 mesa, 112 llevar) | $63,425.44 | 0 diferencias de 9:00 a 17:00; 1 «crítica» a las 18:00, a las 19:00 y en la última revisión (error del árbitro); el cierre final: 0 de 1,640. 0 5xx, 0 consola | 1 crítico (del árbitro), 0 altos, 24 medios                        |
| 2215    |  168 min | 163 (57 mesa, 106 llevar) | $67,947.72 | 0 diferencias en las 11 horas y en el cierre (1,523 comparaciones); 0 5xx; 0 consola sin explicar                                                        | 0 críticos, 0 altos, 17 medios                                     |

- **Movimiento del día 2213:** 44 mesas, 13 pedidas por el portal (32 pedidos), 10 unidas, 27 cambios de
  mesa, 8 divididas, 17 cancelaciones, 3 cortes; 11,036 toques, 0 clics.
- **Movimiento del día 2214:** 40 mesas, 18 por portal, 8 unidas, 29 cambios de mesa, 5 divididas, 11
  canceladas; 11,917 toques, 0 clics de ratón. **Del 2215:** 18 por portal (37 pedidos), 6 unidas, 23
  cambios de mesa, 3 divididas, 13 canceladas; 11,025 toques, 0 clics de ratón.
- **Caos.** En el 2213 se ejecutaron todos menos R1 (traslado de la Caja 2). En el **2214 corrieron los
  30 eventos, R1 incluido** (el traslado de la Caja 2 a las 15:00). En el **2215, 29 de 30: falló
  S1r** (devolver las mesas 3 y 14 a su lugar: la 14 vive en la Terraza y el guion contaba la mesa
  antes de que React la pintara; arreglado en el guion, **sin verificar en un día**).
- **Lo que el árbitro y los bots enseñaron:** un defecto de la app (hallazgo 37: «Cambiar de mesa» no
  se ofrecía en el teléfono del mesero; arreglado, DP-D182); del guion, muchos (selectores del
  teléfono, «Marcar entregado», la pregunta «¿Separar mesas o dejarlas unidas?» sin contestar, tres
  «críticos» de dinero que eran del guion); del árbitro dos (al dividir una cuenta la pieza nueva
  entra a la misma comanda con otra hora y el corte por fila contaba una menos: ahora corta por la
  hora de la comanda, DP-D183; y, en el 2214, una línea de 3 «Shots» cobrada en 3 partes que la división
  parte en 3 filas, dos nacidas a las 17:52 contra la comanda de las 17:40: el árbitro contaba filas y
  daba 8 contra 6 mientras el dinero cuadraba; ahora cuenta por porción, **sin relajar el oráculo**).
- **Del 2214, los demás:** el diálogo «Mesa 8 · cuenta 2 de 2» no lo halló la Caja por la guarda del
  rótulo (guion): la cuenta 2 ($2,007) quedó sin cobrar todo el día y de ahí salieron las alertas de
  cerrar caja con mesas pendientes y el Cierre del día. Arreglado en el guion. Los medios del portal,
  de «Atender Pide la cuenta» y del modo espera sobre «Para llevar» son de guion o de carga; no se
  demostró uno por uno. «Registrar compra» del almacén (D22-012 y D22-014) lo anota el informe como de la app, medio y ya conocido (hallazgo 28, que el lote 5 arregló); el informe no aclara si ese arreglo lo cubre por completo y queda sin aclarar.
- **Dos juicios del 2214.** *Modo espera con un cobro abierto:* en ningún día se perdió un cobro ni lo
  tecleado; por diseño es una capa encima de un puesto que sigue montado (DP-D39): diseño, no defecto;
  **no se probó a propósito con un cobro a medio teclear.** *Lentitud* (merma, retiro, compra y cierre
  de caja, de 3 a 11 s): **no se pudo sacar del registro del servidor** (no trae duración por petición);
  el indicio es que se mide el bot, sin demostrar.
- **Veredicto del árbitro, honesto:** ¿hay un día limpio? **No, estrictamente.** Cada día de los cinco
  cuadró en el cierre, pero ninguno reunió a la vez: cierre en cero, 0 diferencias por hora, 0 críticos,
  0 altos, 0 5xx, 0 consola y **todo** el caos. Un sexto día, sobre el código final, corre esta noche.

### 2.6 · Los lotes y la producción

| Lote | PR   | En `main`  | Cuándo (CDMX)  | Migración | CI                                | Humo sin cobrar            | Vercel, hora siguiente             |
| ---- | ---- | ---------- | -------------- | --------- | --------------------------------- | -------------------------- | ---------------------------------- |
| 1    | #37  | `ff03687`  | 17-11, 05:59   | ninguna   | 10 de 10 (2ª corrida)             | 38 revisiones, 0 fallas    | 0 errores (revisado 07:12)         |
| 2    | #38  | `829b13d`  | 17-11, 07:53   | ninguna   | 10 de 10 (3ª corrida, `9965fb8`)  | 38 revisiones, 0 fallas    | 0 errores (revisado 09:00)         |
| 3    | #39  | `e4c45f5`  | 17-11, 15:03   | 194       | 10 de 10 (2ª corrida, `6931ff1`)  | 27 de 27 y rutas nuevas, 0 fallas | 0 errores (revisado 16:06)  |
| 4    | #40  | `6b76050`  | 17-11, 20:37   | 195       | 10 de 10 (5ª corrida, `1023576`)  | 27 de 27, 0 fallas         | 0 errores (revisado 21:43)         |
| 5    | #41  | `e4e0a70`  | 17-11, 23:45   | ninguna   | 10 de 10 (`0f107d1`)              | 0 fallas                   | 0 errores (revisado 00:50, 18-11)  |
| 6    | #42  | `ca7e6f1`  | 18-11, 10:48   | ninguna   | 10 de 10 (`3a102d4`)              | 10:53, 0 fallas            | 0 errores (revisado 11:55)         |
| 7    | #43  | por unir   | por desplegar  | ninguna   | 10 de 10 (`54f1bc8`)             | por hacer                  | por hacer                          |

- Migraciones en producción: hasta la **195** (127 aplicadas). Las dos de esta auditoría (194 y 195)
  son aditivas y se ensayaron antes (aplicar y revertir) con el código anterior aún desplegado.
- **Producción hoy** (`produccion-final.txt`, 17-11 23:58): 0 cuentas, 0 cajas, 0 comandas, 0 carritos, 0
  pagos, 10 mesas libres, siguiente folio «DP-01001» (cuentas 1001, cortes 101), 35 aparatos sin
  ningún «Caja N», «Almacén principal», IVA «Sin IVA», prefijo «DP», dos cajas («Caja 1» y «Caja
  2»), «silenciar notificaciones del administrador» encendido. La lectura posterior al lote 6 se
  comparó con esa: **idéntica**.
- **El lote 7 (el último)** no toca dinero, inventario ni migraciones (`git diff` de `migraciones/sql`
  vacío): lo visual del mesero y de la Caja, las pruebas de Configuración y de los flujos, el simulador
  y los documentos. **Por desplegar** hasta que el director lo una.
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
8. **Los mutantes del lote 7 que sobrevivían.** Dos mutantes del agente de entrega sobre lo visual del
   mesero (la hoja de la precuenta ofrecida con la cuenta aún sin pedir; el oyente de «soltar el foco»
   convertido en un no hacer nada) **pasaban** la prueba de contrato, que sólo busca texto. Se reforzó
   la prueba y ahora mueren (son los de los lotes 5 y 6, por tercera vez: una prueba que busca el
   nombre de algo no prueba que haga lo que dice). Las pruebas e2e de V sí los habrían tumbado, pero
   no se corrieron con ellos (haría falta otra compilación).
9. **El generador de la matriz no tenía el estado «no aplica»** (informe del agente T): dos flujos
   inexistentes en la app aparecían como huecos sin salida. Se añadió con su razón obligatoria y sus
   pruebas (DP-D194). Y el agente de Configuración cambió dos líneas por eslint (un BOM en
   `tarjetas-datos.spec.ts` y `parseFloat` por `Number` en `tarjetas-personas.spec.ts`) **después de su
   última corrida verde** sin volver a correrlas: ver §4.

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

**Lo que tampoco se pudo verificar del lote 7** (dicho sin adornos):

- **Configuración (agente C).** Cambió dos líneas por eslint **después de su última corrida verde**
  (`pruebas/e2e/qa-final/ajustes-finales/tarjetas-datos.spec.ts` y `tarjetas-personas.spec.ts`) y no
  volvió a correr esas pruebas. **No hizo mutantes de sus pruebas nuevas** (DP-D163 los pide). Su
  prueba `reiniciar.spec.ts` está **en rojo**: «Borrar todos los datos» no quedó demostrado (no se vio
  el borrado ni rastro de `reiniciar_todo` en la auditoría; causa sin investigar, puede ser el guion).
  La de sonidos del portal está escrita y **no corrida**. La marca de agua del fondo en el portal no
  se probó. El selector de archivos del sistema operativo no se abrió con el toque: se entrega el
  archivo al campo. Impresora, cajón, papel y contraseña del proveedor: lista física.
- **Lo visual (agente V).** **No tiene capturas «antes»**: la compilación de referencia falló por red
  (Google Fonts) tras 30 minutos. La evidencia previa es el contrato en rojo (6 de 7) y la medición del
  barrido para el 26. Sus mutantes son de contrato, no de e2e. El aspecto en un aparato real no se vio.
- **Los flujos (agentes M y T).** M no corrió nada: enlazó leyendo. T no probó la cortesía con el dedo,
  ni nada en el iMin ni en Windows; sus e2e sólo en teléfono y tableta; la integración de la cortesía
  no cubre la hoja impresa. «Para llevar desde la mesa» como «no aplica» no lo confirmó el dueño.
- **El simulador (agente B4).** El arreglo del guion de S1r y el del rótulo de la cuenta dividida **no
  se verificaron en un día completo**; la duración por petición del servidor no se pudo sacar.
- **Mapa de mesas de Configuración** (hallazgo 39): visto con una captura, sin arreglar.

## 5 · Lo abierto

### 5.1 · Hallazgos abiertos

> **Lote 8 (18-11, noche):** el 39, el 40 y el 41 de esta tabla ya están arreglados (por desplegar); quedan abiertos el 11, el 16, el 42 y el 43.

| #   | Sev.  | Qué                                                                                                                                                  | Por qué no se cambió                                                                                                                                  |
| --- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | bajo  | El servidor acepta una propina al cobrar aunque nadie pueda elegirla en Configuración                                                                | Endurecer el cobro arriesga romper un cobro legítimo (la propina puede venir fijada por el comensal o el mesero). A la lista de después.             |
| 39  | medio | **Nuevo.** Configuración → Salón → Mapa de mesas, Windows 1366×768 al 125 %: el lienzo no escala (unos 470 px de CSS) y corta las mesas 3 y 6 de «Interior» (`MesaMapEditor.jsx`) | Lo halló el agente C en la víspera: tiene captura y causa (lienzo fijo con `overflow-hidden`); no se arregló hoy. Es lo que más pesa en la condición 6. |
| 40  | bajo  | **Nuevo.** Pedido del mesero, teléfono: al quitar el último renglón del carrito la hoja no se cierra sola y el velo tapa los platillos               | Lo halló el agente T; no toca dinero. Sin arreglar.                                                                                                   |
| 41  | bajo  | **Nuevo.** Portal, teléfono 360×800: al calificar la visita el aviso «Solicitud enviada» tapa el texto de gracias (el texto existe)                  | Lo halló el agente T; sin arreglar.                                                                                                                   |
| 42  | bajo  | **Nuevo.** Configuración → «Importar»: no bloquea un archivo con una fila repetida; la marca como error y confirma sólo lo bueno                     | Lo halló el agente C; comportamiento aceptable, anotado. Sin arreglar.                                                                                |
| 43  | bajo  | **Nuevo.** Configuración → Usuarios POS: se pueden crear dos usuarios con el mismo nombre (aparecieron 4 «Rubén Ochoa»)                              | Lo halló el agente C; sin arreglar.                                                                                                                   |
| 16  | falta | No hay pantalla para darle receta a las OPCIONES de un platillo                                                                                      | Es una función grande (§12). Mientras tanto una opción no cambia el inventario: baja la receta base.                                                  |

Los que se cerraron hoy, en el lote 7 (**por desplegar**): 26, 34, 35 (en parte) y 38, y el resto del 5 (§2.2).

### 5.2 · El día de bots sin un día LIMPIO estricto

Ver §2.5 y la condición 5. Los cinco días cuadraron en el cierre, pero ninguno reunió todo a la vez:
el 2214 ejecutó los 30 eventos del caos pero el árbitro dio una diferencia por hora (error suyo,
arreglado) y una cuenta quedó sin cobrar por el guion (arreglado); el 2215 cuadró en todo pero ejecutó
29 de 30 eventos (S1r, del guion, arreglado sin verificar). Quedaron **sin arreglar y anotados:** el
modo espera durante el cobro (por diseño; no se probó con un cobro a medio teclear); la lentitud de los
formularios (merma, retiro, compra y cierre de caja, de 3 a 11 s, sin causa demostrada: el servidor
no guarda la duración por petición); y la sesión de la Caja de 12 h fijas (por diseño). El hallazgo 38
ya no está en esta lista: lo cierra el lote 7.

### 5.3 · Los ajustes de Configuración sin comprobar en el navegador

> **Lote 8 (18-11, noche):** `sonidos_en_el_portal` y «Reiniciar sistema para cliente» quedaron demostrados (90 comprobados, 0 por ver en navegador, 2 por comprobar: impresora y cajón, laboratorio). Lo de abajo es lo de la redacción.

Fuente: `qa/qa-final/datos/efectos.json` (113 puntos: 78 ajustes del negocio, 17 tarjetas y 18 de este
aparato) y `MATRIZ.md`. Hoy: **88 comprobados, 1 por ver en navegador, 3 por comprobar**, 12 sin
propósito o fuera de la operación y 9 que son memoria del aparato. De los 78 ajustes del negocio:

- **65 comprobados** (hoy se sumaron `background_fit`, `background_image_url`, `background_logo_url`,
  `background_opacity`, `logo_url` y `portal_qr_cuenta_modo`, con el arnés táctil; del
  `background_logo_url` falta la marca de agua del portal, no probada).
- **1 «por ver en navegador»:** `experiencia.sonidos_en_el_portal` (la prueba está escrita y no se
  corrió).
- **12 sin comprobar a propósito:** 10 «sin propósito en un restaurante» y escondidos (`bascula_etiqueta`,
  `color_secundario`, `formato_export_default`, `modo_presentacion_activo`, `moneda`,
  `presentacion_ultimo_acceso`, `simbolo_moneda`, `usa_barra`, `usa_cocina`, `usa_mesas`), `paquete_modo`
  («no se cambia en la operación», sólo por comando de plataforma) y `permitir_venta_sin_stock`
  («escondido en Avanzado», nadie lo lee hoy: manda la opción de cada producto).

De las 17 tarjetas que no guardan una clave, **14 comprobadas** (hoy: Mapa de mesas, Proveedores, Usuarios
POS, Exportar datos actuales e Importar datos desde archivo) y **3 «por comprobar»:**

- **Impresora de este aparato** y **Laboratorio del proveedor:** lo de pantalla pasa (sin app, con app
  sin perfil, contraseña mala y buena, perfil guardado, «Impresora lista», página de prueba a la app
  falsa), pero el pulso del cajón, el papel real, la impresora del local y la contraseña real del
  proveedor **van a la lista física** (§8).
- **Reiniciar sistema para cliente:** «Borrar solo ventas y pruebas» funcionó (nombre malo no borra; con
  el bueno se van las cuentas; productos, mesas, gente y configuración se quedan; el otro negocio no se
  toca); **«Borrar todos los datos» no quedó demostrado** (la prueba falló; causa sin investigar).

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
- **Configuración:** 88 de los 113 puntos con su prueba (los 77 de antes, cada uno visto fallar al
  romper su lector, DP-D163; los 11 de hoy con el arnés táctil, **sin mutantes**: §4).
- **Flujos:** 102 con prueba y 2 «no aplica»; hoy se escribieron las de las cantidades del carrito (con
  el dedo, en teléfono y tableta), la calificación de la visita (integración y e2e) y la cortesía de la
  casa (integración, con la clave de gerencia y el corte).

## 7 · Calificación del POS en la nube

**PROPUESTA: 89 / 100** (en DP-21: 86; la propuesta anterior de este informe, 87). Es un juicio, no un
cálculo; el desglose sirve para discutirlo. El director la confirma o la cambia. Sube dos puntos por la
matriz y los ajustes; el veredicto «NO todavía» no cambia con ella.

| Eje                                     | Puntos | De  | Por qué                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | -----: | --: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dinero e inventario                     |     29 |  30 | Cuatro hallazgos de dinero encontrados y arreglados con prueba y mutante; 0 diferencias en el cierre de los cinco días de bots. Resta un punto: lo cobrado antes del lote 5 por kilo o porción queda con costo cero.                                                                       |
| Pruebas, mapa y ajustes                 |     18 |  20 | Arnés propio que se prueba a sí mismo, 122 archivos de prueba nuevos, la CI en 10 de 10 en cada lote, **0 flujos sin prueba** (eran 52), 88 de 113 puntos de Configuración comprobados. Resta: 3 tarjetas y 1 ajuste sin comprobar, enlaces débiles en la matriz, pruebas de C sin mutantes y una en rojo, y los fallos que sólo la CI o la sesión cazaron (§3). |
| Operación simulada (días de bots)       |     16 |  20 | Cinco días con el árbitro en cero diferencias en el cierre; el 2214 con todo el caos y el 2215 con 0 críticos ni altos. Resta: ningún día reúne todo a la vez, S1r sin verificar, formularios lentos sin explicar. El sexto día, esta noche, es lo que la subiría.                       |
| Producción lista                        |     14 |  15 | Seis lotes en verde, humo en cero fallas, 0 errores de Vercel, producción en ceros y `pnpm dia-cero` listo. Resta un punto: H1 sin activar a propósito y el lote 7 aún sin desplegar.                                                                                                      |
| Lo visto en aparatos reales y lo visual |     12 |  15 | Nada se ha visto en un iMin, una tableta o un teléfono reales; 1 medio (el mapa de mesas cortado) y 4 bajos nuevos abiertos; sin resumen final de axe; lo visual de hoy sin capturas «antes». Lo que lo subiría es la prueba de esta noche.                                               |
| **Total**                               | **89** | **100** |                                                                                                                                                                                                                                                                                          |

- **Qué la subiría a 90 o más:** que la prueba física de esta noche salga sin hallazgos graves; el sexto
  día de bots limpio; el mapa de mesas arreglado (39); las 3 tarjetas y el ajuste que faltan comprobados;
  y un resumen final de axe.
- **Qué la bajaría:** que en la prueba física falle algo de lo de §4 (impresión, cajón, PDF en la
  app, Wi-Fi) o que el sexto día de bots deje un incidente de dinero o de inventario.

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

### 8.3 · Lo que Configuración y lo visual dejaron para el aparato real (lote 7)

| #   | Qué hacer                                                                                                                      | Qué debe ver                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Configuración → «Impresora de este aparato»: probar el cajón (pulso, «¿se abrió?») y quitar el cajón                            | El cajón de verdad salta; «¿se abrió?» se contesta; al quitarlo, «No tiene cajón». (En el arnés sólo se probó lo de pantalla contra una app falsa.)                                          |
| 2   | La misma tarjeta: imprimir la página de prueba en la impresora del local, con papel real                                       | Sale en el papel y a 58 u 80 mm según el aparato.                                                                                                                                              |
| 3   | «Laboratorio del proveedor»: entrar con la contraseña real (la tecleas tú)                                                      | Entra con la buena y se vacía el campo con la mala. (En el arnés se usó un hash de usar y tirar.)                                                                                              |
| 4   | Configuración → Salón → Mapa de mesas, en la PC de Windows (1366×768 al 125 %)                                                  | **Hallazgo 39 abierto:** probablemente se vean cortadas las mesas 3 y 6 de «Interior». Anota si ves lo mismo y cuántas mesas pierdes.                                                          |
| 5   | El sonido del portal (`sonidos_en_el_portal`) en un teléfono real                                                               | Con el ajuste encendido el portal del comensal suena al tocar; apagado, no. (La prueba está escrita y no se corrió.)                                                                            |
| 6   | **No** probar «Reiniciar sistema para cliente → Borrar todos los datos» en producción                                           | Sólo se probó «Borrar solo ventas y pruebas» en una base desechable; «todos los datos» no quedó demostrado. Si se quiere probar, que sea en una copia.                                         |
| 7   | Sólo si el director une el lote 7 antes de la prueba: Caja → Movimientos; el menú lateral en la PC baja; la hoja del mesero con la cuenta pedida | «Entregar el turno» y «Retirar» a la misma altura; una flecha al pie del menú mientras haya más por desplazar; en el teléfono la barra dice «Cuenta pedida» y trae «Imprimir otra hoja de la precuenta» y «Cambiar de mesa»; con el teclado abierto la barra se esconde. |

Lo que veas distinto, con la hora y una foto.

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

1. **Los flujos de la matriz.** Hoy: 104 flujos, 0 «sin prueba» (eran 52), 2 «no aplica» con su razón.
   El agente M enlazó 47 y declaró estos enlaces **menos fuertes**, que se aceptaron pero no son una
   prueba propia: «Salir con la barra plegada» (un contrato sobre el texto del código más un bot; ningún
   e2e toca «Salir» así); «Quitar antes de enviar» (sólo el portal en modo mesero, no el «−» del carrito
   propio; hoy T lo cubre con la prueba de cantidades); «Sesión vencida» (no a media operación, por
   ejemplo con un cobro abierto); «Cambiar de persona» (un paso dentro de otra prueba); «Recetas» (la
   parte de asignar a las opciones no está construida, DP-D169); y los guiones por pantallas
   (parte 5, día 0, bots), que demuestran que el procedimiento existe y que compara contra el libro,
   no que haya pasado hoy. M no corrió nada. **Y «Para llevar desde la mesa» está declarado «no
   aplica» sin que el dueño lo haya confirmado.** Además, «con prueba» no es «corrida hoy»: la matriz
   los llama «por recorrer con el arnés».
2. **Números de ajustes comprobados.** La matriz resume «74 con su efecto comprobado» (65 del negocio y
   9 de este aparato) y `efectos.json` dice «88 comprobados» (ahí entran también las 14 tarjetas
   comprobadas). Uso ambos y digo qué cuenta cada uno.
3. **Texto viejo en `HALLAZGOS.md`.** Se puso al día en el lote 7 (12 y 37 en producción; 26, 34, 35,
   38 «lote 7, por desplegar»; hallazgos 39 a 43 nuevos).
4. **Número de comandos.** La bitácora de arranque dice 124 y `ESTADO.md` dice 126; la matriz
   regenerada dice 128. Uso el de la matriz (el más reciente).
5. **Sexto día de bots** (`b-dia-6.md`): corre esta noche; no existe al redactar. Un día limpio
   resolvería la condición 5, no la 3 ni la 6 (§1).
6. **Lote 6 (cerrado):** humo 0 fallas (10:53), lectura de producción idéntica y Vercel sin errores
   a las 11:55 (`hechos-lote5-y-parte11.md`). Antes de hoy esto no constaba.
7. **Comprobaciones del lote 5 con «0» por un error del guion:** lo tomo del encargo; no encontré el
   detalle en los archivos.
8. **Resumen final de axe** y de «desbordes, recortes y encimados» de todas las pantallas de operación:
   no existe en las fuentes; sólo el barrido de servicio (DP-D154), los hallazgos anotados y el
   barrido de V (8 de 8 pruebas en cuatro aparatos).
9. **Número total de pruebas nuevas (casos):** sólo archivos (122) y las cifras de las suites.
10. **Dos informes con cifras que no cuadran del todo:** V dice 13 pruebas de contrato y la suite trae
    12; no afecta lo demás.
11. **Huecos en los números de decisión** (184, 185, 189, 191 a 193): no se usaron; no se encontró
    quién los reservó.

## 11 · Fuentes

`docs/qa-final/HALLAZGOS.md`, `NUEVO.md`, `ESTADO.md`, `PLAN.md`, `MATRIZ.md`;
`qa/qa-final/datos/efectos.json`, `flujos.json` y `combinaciones/`; `docs/PROGRESO-DP22.md`;
`DECISIONES.md` (DP-D146 a DP-D194); `docs/RUNBOOK.md` §8; `docs/reports/012-cierre-antes-de-instalar.md`
(estilo y calificación anterior); y, fuera del repo, `D:\mpos-tmp\dp22\encargo.md` (Parte 12),
`ORQUESTA.md` y `informes\` (`hechos-lote5-y-parte11.md`, `r-lote5.md`, `r-lote6.md`, `i-informe.md`,
`b-dia.md`, `b-dia-4.md`, `v-visual.md`, `c-ajustes.md`, `t-flujos.md`, `m-matriz.md`). Los archivos de
prueba nuevos se contaron con `git diff --name-status 63977e1..HEAD` (109 hasta el lote 6, más 13 del
lote 7).

## 12 · Lo grande que queda para después (con su tamaño)

Nada de esto se toca antes de abrir. Tamaños de `NUEVO.md`.

| Qué                                                                                                                       | Por qué no entra                                                                                                                                                                                                                  | Tamaño          |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| La receta de las OPCIONES de un platillo (hallazgo 16): que «con doble carne» o «sin queso» cambien lo que baja del inventario | El dominio, la base y el cobro ya lo soportan; faltan el editor de opciones y el de la receta y el contrato de dos comandos. Diseño en DP-D169. Mientras tanto, una opción no cambia el inventario: baja la receta base del platillo. | 1.5 a 2 días    |
| El descuento por renglón (hoy es a la cuenta entera) y las partes de una cuenta dividida en dinero igual                    | Cambia reglas de dinero (prorrateo, impuestos por renglón, el papel).                                                                                                                                                              | 2 a 3 días      |
| Pasar un platillo de una cuenta a otra (entre dos mesas)                                                                  | Hay que mover el renglón y su plato de cocina, recalcular totales, propina y descuento de las dos, re-sincronizar las dos mesas y tomar los candados en orden: toca cocina, dinero y comandas.                                      | 3 a 4 días      |

De lo menor que queda: el hallazgo 11 (que el servidor no acepte propina si nadie puede elegirla), el
mapa de mesas de Configuración (39, medio) y los bajos 40, 41, 42 y 43, la lentitud de los formularios
sin explicar, el modo espera durante el cobro, el aviso de mesa sin atender (sería una regla nueva), y
las 3 tarjetas y el ajuste por comprobar (§5.3).
