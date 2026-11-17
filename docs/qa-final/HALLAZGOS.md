# HALLAZGOS · DP-22 · La auditoría final

> Cada hallazgo se anota al momento. **Severidad:** crítico (dinero, datos, seguridad o algo que
> detiene la operación) · alto (un flujo roto que tiene salida) · medio (visual o confuso) · bajo
> (cosmético). Lo crítico se arregla de inmediato; lo demás, en lotes de 2 o 3. Un hallazgo se
> cierra sólo con evidencia: la prueba que falló antes y pasa después, su nombre y el commit.
>
> **Ataques** (lo que pasó cada arreglo antes de darse por bueno): U unitaria · I integración contra
> Postgres · E e2e táctil en los aparatos · M mutante · O orillas (0, negativos, decimales, enormes,
> acentos, emojis, textos largos) · T toque doble y repetido · C carreras (dos aparatos, recargar) ·
> R red (sin red, lenta) · S sesión vencida · P permisos por puesto · V motor viejo del iMin ·
> G regresión de la zona.

## Resumen

| Severidad | Encontrados | Arreglados | Abiertos |
| --------- | ----------: | ---------: | -------: |
| Crítico   |           0 |          0 |        0 |
| Alto      |           4 |          2 |        2 |
| Medio     |           8 |          4 |        4 |
| Bajo      |           3 |          0 |        3 |
| Por ver   |           1 |          0 |        1 |
| Falta     |           1 |          0 |        1 |

(Los hallazgos 8, 9 y 10 están arreglados y en producción desde el lote 2, 17-11 07:55. Los altos
abiertos son el 13 y el 14, los dos de inventario y recetas, que producción todavía no usa.)

## Lista

