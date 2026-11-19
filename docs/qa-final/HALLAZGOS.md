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

| Severidad | Encontrados | Arreglados | Descartados | Abiertos |
| --------- | ----------: | ---------: | ----------: | -------: |
| Crítico   |           0 |          0 |           0 |        0 |
| Alto      |           6 |          4 |           2 |        0 |
| Medio     |          20 |         18 |           2 |        0 |
| Bajo      |          16 |         11 |           2 |        3 |
| Por ver   |           1 |          0 |           1 |        0 |
| Falta     |           1 |          0 |           0 |        1 |

(«Arreglados»: en producción desde el 17-11 —1, 2, 3, 4, 7, 8, 9, 10, 14, 15, 18, 19, 22 y 23—, en el
lote 5 (en producción desde el 17-11, `e4e0a70`) —12, 24, 27, 28, 29, 30, 31, 32, 33 y 36— y el 37, del lote 6
(en producción desde el 18-11, `ca7e6f1`); y **26, 34, 35 y 38, del lote 7, por desplegar**, y **39, 40, 41 y 44, del lote 8, por desplegar** (el 35 en parte: la
hoja ofrece otra precuenta, el «—» del total se queda porque el total es de rol caja). Del 5 se cerró también
lo cosmético que quedaba, en el lote 7. «Descartados» son los que, al reproducirlos, resultaron no ser
defectos de la app: 5, 6, 13, 17, 20, 21 y 25. **Abiertos: el 11 (bajo, anotado); los bajos 42 y 43, hallados la víspera del lote 7 («Importar» con fila repetida y dos usuarios con el mismo nombre); y el 16, que es una función grande para después.** Total: 44 encontrados, 33 arreglados, 7 descartados, 4 abiertos.)

## Lista