| #   | Sev.    | Pantalla · aparato                                               | Qué pasa                                                                                                                                                                                            | Estado                                               |
| --- | ------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | alto    | Compras y gastos, Inventario, exportaciones · todos los aparatos | Después de las 18:00 «hoy» era mañana: «Registrar gasto» y «Registrar compra» proponían la fecha del día siguiente y un gasto en efectivo quedaba rechazado                                         | arreglado (lote 1); falta su e2e táctil con el arnés |
| 2   | medio   | Caja · todos                                                     | Un botón (`button.py-2`) sin nombre accesible: un lector de pantalla dice «botón» y nada más (axe: crítico)                                                                                         | abierto (agente A, lote 2)                           |
| 3   | medio   | Barra de la cuenta sobre el color primario · todos               | Texto de 12 px a 60 % de opacidad sobre el café primario: contraste 3 a 1 (#ccc0ad sobre #83653f); se pide 4.5 a 1                                                                                  | abierto (agente A, lote 2)                           |
| 4   | medio   | Barra lateral, Caja y salón del mesero · táctiles                | Tocables por debajo de 44 px: los enlaces de la barra lateral (121×40), «Activar modo oscuro», «Sonido», «Salir», las pestañas de Caja y las fichas de zona del mesero (se arreglan por componente) | abierto (agente A, lote 2)                           |
| 5   | medio   | Barra lateral · 1280×800 y 1366×768 a 125 % (1093×614)           | «Compras» queda encimado con «Activar modo oscuro»: en una pantalla baja el dedo puede caer en el botón equivocado                                                                                  | abierto (agente A, lote 2)                           |
| 6   | por ver | Caja cerrada · todos                                             | «Abrir caja» aparece con `pointer-events: none`: falta saber si es un deshabilitado legítimo con su motivo a la vista o un botón muerto                                                             | por confirmar (agente A)                             |
| 7   | medio   | Cocina y salón · todos                                           | Con un plato ya «listo», quitar el otro platillo de la comanda la deja en «nuevo»: la mesa no pasa a «Esperando entrega» y el mesero no recibe el aviso hasta que cocina la vuelve a tocar          | arreglado (lote 3, por desplegar)                    |
| 8   | alto    | Caja · cobro de una cuenta dividida                              | Si se cambia el IVA después de dividir una cuenta, cobrar una de sus partes da «Algo falló» y esa parte ya no se puede cobrar                                                                       | arreglado · en producción (lote 2, `829b13d`)        |
| 9   | medio   | Propina en la Caja y en el portal                                | La propina por porcentaje salía un centavo abajo en los medios centavos ($28,771.50 al 15 % daba $4,315.72 y el servidor $4,315.73)                                                                 | arreglado · en producción (lote 2, `829b13d`)        |
| 10  | medio   | Personas y seguridad                                             | Cambiarle el PIN a alguien no cierra la sesión que tenga abierta: sigue dentro hasta que venza (12 h)                                                                                               | arreglado · en producción (lote 2, `829b13d`)        |
| 11  | bajo    | Caja · cobro                                                     | El servidor acepta una propina al cobrar aunque en Configuración nadie pueda elegirla; la pantalla la esconde, el servidor no la exige                                                              | anotado: no se cambia antes de abrir (ver detalle)   |
| 12  | bajo    | Caja · cobro                                                     | Cuando el total cambió desde la precuenta, el aviso dice «El total cambió…»: el servidor sí manda el total nuevo, falta ver si la Caja vuelve a leer la cuenta o se queda con el total viejo        | abierto: por ver en el navegador                     |
| 13  | alto    | Recetas → Nueva receta · tableta 1024×768 con el dedo            | No se puede elegir el «Tipo de venta» («Variable por medida») al crear un platillo: el toque cae fuera de la pantalla. Con ratón sí se puede                                                        | abierto: causa sin confirmar                         |
| 14  | alto    | Inventario, recetas y márgenes · todos                           | El costo por gramo o mililitro se guarda en centavos enteros: leche a 2.4 ¢/ml queda en 2 ¢ (−16.7 %) y maíz a 4.5 ¢/g en 5 ¢ (+11 %); con $11,570.50 comprados, «Valor de inventario» dice $11,552 | abierto: se arregla (agente D3)                      |
| 15  | medio   | Inventario · aviso de mínimos                                    | La regla de «por debajo del mínimo» reventaba con una existencia en negativo, que DP-D116 hace legal                                                                                                | arreglado (lote 3, por desplegar)                    |
| 16  | falta   | Recetas                                                          | No hay pantalla para darle receta a las OPCIONES de un platillo (el dominio y la base sí lo soportan: sustituir y escalar)                                                                          | abierto: por medir                                   |
| 17  | bajo    | Configuración → Este aparato · tableta                           | El interruptor «Modo espera en este aparato» no trae nombre accesible                                                                                                                               | abierto                                              |

## Detalle

_(Cada hallazgo: pasos para reproducirlo, causa con `archivo:línea`, captura, el arreglo, la prueba,
los ataques que pasó y el commit.)_

### 1 · alto · Después de las 18:00, «hoy» era mañana

- **Cómo se encontró:** la línea base de `verify` sobre `main` corrió de noche (16-11, 22:40) y
  `packages/app/src/tablero/serie.integracion.test.ts` falló 2 de 6: el gasto «de hoy» no caía en
  la cubeta de hoy. De día pasa; por eso la CI nunca lo vio.
- **Pasos:** a partir de las 18:00 (hora de México) abrir Compras y gastos → «Registrar gasto». La
  fecha que propone es la de mañana. Con «Efectivo» y la caja abierta hoy, al guardar el servidor
  contesta «Un gasto en efectivo sale del cajón de la caja abierta, que es la del 16, así que no se
  puede fechar el 17…». Con tarjeta o transferencia se guarda fechado mañana, sin aviso: el tablero
  y Registros de hoy no lo cuentan y los de mañana sí. Lo mismo en «Registrar compra» y en los
  gastos fijos. El restaurante cierra a las 19:00: pasaba todos los días, en la última hora.
- **Causa:** las pantallas sacaban el día de `new Date().toISOString().slice(0, 10)`, que es UTC
  (`heredado/components/compras/RegistrarGastoDialog.jsx:50`, `RegistrarCompraDialog.jsx:52` y
  `:110`, `PlantillasGastoSection.jsx:105`, `pages/CorteCaja.jsx:46`, `pages/Inventario.jsx:147`
  —el «consumo de hoy» se quedaba en cero—, los nombres de los archivos exportados y
  `utils/importValidators.js:546`). Y en el servidor, un gasto o una compra SIN fecha tomaba el
  valor por omisión de la columna (`current_date`, el día de la base: UTC)
  (`packages/app/src/compras/gastos.ts`, `compras.ts`).
- **Arreglo:** un solo ayudante, `apps/web/src/cliente/dia-del-negocio.ts` (`hoyDelNegocio`: el día
  en la zona del negocio, no en UTC ni en la del aparato), usado en las once pantallas; y en el
  servidor, sin fecha vale el día del negocio (`reportes/dia.ts`, la zona de la organización).
- **Pruebas (rojo antes, verde después):** `apps/web/src/cliente/dia-del-negocio.test.ts` (11
  casos: el día a las 18:30, a las 23:59 y a las 00:00, y el contrato «ninguna pantalla saca hoy
  de `toISOString()`», que en rojo listó los 11 archivos);
  `packages/app/src/compras/fecha-del-negocio.integracion.test.ts` (contra Postgres, con el reloj
  fijo a las 18:30: el gasto y la compra salían fechados `2026-11-17`, el día UTC);
  `tablero/serie.integracion.test.ts` vuelve a pasar de noche.
- **Ataques:** U ✓ · I ✓ (15 de 15 en `compras` y `tablero`) · M ✓ (5 destructivas fallan: el gasto
  y la compra con el día en UTC, las dos pantallas con el patrón viejo —también con `split`—, y
  el ayudante en UTC; 1 inocua pasa: el patrón citado en un comentario) · O ✓ (fin de mes, fin de
  año, fecha inválida) · G ✓ (2,704 unitarias de las pantallas, compras y tablero) · P no aplica
  (no cambia quién puede) · **E y V pendientes** (la e2e táctil a las 18:30 con el reloj falso y
  el motor viejo, con el arnés).
- **Commit:** `586dcfc` (lote 1, PR #37).

### 2 a 6 · El primer barrido del arnés (16-11, 22:50)

Los vio la primera pasada de `humo-aparatos.spec.ts` en tres perfiles (`win-1366x768-125`,
`win-1920x1080-150`, `telefono-390x844`). Ninguno detiene la operación; el 4 y el 5 sí estorban con
el dedo. Se arreglan en el lote 2 con su prueba del arnés en rojo antes y en verde después, en los
14 aparatos, y con su mutante. El detalle (causa con `archivo:línea`, captura y commit) se llena al
cerrarlos.

### 7 · La comanda que se queda en «nuevo»

Lo vio el agente 1 al probar los candados de la cocina: con dos platos en una comanda, se marca
«Listo» uno y luego se quita el otro; la comanda sigue en «nuevo» aunque su único plato vivo está
«listo».

- **Causa (leída en el código, 23:40):** la comanda se DERIVA del mínimo de sus platos
  (`packages/app/src/restaurante/items.ts:99`, `ajustarComandaAlMinimo`), y eso se recalcula al
  mover un plato (`preparacion.ts`) y al cobrar (`comandas-al-cobrar.ts:49`), pero NO al quitar un
  platillo: `anulacion-linea.ts:206` sólo cancela la comanda que se quedó sin platos vivos
  (`cancelarComandasSinPlatillos`). Si queda uno vivo y ya estaba «listo», nadie vuelve a derivar.
- **Qué le pasa a la gente:** la comanda sigue en la columna de «Nuevos» con su único platillo ya
  listo, la mesa no pasa a «Esperando entrega» y el mesero no recibe el aviso hasta que el cocinero
  vuelve a tocar la comanda. Tiene salida (tocarla otra vez), por eso es **medio**.
- **Arreglo previsto:** tras anular la línea, las comandas de esa línea que siguen vivas se ajustan
  al mínimo de sus platos y, si quedan «listo», siguen el mismo cierre que cuando el último plato
  se marca listo (líneas, mesa, lo ya cobrado). Con su prueba de integración en rojo antes y su
  mutante. Falta verlo también en la pantalla de Cocina con el dedo.

### 8 · alto · Con el IVA cambiado, una parte de una cuenta dividida no se podía cobrar

- **Cómo se encontró:** el caso 4 de los cambios a media operación (Fase D), contra Postgres.
- **Pasos:** dividir una cuenta por platillo → Configuración → cambiar el IVA (por ejemplo, de «sin
  IVA» a 16 % sumado) → cobrar una de las partes con su total nuevo. El servidor contesta «Algo
  falló» (`ERROR_INTERNO`, sqlstate 23514) y la parte queda sin poder cobrarse.
- **Causa:** la cuenta toma la tasa vigente AL COBRAR (`venta/cotizar.ts`), así que el cobro
  reescribe el total de la parte; la cuenta madre seguía sumando el total viejo y la base lo
  rechaza al confirmar (`division_cuadra`, migración 070: la madre vale lo que suman sus partes).
- **Arreglo:** `packages/app/src/venta/cobrar.ts` (pasos `leer_la_parte` y `ajustar_la_madre`): si
  cualquiera de los cuatro importes de la parte cambió, la madre se vuelve a sumar con la misma
  función que ya se usa al descontar o cancelar una parte (`ajustarLaMadreASusPartes`), con el
  candado de la madre. La revisión añadió el caso del IVA INCLUIDO (el total no cambia y el
  impuesto sí): comparar sólo el total dejaba a la madre diciendo «sin IVA».
- **La regla, escrita (DP-D155):** la cuenta toma la tasa vigente al cobrar; la parte ya cobrada
  conserva la suya; cobrar con el total de una precuenta vieja se rechaza y se vuelve a leer.
- **Pruebas:** `packages/app/src/qa-final/cambios-a-media-operacion.integracion.test.ts` (13 de
  13). **Ataques:** I ✓ · M ✓ (sin el ajuste caen 2; comparando sólo el total cae el caso del IVA
  incluido) · C (dos partes a la vez se forman en el candado de la madre) · G ✓ (unitarias de
  `venta` y `restaurante`, y las 112 ternas del dinero) · **E pendiente** (verlo en la Caja).

### 9 · medio · La propina por porcentaje, un centavo abajo

- **Causa:** cuenta en pesos con punto flotante en `PropinaDialog.jsx` y `PedirCuentaQR.jsx`
  (`Math.round(pesos * (pct / 100) * 100) / 100`): 4,315.725 se quedaba en 4,315.72.
- **Arreglo:** `propinaPorPorcentaje` en `heredado/utils/tipsUtils.js`, en centavos enteros y con
  el medio centavo hacia arriba, igual que el servidor.
- **Pruebas:** `qa/qa-final/propiedades/propina-pantallas.contrato.test.ts` y la propiedad de
  `fast-check` (contraejemplo fijado: 2,877,150 centavos al 15 %). **Ataques:** U ✓ · M ✓ · O ✓.

### 10 · medio · Cambiar el PIN no cierra la sesión abierta

`identidad/comandos.ts` rota la credencial pero no toca `sesiones`: quien ya estaba dentro sigue
hasta que su sesión venza. Desactivar a la persona sí las cierra (`empleados.ts`,
`revocarSesionesDeEmpleo`). **Decisión:** cambiar el PIN de OTRA persona cierra sus sesiones (si
se lo cambian porque alguien lo vio, ese alguien no se queda dentro); cambiar el propio no cierra
la sesión con la que se está cambiando. Por arreglar con su prueba y su mutante.

### 11 · bajo · El servidor acepta la propina al cobrar sin mirar quién puede elegirla

`venta.cobrar` no lee «quién elige la propina»; sólo `cuenta.fijar_propina` lo hace valer. La
pantalla de la Caja esconde el selector cuando la Caja no puede. No se cambia antes de abrir: la
propina que llega al cobro puede venir ya fijada por el comensal o el mesero, y endurecer el cobro
tiene más riesgo de romper un cobro legítimo que beneficio. Queda en la lista de después.

### 12 · bajo · «El total cambió…» sin decir el total nuevo

`TOTAL_DESACTUALIZADO` sólo lleva la regla; el comentario de `venta/cotizar.ts` promete el total
vigente. La cajera tiene que volver a abrir la cuenta para verlo. Por ver en la Caja con el arnés.

### 13 · alto · En la tableta no se puede elegir el «Tipo de venta» de un platillo

- **Cómo se encontró:** la Parte 5 por pantallas y con el dedo (agente D2), tableta 1024×768.
- **Pasos:** Recetas → «Nueva receta» → tocar «Variable por medida» en «Tipo de venta». El toque
  falla («element is outside of the viewport»). Con ratón de PC la misma creación sale en 6 s.
- **Causa:** sin confirmar (¿el desplegable se abre fuera del área visible del diálogo?). La
  captura que hay (`salida/dia-0/fallo-productos.png`, en el árbol del agente) no lo enseña.
- **Por qué es alto:** en un restaurante que vende barbacoa por kilo, dar de alta un platillo por
  peso desde una tableta es un flujo real; tiene salida (hacerlo en la PC).

### 14 · alto · El costo por gramo o mililitro se guarda en centavos enteros

- **Cómo se encontró:** al comparar «Valor de inventario» con el libro del día 0 (agente D2): siete
  compras por $12,000.00 y, tras las mermas, $11,570.50 esperados contra $11,552.00 en pantalla.
- **Causa:** `packages/app/src/compras/costeo.ts` (`costoPorUnidad`, `costoPromedioPonderado`)
  devuelve centavos enteros por UNIDAD BASE, y en el restaurante la unidad base es el gramo, el
  mililitro o la pieza. Leche a $480 los 20 L (2.4 ¢/ml) queda en 2 ¢; maíz a $540 los 12 kg
  (4.5 ¢/g) queda en 5 ¢. Lo leen la valuación, el costo de las recetas, la merma y el kardex.
- **Qué NO toca:** precios, cuentas, cobros, cortes y propinas. Producción tiene hoy 0 insumos.
- **Arreglo en curso (agente D3):** guardar además el costo exacto (diezmilésimas de centavo por
  unidad base), multiplicar con el exacto y redondear una sola vez; el redondeado se queda para
  lo que sólo lo muestra. Migración aditiva. Es una regla de dinero: va con su decisión.

### 15 · medio · La regla del mínimo reventaba con existencia en negativo

`packages/domain/src/inventario/pedido.ts` (`alertasDeMinimo`) lanzaba `CANTIDAD_INVALIDA` con una
existencia por debajo de cero, que DP-D116 permite. Arreglado por el agente D2 (DP-D161) junto con
el aviso de insumo bajo; por desplegar en el lote 3.

### 16 · falta · Receta para las opciones de un platillo

El dominio y la base soportan que una opción sustituya o escale la receta (F-027), pero ninguna
pantalla lo ofrece: una «orden grande» descuenta lo mismo que una chica. Por medir: si cabe en medio
día se construye; si no, va a la lista de Miguel.

### 17 · bajo · «Modo espera en este aparato» sin nombre accesible en la tableta

Visto en Configuración → Este aparato (`salida/explorar-este-aparato.png`). Entra al barrido de
accesibilidad de Configuración.

## Lo que la verificación completa cazó antes de unir (no llegó a producción)

- **Lote 1, 23:22:** `verify-lote1` marcó 19 unitarias en rojo que las corridas por zona no habían
  visto. Dieciocho eran de `packages/app/src/restaurante/` (anulación de línea, cocina y mesa): el
  candado de cocina (H2) pide `id in (…) or orden_id in (…)` y la base falsa de las pruebas sólo
  sabía `in` en el filtro simple. La otra, el contrato `destinos-de-los-textos`: «Configuración →
  Este aparato» quedó partido en dos renglones y el contrato leyó «Este». Arreglo: `7a51e29`
  (187 de 187 en esas zonas). Lección anotada en `ESTADO.md`: tras cada agente se corren las
  unitarias completas de la zona, no sólo las pruebas nuevas.

- **Lote 1, la CI del PR #37 (17-11, 00:10):** «Jornada completa · restaurante» falló en
  `pruebas/e2e/sonidos.spec.ts` («Cocina: la comanda nueva suena a Ping…») en los tres aparatos. No
  era un defecto de la app sino una suposición vieja de la prueba: entraba como dueña a Cocina y
  esperaba el timbre, y con DP-D151 el aparato de quien no es de cocina ya no anuncia por omisión
  (el timbre va con la voz desde DP-21). Se decidió dejar la regla y corregir la prueba: escucha
  desde el puesto de cocina; una prueba nueva fija los dos lados (la dueña calla sin elegir y
  suena al encenderlo en Este aparato); y la de «la voz hablando» también escucha desde cocina,
  porque con la dueña pasaba sin probar nada. En local: 10 de 10 en `tablet` y `telefono` y las
  tres pruebas de Cocina en `escritorio`; mutante: con el aparato de la dueña ya encendido, la
  prueba nueva cae («Received: ping»). Las tres suites que la CI no alcanzó
  (`configuracion-que-no-se-regresa`, `cajas-del-negocio`, `personalizar-menu`) pasan en local.
  Por ver en el barrido: que la dueña, al abrir Cocina, entienda por qué su pantalla no suena.

## Pendientes conocidos que entran como hallazgos (Parte 9)

| Clave | Qué                                                                                       | Lote | Estado                                                                                           |
| ----- | ----------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| H2    | Los candados de Preparar, Listo y cancelar, en el mismo orden (200 cruces sin un 500)     | 1    | hecho · `6b580f5` · 200 cruces y 20 contra la cancelación, 0 reintentos                          |
| A24   | La merma con existencia negativa: nunca un error mudo                                     | 1    | hecho · `6b580f5`                                                                                |
| DEV   | La devolución de lo vendido por peso o porción                                            | 1    | hecho · `6b580f5` (lo preparado no regresa; la pantalla lo dice)                                 |
| X4    | Tope por IP en la entrada del laboratorio                                                 | 1    | hecho · `6b580f5`                                                                                |
| H3    | Registros «Este año»: sin truncar, con agregados del servidor                             | 1    | hecho · `7921fd2` (`registros.resumen`); falta verlo con datos en la app                         |
| A23   | Propinas por mesero, por rango, en el servidor                                            | 1    | hecho · `7921fd2` (`propinas.del_rango`); queda una lectura cortada (\*)                         |
| A5    | El almacén registra compras desde Inventario                                              | 1    | hecho · `7921fd2`                                                                                |
| A6    | El Cierre no pide «no recogido»                                                           | 1    | hecho · `7921fd2`                                                                                |
| A10   | «Editar receta» sólo con el renglón abierto                                               | 1    | hecho · `7921fd2`                                                                                |
| X5    | Tiempo de espera del lado de la página al imprimir                                        | 1    | hecho · `7921fd2` (20 s); falta el plazo en «Imprimir prueba» (\*)                               |
| LINT  | La puerta de `heredado/*.jsx` (TS2304 y TS2552) en `verify` y en la CI                    | 1    | hecho · `586dcfc` (`pnpm verify:heredado`, se prueba contra sí misma)                            |
| P012  | Lo que el anexo 012 dejó para Miguel (PUBLICOS, comandos sin pantalla, crédito, Avanzado) | 1    | hecho · `6d5c22b` · DP-D151                                                                      |
| COLA  | El aviso de «la cola de sincronización» al cajero                                         | 1    | hecho · `6d5c22b` (la Caja ya no la encola)                                                      |
| VOZ   | Dos pantallas de la misma estación anuncian doble                                         | 1    | hecho · `6d5c22b` (se pregunta una vez); falta su e2e táctil (agente A)                          |
| SIL   | `silenciar_notificaciones_admin` en la operación de Don Poncho                            | 1    | decidido · DP-D149: se queda encendido; el guion lo comprueba                                    |
| H5    | A7 y A9 con prueba de comportamiento en Playwright                                        | 2    | hecho · lote 3 (`f0145b3`): A7 y A9 con el dedo en tableta, con su mutante                       |
| B18   | Los cortes en una carpeta de Windows (app 1.0.2)                                          | 4    | hecho · POS en el lote 2 (`829b13d`); app 1.0.2 publicada (`37ec070`) y vista llegar a una 1.0.1 |

(\*) Sobras del agente 2, para el lote siguiente: `PropinasDashboardSection.jsx` todavía lee una
lista que puede venir cortada, y `impresion/pantallas/imprimir-prueba.ts` no tiene plazo.