| #   | Sev.    | Pantalla · aparato                                                | Qué pasa                                                                                                                                                                                                                                                                                   | Estado                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | alto    | Compras y gastos, Inventario, exportaciones · todos los aparatos  | Después de las 18:00 «hoy» era mañana: «Registrar gasto» y «Registrar compra» proponían la fecha del día siguiente y un gasto en efectivo quedaba rechazado                                                                                                                                | arreglado (lote 1); falta su e2e táctil con el arnés                                                                                                                                                                                                                                                                                                       |
| 2   | medio   | Caja · todos                                                      | Un botón (`button.py-2`) sin nombre accesible: un lector de pantalla dice «botón» y nada más (axe: crítico)                                                                                                                                                                                | arreglado · en producción (lote 4, `6b76050`): «Buscar» y el campo de folio tienen nombre                                                                                                                                                                                                                                                                  |
| 3   | medio   | Barra de la cuenta sobre el color primario · todos                | Texto de 12 px a 60 % de opacidad sobre el café primario: contraste 3 a 1 (#ccc0ad sobre #83653f); se pide 4.5 a 1                                                                                                                                                                         | arreglado · en producción (lote 4, `6b76050`): el contador de zona pasa a 4.6:1                                                                                                                                                                                                                                                                            |
| 4   | medio   | Barra lateral, Caja y salón del mesero · táctiles                 | Tocables por debajo de 44 px: los enlaces de la barra lateral (121×40), «Activar modo oscuro», «Sonido», «Salir», las pestañas de Caja y las fichas de zona del mesero (se arreglan por componente)                                                                                        | arreglado · en producción (lote 4, `6b76050`): 44 px con el dedo, por componente (DP-D154)                                                                                                                                                                                                                                                                 |
| 5   | medio   | Barra lateral · 1280×800 y 1366×768 a 125 % (1093×614)            | «Compras» queda encimado con «Activar modo oscuro»: en una pantalla baja el dedo puede caer en el botón equivocado                                                                                                                                                                         | descartado: falso positivo del arnés (corregido). Lo cosmético que quedaba («Compras» cortado en 1093×614) se cerró en el lote 7 (por desplegar, DP-D188): un degradado y una flecha al borde avisan que hay más por desplazar                                                                                                                             |
| 6   | por ver | Caja cerrada · todos                                              | «Abrir caja» aparece con `pointer-events: none`: falta saber si es un deshabilitado legítimo con su motivo a la vista o un botón muerto                                                                                                                                                    | descartado: es el botón desactivado con la caja ya abierta, y dice por qué debajo                                                                                                                                                                                                                                                                          |
| 7   | medio   | Cocina y salón · todos                                            | Con un plato ya «listo», quitar el otro platillo de la comanda la deja en «nuevo»: la mesa no pasa a «Esperando entrega» y el mesero no recibe el aviso hasta que cocina la vuelve a tocar                                                                                                 | arreglado · en producción (lote 3, `e4c45f5`)                                                                                                                                                                                                                                                                                                              |
| 8   | alto    | Caja · cobro de una cuenta dividida                               | Si se cambia el IVA después de dividir una cuenta, cobrar una de sus partes da «Algo falló» y esa parte ya no se puede cobrar                                                                                                                                                              | arreglado · en producción (lote 2, `829b13d`)                                                                                                                                                                                                                                                                                                              |
| 9   | medio   | Propina en la Caja y en el portal                                 | La propina por porcentaje salía un centavo abajo en los medios centavos ($28,771.50 al 15 % daba $4,315.72 y el servidor $4,315.73)                                                                                                                                                        | arreglado · en producción (lote 2, `829b13d`)                                                                                                                                                                                                                                                                                                              |
| 10  | medio   | Personas y seguridad                                              | Cambiarle el PIN a alguien no cierra la sesión que tenga abierta: sigue dentro hasta que venza (12 h)                                                                                                                                                                                      | arreglado · en producción (lote 2, `829b13d`)                                                                                                                                                                                                                                                                                                              |
| 11  | bajo    | Caja · cobro                                                      | El servidor acepta una propina al cobrar aunque en Configuración nadie pueda elegirla; la pantalla la esconde, el servidor no la exige                                                                                                                                                     | anotado: no se cambia antes de abrir (ver detalle)                                                                                                                                                                                                                                                                                                         |
| 12  | bajo    | Caja · cobro                                                      | Cuando el total cambió desde la precuenta, el aviso dice «El total cambió…»: el servidor sí manda el total nuevo, falta ver si la Caja vuelve a leer la cuenta o se queda con el total viejo                                                                                               | el arreglo del lote 4 NO llegaba a ejecutarse (comparaba `err.codigo`; el servidor manda la regla en `datos.regla`, y el contrato leía el texto). Corregido en el lote 5 (DP-D172) y visto con el dedo en tableta: el total pasa al nuevo y el segundo cobro cobra. En producción (lote 5, `e4e0a70`)                                                      |
| 13  | alto    | Recetas → Nueva receta · tableta 1024×768 con el dedo             | No se puede elegir el «Tipo de venta» («Variable por medida») al crear un platillo: el toque cae fuera de la pantalla. Con ratón sí se puede                                                                                                                                               | no se reproduce: 27 de 27 desplegables eligen con el dedo en tableta 800×1280, 1024×768 y Windows al 125 %; queda una guarda y va a la lista física de Miguel                                                                                                                                                                                              |
| 14  | alto    | Inventario, recetas y márgenes · todos                            | El costo por gramo o mililitro se guarda en centavos enteros: leche a 2.4 ¢/ml queda en 2 ¢ (−16.7 %) y maíz a 4.5 ¢/g en 5 ¢ (+11 %); con $11,570.50 comprados, «Valor de inventario» dice $11,552                                                                                        | arreglado · en producción (lote 4, `6b76050`): costo exacto en diezmilésimas de centavo, migración 195 (DP-D165)                                                                                                                                                                                                                                           |
| 15  | medio   | Inventario · aviso de mínimos                                     | La regla de «por debajo del mínimo» reventaba con una existencia en negativo, que DP-D116 hace legal                                                                                                                                                                                       | arreglado · en producción (lote 3, `e4c45f5`)                                                                                                                                                                                                                                                                                                              |
| 16  | falta   | Recetas                                                           | No hay pantalla para darle receta a las OPCIONES de un platillo (el dominio y la base sí lo soportan: sustituir y escalar)                                                                                                                                                                 | no se construye aquí: es grande (dos pantallas y dos comandos); diseño en DP-D169, a la lista de Miguel                                                                                                                                                                                                                                                    |
| 17  | bajo    | Configuración → Este aparato · tableta                            | El interruptor «Modo espera en este aparato» no trae nombre accesible                                                                                                                                                                                                                      | descartado: el interruptor sí tiene nombre accesible (`aria-labelledby`); queda un contrato para todos los interruptores                                                                                                                                                                                                                                   |
| 18  | bajo    | Configuración → Identidad · todos                                 | El texto de los ajustes de color y de «nombre del sistema» promete que cambian «el acceso», y la pantalla de acceso (sin sesión) no los lee, a propósito: lo público es mínimo                                                                                                             | arreglado · en producción (lote 4, `6b76050`): la ayuda dice que se aplican dentro, con sesión                                                                                                                                                                                                                                                             |
| 19  | medio   | Portal del cliente · teléfono                                     | «Mostrar productos sin imagen» apagada no hace nada en «Menú digital» (sólo vale en «A la carta»): un ajuste que no cumple lo que dice                                                                                                                                                     | arreglado · en producción (lote 4, `6b76050`): vale en los dos menús (DP-D166)                                                                                                                                                                                                                                                                             |
| 20  | alto    | Caja → Cerrar caja del día · iMin (Chromium 99)                   | En el motor del iMin, tras «Cerrar caja del día» el diálogo no se cierra en 60 s (visto con «Descargar el PDF del corte» encendido). Falta saber si es la app o la prueba                                                                                                                  | descartado: no es de la app. Repetido solo, el diálogo se cierra a los 5 s en Chromium 99 con y sin PDF; el fallo era la máquina cargada. De paso: si el PDF no se puede guardar, el aviso ahora dice «La caja se cerró…»                                                                                                                                  |
| 21  | medio   | Configuración → Datos del negocio · todos                         | Cambiar SÓLO el nombre y tocar Guardar no manda nada al servidor; con los cuatro campos sí guarda                                                                                                                                                                                          | descartado: sí guarda; el toque de la prueba caía bajo el pliegue (corregido en el arnés)                                                                                                                                                                                                                                                                  |
| 22  | medio   | Inventario · consumo interno                                      | `inventario.consumo_interno` nunca se había corrido contra Postgres y ahí falla: su salida exige un `motivo` que el movimiento no escribe                                                                                                                                                  | arreglado · en producción (lote 4, `6b76050`): DP-D167. Ninguna pantalla lo llama                                                                                                                                                                                                                                                                          |
| 23  | medio   | Inventario → kardex y corte                                       | La merma manual, el traspaso y la devolución escriben el movimiento SIN costo: salen a $0 en el kardex y en el corte (la merma por cancelación, el ajuste y el cobro sí lo copian)                                                                                                         | arreglado · en producción (lote 4, `6b76050`): copian el costo exacto al moverse (DP-D167); lo ya escrito no se reescribe                                                                                                                                                                                                                                  |
| 24  | medio   | Inventario → Ajustar · todos                                      | La opción «Merma / producto perdido» graba el movimiento como `ajuste` (motivo `ajuste_conteo`): esa merma no sale en la merma del corte ni en un reporte de merma                                                                                                                         | arreglado · en producción (lote 5, `e4e0a70`): graba una merma con su motivo y sale en el corte (DP-D171)                                                                                                                                                                                                                                                  |
| 25  | bajo    | Configuración → interruptores · táctiles                          | El interruptor mide 32×18 px: por debajo de los 44 px con el dedo                                                                                                                                                                                                                          | descartado: con el dedo el blanco del interruptor ya es de 44×44 (medido en el navegador)                                                                                                                                                                                                                                                                  |
| 26  | bajo    | Caja → Movimientos · escritorio                                   | Los campos de «Corte de turno» y «Retiro de caja», dos tarjetas lado a lado, no quedan a la misma altura (sus textos de ayuda miden distinto)                                                                                                                                              | arreglado (lote 7, por desplegar): DP-D187. Los dos encabezados reservan tres renglones de ayuda y los campos del corte miden 1.25 × el control, como los del retiro; se quitó la excepción del barrido. Costo: aire bajo la ayuda de un renglón en pantallas anchas                                                                                       |
| 27  | medio   | Registros → Utilidad bruta · todos                                | El margen ignora lo que se vende por kilo o por porción de un contenedor: esos renglones guardan costo cero («desconocido») porque el costo del platillo sólo se calcula para los de receta. La barbacoa por kilo queda fuera de la utilidad                                               | arreglado · en producción (lote 5, `e4e0a70`): al cobrar, el costo del renglón por kilo o por porción sale de lo que baja del almacén × el costo exacto del insumo, con un solo redondeo (DP-D180). No toca lo cobrado ni el inventario; lo ya cobrado en cero no se reescribe                                                                             |
| 28  | bajo    | Inventario · puesto de almacén                                    | «Registrar compra» se le ofrece al almacenista y lo manda a Compras, que le dice que las compras las registra la gerencia                                                                                                                                                                  | arreglado · en producción (lote 5, `e4e0a70`): el botón sólo se ofrece a quien puede registrar compras y Compras no dice «lo registra la gerencia» mientras no sabe el puesto; el permiso no cambia, el almacén ya podía (DP-D181)                                                                                                                         |
| 29  | medio   | Portal del cliente · teléfono                                     | Un platillo con «Visible en POS» apagado seguía saliendo en el portal y un teléfono podía pedirlo                                                                                                                                                                                          | arreglado · en producción (lote 5, `e4e0a70`): DP-D174                                                                                                                                                                                                                                                                                                     |
| 30  | medio   | Inventario → Ajustar · todos                                      | La pantalla frenaba una merma cuando la existencia ya estaba en negativo, contra DP-D116 y DP-D146                                                                                                                                                                                         | arreglado · en producción (lote 5, `e4e0a70`): DP-D173                                                                                                                                                                                                                                                                                                     |
| 31  | alto    | Caja → Cerrar caja del día · todos                                | El cierre no tenía dónde capturar el arqueo por billetes y monedas: sólo un campo de total, aunque el servidor y el papel del corte ya lo soportaban                                                                                                                                       | arreglado · en producción (lote 5, `e4e0a70`): «Contar por billetes y monedas» (DP-D178)                                                                                                                                                                                                                                                                   |
| 32  | medio   | Corte y Registros → Cancelaciones                                 | No decían quién autorizó una cancelación (la auditoría sí lo guardaba)                                                                                                                                                                                                                     | arreglado · en producción (lote 5, `e4e0a70`): DP-D179                                                                                                                                                                                                                                                                                                     |
| 33  | medio   | Pedido del mesero · teléfono y tableta                            | Buscar «limón» no encontraba «Limonada»: la búsqueda distinguía acentos                                                                                                                                                                                                                    | arreglado · en producción (lote 5, `e4e0a70`): DP-D178                                                                                                                                                                                                                                                                                                     |
| 34  | bajo    | Pedido del mesero · teléfono 360×800                              | Con el teclado abierto, la barra flotante «Solicitar cuenta» tapa la parte baja de la primera tarjeta del resultado de la búsqueda                                                                                                                                                         | arreglado (lote 7, por desplegar): DP-D186. La barra flotante se esconde mientras un campo de texto tiene el foco y vuelve al soltarlo. Prueba con el dedo en teléfono y en Windows, y contrato con sus mutantes                                                                                                                                           |
| 35  | bajo    | Precuenta · tableta                                               | Tras cerrar «Pre-cuenta lista» el mesero ya no tiene botón para otra hoja (sólo por el menú Precuenta), y esa pantalla enseña «—» en el total hasta tocar «Imprimir»                                                                                                                       | arreglado en parte (lote 7, por desplegar): DP-D186. La hoja del teléfono y el panel de la tableta traen «Imprimir otra hoja de la precuenta» con la cuenta pedida. El «—» del total se queda: el total es de rol caja y sólo lo saben el servidor al pedir la cuenta y al imprimir; la pantalla ahora dice «toca Imprimir y la hoja se completa con él»   |
| 36  | bajo    | Editor de receta · todos                                          | Los interruptores «Activo» y «Visible en POS» no tenían nombre accesible                                                                                                                                                                                                                   | arreglado · en producción (lote 5, `e4e0a70`)                                                                                                                                                                                                                                                                                                              |
| 37  | medio   | Pedido del mesero, teléfono                                       | «Cambiar de mesa» no se le ofrecía al mesero en la hoja del pedido del teléfono, sólo «Solicitar cuenta» (en la tableta sí)                                                                                                                                                                | arreglado · en producción (lote 6, `ca7e6f1`): DP-D182                                                                                                                                                                                                                                                                                                     |
| 38  | bajo    | Pedido del mesero, teléfono                                       | Con la cuenta ya pedida la barra del teléfono desaparece y el mesero sigue sin «Cambiar de mesa»                                                                                                                                                                                           | arreglado (lote 7, por desplegar): DP-D186. El servidor sí lo permite (la cuenta pedida es una cuenta viva): la barra se queda con «Cuenta pedida» y su hoja trae «Cambiar de mesa» con la misma regla                                                                                                                                                     |
| 39  | medio   | Configuración → Salón → Mapa de mesas · Windows 1366×768 al 125 % | El lienzo del mapa no escala (unos 470 px de CSS) y corta las mesas 3 y 6 de «Interior» (`MesaMapEditor.jsx`, lienzo fijo con `overflow-hidden`)                                                                                                                                           | arreglado (lote 8, por desplegar): DP-D195. El lienzo se reduce al ancho disponible (`data-escala`; nunca se agranda) y el arrastre guarda coordenadas lógicas. Prueba: `tarjetas-personas.spec.ts › mapa-de-mesas…` en Windows, iMin y tableta (fallaba con «mesas cortadas»: la 3 y la 6). Costo: las mesas se ven más chicas cuando el lienzo se reduce |
| 40  | bajo    | Pedido del mesero · teléfono                                      | Al quitar el último renglón del carrito la hoja no se cierra sola: queda el velo y tapa los platillos hasta tocarlo                                                                                                                                                                        | arreglado (lote 8, por desplegar): DP-D196. La hoja se cierra cuando el carrito pasa de con piezas a vacío. Prueba: `flujos-sin-prueba.spec.ts › Pedido · Cantidades…` (teléfono y tableta; fallaba con «la hoja y su velo siguen abiertos»)                                                                                                               |
| 41  | bajo    | Portal del cliente · teléfono 360×800                             | Al calificar la visita el aviso «Solicitud enviada» se superpone al texto de gracias (el texto existe y la prueba lo comprueba)                                                                                                                                                            | arreglado (lote 8, por desplegar): DP-D197. El aviso no se pinta mientras la hoja de la valoración está abierta. Prueba: `flujos-sin-prueba.spec.ts › Portal QR · Calificar la visita…` (teléfono; fallaba con el aviso encima del texto)                                                                                                                  |
| 42  | bajo    | Configuración → Importar datos desde archivo                      | No bloquea un archivo con una fila repetida: la marca como error y confirma sólo lo bueno                                                                                                                                                                                                  | abierto: lo halló el agente C (lote 7); comportamiento aceptable, anotado en su prueba                                                                                                                                                                                                                                                                     |
| 43  | bajo    | Configuración → Usuarios POS                                      | Se pueden crear dos usuarios con el mismo nombre (aparecieron cuatro «Rubén Ochoa»)                                                                                                                                                                                                        | abierto: lo halló el agente C (lote 7)                                                                                                                                                                                                                                                                                                                     |
| 44  | bajo    | Configuración → Reiniciar sistema · Windows                       | «Borrar todos los datos» prometía «Resetea la configuración a valores base. Conserva tu usuario administrador», y el comando conserva la configuración y a toda la gente (11 personas en la base de prueba); lo demás sí lo borra (catálogo, inventario, recetas, mesas, lo transaccional) | arreglado (lote 8, por desplegar): DP-D198, el texto dice lo que hace (no se cambió el comando). **Para Miguel:** si «para un cliente nuevo» debe también resetear la configuración                                                                                                                                                                        |

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
el aviso de insumo bajo; en producción desde el lote 3 (`e4c45f5`).

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
