# Hallazgos de QA-1 · jornada del 3 de noviembre de 2026

Copia desechable de `don-poncho` (app en el 3210, base `morphiqpos_qa`), HEAD `ab32e09` (dp-13). La bitácora de la jornada, con la tabla de lo esperado contra lo real, está en [`JORNADA-2026-11-03.md`](./JORNADA-2026-11-03.md). Las capturas y archivos citados están en `docs/qa/evidencia/`. Los PIN de la copia no se escriben aquí: en los pasos digo «la gerente», «Mesero 1», «la cajera».

Sólo escribo lo que vi. Cuando algo no lo reproduje o no guardé evidencia, lo digo.

## Resumen

| Id     | Gravedad                | Qué                                                                                                                                | Estado                                                                |
| ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| QA1-1  | —                       | PIN de 6 cifras en la preparación de la copia                                                                                      | **Descartado: no es de la app**                                       |
| QA1-2  | baja                    | «Nueva mesa»: la zona aparece en blanco                                                                                            | Visto                                                                 |
| QA1-3  | baja                    | Crear insumo con unidad `kg` por la API: 500                                                                                       | Visto                                                                 |
| QA1-4  | media                   | Mesero «Mesas y pedidos»: la Quesadilla sale sin «Relleno» (obligatorio en el portal)                                              | Visto, con causa                                                      |
| QA1-5  | media                   | La cajera no tiene manera de dividir una cuenta desde Caja; el enlace de «Dividir» de la mesa activa no cuelga de ninguna pantalla | Visto                                                                 |
| QA1-6  | baja                    | Las partes de una cuenta dividida no dicen su número de mesa                                                                       | Visto                                                                 |
| QA1-7  | baja                    | `/restaurante/precuenta` muestra «Folio null»                                                                                      | Visto                                                                 |
| QA1-8  | media                   | Registros: la exportación CSV y «Ver PDF» de un corte muestran esperado 0 y diferencia 0 aunque el cierre guardó −$10.00 y +$20.00 | Visto                                                                 |
| QA1-9  | media                   | Registros → «Ver PDF» no trae «Pérdidas por cancelación» aunque el PDF del «Cierre del día» sí                                     | Visto                                                                 |
| QA1-10 | info                    | Las purgas de mantenimiento se limitan a 3 por hora; la cuarta se niega                                                            | Visto (es el diseño)                                                  |
| QA1-11 | baja, **sin confirmar** | Una venta cancelada en Ventas con «43.2% margen»                                                                                   | Visto una vez en el texto de la pantalla, sin captura ni reproducción |

## Ronda 2 (coordinación, 05-11-2026)

La jornada completa otra vez, con todo arreglado y la app compilada de nuevo: **8 de 8 specs en verde**
con la compilación final, con las 48 comparaciones cuadrando, también el CSV y el
«Ver PDF» de Registros. Los guiones se ajustaron a la app arreglada (la quesadilla pide su relleno) y a
que una persona se llama como un puesto («Cocina»).

## Estado tras la ronda 1 (coordinación, 05-11-2026)

| Id     | Estado                                                                                                                                                                                                  | Dónde                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| QA1-2  | **Pendiente (baja)**: no se reprodujo; la mesa se guarda con su zona                                                                                                                                    | —                                                  |
| QA1-3  | Arreglado: 4xx con el motivo                                                                                                                                                                            | `b1af7d9`, `inventario/unidad-del-insumo`          |
| QA1-4  | Arreglado: el mesero pide las opciones obligatorias; el editor abre con lo guardado                                                                                                                     | `8faf28c`, `restaurante.opciones_de_los_platillos` |
| QA1-5  | Arreglado: «Dividir» en el cobro de `/caja`                                                                                                                                                             | `8faf28c`, e2e `dividir-en-la-caja`                |
| QA1-6  | Arreglado: cada parte con su nombre                                                                                                                                                                     | `8faf28c`                                          |
| QA1-7  | Arreglado: sin folio no se escribe                                                                                                                                                                      | `8faf28c`                                          |
| QA1-8  | Arreglado: CSV y visor con lo que guardó el cierre                                                                                                                                                      | `8faf28c`                                          |
| QA1-9  | **Del guion, no de la app**: el servidor da las 6 filas y el visor las pinta; los títulos van en mayúsculas por CSS y `innerText` los devuelve así. `cierre-qa.ts` compara ya sin distinguir mayúsculas | —                                                  |
| QA1-10 | Es el diseño (3 purgas por hora)                                                                                                                                                                        | —                                                  |
| QA1-11 | Sin confirmar; no salió en la ronda 2                                                                                                                                                                   | —                                                  |

Ninguno es de gravedad alta. Los dinero-por-dinero cuadran (ventas, propinas, efectivo esperado de cada corte, mermas, almacén, Ventas «Cobrado»): ver la sección 4 de la bitácora. Lo que no cuadra es **cómo Registros muestra los cortes ya cerrados** (QA1-8 y QA1-9).

---

## QA1-1 · DESCARTADO · el PIN de 6 cifras fue de mi preparación

Al principio el teclado de login no aceptó los PIN de la copia: la preparación de la copia los había dejado de 6 cifras y el teclado de la pantalla toma sólo 4 (el servidor acepta de 4 a 8). Lo causó la preparación, no la app. La coordinación cambió los PIN a 4 cifras y desde entonces todo entra por el teclado real. **No es un hallazgo de la app.**

---

## QA1-2 · baja · «Nueva mesa»: la zona aparece en blanco

- **Dónde:** Configuración → Mesas → «Nueva mesa» (usado para crear de la mesa 11 a la 25).
- **Pasos:** la dueña abre Configuración → Mesas → «Nueva mesa». Se abre el diálogo.
- **Esperado:** la zona muestra una opción elegida (la que se guardará, «Salón») o pide elegir una.
- **Visto:** el campo Zona se ve vacío. Si no se toca, la mesa se guarda igual con «Salón». Una vez el primer clic en crear no cerró el diálogo (no lo reproduje).
- **Evidencia:** `docs/qa/evidencia/nueva-mesa-zona-en-blanco.png`.
- **Cómo lo sorteé:** la preparación elige la zona de forma explícita.

## QA1-3 · baja · Crear un insumo con unidad `kg` por la API da 500

- **Dónde:** `POST /api/inventario/insumos/crear`.
- **Pasos:** con la sesión de la dueña, enviar un insumo con `unidad: "kg"`.
- **Esperado:** o se acepta (y se convierte a la unidad base) o responde 4xx con el motivo.
- **Visto:** `500 ERROR_INTERNO` (correlationId `1a096895-a0cc-4a1d-847e-39d616f510c5`). El disparador de la base `insumo_unidad_base_valida` sólo deja `g`, `ml` y `pieza`; la API valida menos que la base y el error le llega al cliente como un 500 sin motivo.
- **No vi:** si la pantalla de Inventario deja elegir `kg` (la preparación usó gramos, y con gramos todo funcionó).
- **Evidencia:** lo vi en la exploración previa a la jornada; el `qa1-00-preparar` ya usa gramos y no lo repite, así que no hay captura ni anotación en el libro. Sólo conservo el correlationId.

## QA1-4 · media · Mesero: la Quesadilla sale sin «Relleno», que es obligatorio en el portal

- **Qué pasa:** en el portal del comensal la Quesadilla muestra «Relleno: Obligatorio» y no se puede agregar sin elegirlo (el pedido que llegó del portal lleva «Relleno: Pollo»). En «Mesas y pedidos» del mesero la misma Quesadilla se agrega y se envía a cocina **sin** relleno y sin avisar.
- **Pasos exactos** (Mesero 1, tableta, sesión ya iniciada):
  1. `/mesero` → tocar una mesa libre (por ejemplo la 14) → «Abrir mesa», 2 personas.
  2. En el diálogo de la mesa, tocar el mosaico **«Quesadilla $25.00»** (el mosaico del producto, no un «+», ni una pulsación larga, ni «Pedido del portal», ni una llamada a la API).
  3. **No se abre ningún diálogo de opciones**: en pantalla no hay «Relleno» (conté 0 apariciones). En el carrito queda «Quesadilla ˅ 1».
  4. Tocar «Enviar a Cocina».
- **Esperado:** se abre la selección de «Relleno» (obligatorio) y no se deja enviar sin elegir.
- **Visto:** la comanda se crea con `comanda_items.notas` vacío. La cocina recibe «Quesadilla» sin relleno.
- **Causa (leída en el código, no probada con una corrección):**
  - `Mesero.jsx` carga los productos con `ProductoTerminado.filter({activo: true, visible_en_pos: true})`.
  - La entidad del puente (`packages/app/src/puente/mapa.ts`) **no tiene el campo `modificadores`**: ni el registro del dueño ni el del mesero lo traen.
  - Por eso `productoTieneModificadores()` (`Mesero.jsx:619`) siempre da falso y el `SeleccionModificadoresDialog` nunca se abre.
  - La base sí tiene el vínculo `producto_modificadores` con el grupo «Relleno», y por eso el portal lo exige.
- **Evidencia:** `docs/qa/evidencia/mesero-quesadilla-sin-relleno.png` (mesero) y `portal-quesadilla-relleno-obligatorio.png` (portal).
- **Alcance:** vale para cualquier producto con opciones obligatorias; sólo comprobé la Quesadilla. No comprobé los otros caminos del mesero (por ejemplo desde la mesa activa de `/restaurante/mesa-activa`).

## QA1-5 · media · La cajera no tiene manera de dividir desde Caja

Como lo pidió la coordinación: dividir vive en la **mesa activa** («Acciones de la mesa» → Dividir), y `/restaurante/cobro` es una vista de gerencia. Probé ese camino con cada rol y esto es lo que vi:

| Quién         | Dónde                                                                 | Qué vi                                                                                                                  |
| ------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Mesero 1      | `/mesero` → mesa 15 ocupada, con el pedido enviado y la cuenta pedida | El diálogo de la mesa tiene 0 enlaces «Dividir, unir, separar o cambiar de mesa»                                        |
| Mesero 1      | `/restaurante/mesa-activa?mesa=<id de la mesa 15>` (tecleado)         | «Acciones de la mesa» con Pedir la cuenta, Cambiar de mesa y Unir mesas; 0 «Dividir» (por diseño sólo Caja y dirección) |
| La dueña      | `/restaurante/mesa-activa?mesa=<id de la mesa 15>` (tecleado)         | «Dividir» presente (1)                                                                                                  |
| La gerente    | `/restaurante/cobro?cuenta=…` (tecleado)                              | «Dividir cuenta», «Descuento», «Cancelar la cuenta»: **sí divide**                                                      |
| **La cajera** | `/restaurante/mesa-activa?mesa=<id de la mesa 15>` (tecleado)         | La app la manda a `/caja`                                                                                               |
| **La cajera** | `/restaurante/cobro?cuenta=…` (tecleado)                              | La app la manda a `/caja`                                                                                               |
| **La cajera** | `/caja` → Pendientes → «Mesa 15 Cuenta…» (el diálogo de cobro)        | 0 textos «Dividir»                                                                                                      |

- **Esperado:** la matriz de permisos deja a la cajera `restaurante.dividir_cuenta`; debería poder dividir desde su pantalla (Caja).
- **Visto:** la cajera no tiene ninguna pantalla donde dividir. **Eso es el hallazgo: la cajera no tiene manera de dividir desde Caja.**
- **Además:** el enlace «Dividir, unir, separar o cambiar de mesa» está en `heredado/components/mesero/MesaActivaView.jsx`, y **ninguna pantalla monta ese componente** (grep sin resultados). A la gerente le funciona sólo si teclea la URL del cobro; en el salón no hay botón que la lleve ahí. En la jornada la cuenta de la mesa 12 la dividió la gerente por la URL, y sus dos partes se cobraron bien (efectivo con 10 % de propina y tarjeta con 15 %).
- **Evidencia:** `mesero-mesa-sin-enlace-para-dividir.png`, `mesero-mesa-activa-tecleada.png`, `cajera-mesa-activa-tecleada.png`, `duena-mesa-activa-tecleada.png`, `cajera-cobro-sin-dividir.png`.

## QA1-6 · baja · Las partes de una cuenta dividida no dicen su mesa

- **Pasos:** mesa 12 con cuenta; la gerente la divide en dos (`/restaurante/cobro?cuenta=…` → Dividir). Mirar la lista de pendientes de Caja.
- **Esperado:** cada parte dice «Mesa 12 · parte 1/2».
- **Visto:** «Mesa — Cuenta $249.00 Código: M12-…-1»: la mesa sale como un guion y sólo el código sugiere de cuál es.
- **Evidencia:** `partes-de-la-cuenta-dividida.png`.
- **Contexto (no es hallazgo, pero afecta al cierre):** la mesa dividida queda en «limpieza» con su venta activa y **bloquea el cierre de caja** («No puedes cerrar caja… Hay mesas pendientes») hasta que el mesero la marca limpia.

## QA1-7 · baja · Precuenta: «Folio null»

- **Pasos (los de `qa1-08-evidencia`):** la dueña abre la mesa 16 con 2 personas, envía un Guacamole y pide la cuenta (las tres llamadas, `abrir-mesa`, `enviar-pedido` y `solicitar-cuenta`, las hice por la API, no por las pantallas); luego entra a `/restaurante/precuenta?cuenta=<id de la cuenta>`.
- **Esperado:** el folio de la cuenta, o nada si aún no tiene.
- **Visto:** el texto de la pantalla trae «Folio null». En la exploración previa también lo vi en la mesa 10 («Folio null · Mesa 10 · 3 personas»).
- **No vi:** si una cuenta abierta y pedida desde las pantallas (y no por la API) sí trae folio. Quien revise esto debe probarlo con la cuenta de una mesa real.
- **Evidencia:** `precuenta-folio-null.png`.

## QA1-8 · media · Registros muestra los cortes con esperado 0 y diferencia 0

- **Pasos:**
  1. La gerente cierra su caja con $10.00 menos de lo esperado (contó $1,163.90; esperado $1,173.90). La cajera cierra el día con $20.00 de más (contó $2,298.40; esperado $2,278.40).
  2. La dueña abre Registros → Cortes. Con «Exportar» baja el CSV; en la misma lista abre «Ver PDF» de cada corte.
- **Esperado:** «Efectivo esperado» $1,173.90 y $2,278.40; «Diferencia» −$10.00 y +$20.00. Es lo que guardó el cierre y lo que dice la hoja del servidor.
- **Visto en el CSV:** Gerente `…,0 (esperado),1163.9 (contado),0 (diferencia)`; Caja `…,0,2298.4,0`. También van en 0 «Costo estimado», «Utilidad bruta», «Margen %» y «Gastos», y «Fecha apertura» sale vacía.
- **Visto en «Ver PDF»:** «DIFERENCIA EFECTIVO $0.00» en los dos cortes.
- **Lo que sí está bien:** folio, fecha de cierre, cajero, número de ventas, Total, Efectivo, Tarjeta, Transferencia y «Efectivo contado».
- **Por qué importa:** el historial de cortes esconde justo el faltante y el sobrante que el cierre sí registró. Por eso no lo pongo en baja. No es alta porque el dato se guardó bien y el PDF que baja el «Cierre del día» lo trae correcto: falla la presentación de Registros.
- **Evidencia:** `cortes-caja-2026-11-03.csv`, `exportacion-registros.txt`, `visor-del-corte-1.png`, `visor-del-corte-2.png`. En la tabla de la bitácora son las filas «NO» de «Efectivo esperado» y «Diferencia».
- **No vi:** el XLSX (sólo el CSV). La exportación se arma en el navegador (`ExportarSeccionButton`/`exportToCSV`), no en `/api/reportes/exportar`; no sé si el XLSX tiene el mismo defecto.

## QA1-9 · media · Registros → «Ver PDF» sin la sección de cancelaciones

- **Pasos:** el día tuvo 6 filas de cancelación (monto $515.00, pérdida $296.00). La cajera cierra el día por el menú «Cierre del día» y el PDF que baja **sí trae** las cancelaciones y la pérdida. Después, Registros → Cortes → «Ver PDF» del mismo corte.
- **Esperado:** el visor muestra «Pérdidas por cancelación» con las mismas filas.
- **Visto:** ni el corte de la gerente ni el de Caja (incluido el «Cierre del día») traen la sección. La comparación «Cortes con la sección Pérdidas por cancelación» dio esperado 1, real 0.
- **Evidencia:** `visor-del-corte-1.png`, `visor-del-corte-2.png`; fila «NO» de la bitácora.
- **Relacionado:** hay dos cierres distintos. El botón «Cierre diario» de `/caja` (PDF `Corte_*.pdf`) y la entrada de menú «Cierre del día» (`/restaurante/cierre-diario-y-arqueo`) producen documentos diferentes, y Registros no refleja el segundo. No sé cuál de los dos es el oficial.
- **No vi:** el texto interno del PDF que baja el botón «Cierre diario» de Caja (sólo comprobé que baja como PDF de más de 20 KB).

## QA1-10 · info · Las purgas de mantenimiento se limitan a 3 por hora

- **Visto:** con «Miguel · Morphiq», en este orden: Ventas → «Limpiar ventas de prueba» (hecha), Registros → «Limpiar cortes» (hecha), Configuración → Mesas → «Eliminar todas» (negada por la cuenta abierta de la mesa 20) y Registros → «Limpiar movimientos de inventario». Esta cuarta dio «Demasiadas operaciones de mantenimiento. Vuelve a intentarlo en 58 minutos» (el código del límite es `intentos: 3, ventanaSegundos: 3600`).
- **Es el diseño**; lo anoto porque en la copia hay que borrar la tabla `limite_tasa` para repetir el día.
- **Parece** que el intento de «Eliminar todas» negado también gastó cuota (fue el tercero), pero no lo aislé: no probé un intento negado solo.
- «Eliminar todas las mesas» se negó con una cuenta abierta en la mesa 20, como debe; las 25 mesas siguieron.

## QA1-11 · baja · SIN CONFIRMAR · una venta cancelada con «43.2% margen»

- **Visto una vez**, en el texto de la pantalla de Ventas durante la exploración: una fila «cancelada Mesa 14 … $25.00 43.2% margen».
- **Esperado:** una venta cancelada no muestra margen.
- **No guardé captura** y el texto no está en la evidencia; **no lo reproduje**. Lo dejo como pista para quien revise Ventas, no como hallazgo firme.

---

## Observaciones que no son hallazgos

- El cupo de cajas abiertas de la sucursal estaba en 1 (con eso «Abrir caja» queda deshabilitado en la segunda caja). Lo subí a 2 por SQL; no hay pantalla para cambiarlo.
- `liberar-mesa` responde 422 `MESA_UNIDA_SIN_DECISION` en una unión hasta que se contesta «¿Separar mesas o dejarlas unidas?»: es el diseño.
- Al separar mesas, sólo se puede cancelar la cuenta de la principal (la de la absorbida da 422).
- Las imágenes de sección del portal salen rotas: la copia no tiene almacenamiento. No es de la app.
- La voz de solicitudes sólo suena para las que llegan con «Solicitudes» abierto (DP-9.3). Una vez creí que fallaba y era el orden de mi guion.
- La cámara simulada falló una vez en unas ocho corridas (no la reproduje; el spec 05 lleva `retries: 1`).
- Tickets: en las 9 cobradas, el ticket en pantalla trae folio, venta y propina (no hubo anotaciones `ticket_dudoso`).

## Lo que no pude probar

Está en la sección 6 de la bitácora: leer un QR real con la cámara, impresoras, sonido real, XLSX, texto interno del PDF de «Cierre diario» de Caja, teléfono de cocina por enlace, dos tabletas pulsando a la vez, platillos por kilo, descuentos y esquemas de propina, «Eliminar todas las mesas» y «Reiniciar sistema» de verdad, y la cuarta purga.

# Hallazgos de QA-2 · jornada del 7 de noviembre de 2026 (DP-14, ronda 2)

Dos copias desechables de `don-poncho`, hechas con la exportación de producción del 7-11 (posterior al PR #10). Cada una tiene el cupo de cajas en 2, el motivo «Por cancelación» y PIN de prueba que sólo valen ahí (en `_PRIVADO\qa-dp14-a` y `\qa-dp14-b`). La app compilada es de `2c0f5ad`:

- QA-A, caja, dinero y cocina: `qa_dp14` en el 3261.
- QA-B, usuarios, mesas y portal: `qa_dp14_b`, con su propia app local.

Los hicieron dos agentes Sonnet en sus worktrees, sin tocar el código. El detalle está en [`HALLAZGOS-QA2-a.md`](HALLAZGOS-QA2-a.md) y [`HALLAZGOS-QA2-b.md`](HALLAZGOS-QA2-b.md); las bitácoras, en [`JORNADA-2026-11-07.md`](JORNADA-2026-11-07.md).

**Resultado:**

- Cero bloqueantes y cero medios.
- QA-A cuadró los cortes de las dos cajas y el Cierre del día al centavo: 21 comparaciones, 0 diferencias.
- En las dos copias, las 34 consultas de violación de `consultas-qa2.sql` dieron 0 filas.

| Id     | Gravedad            | Qué                                                                                           | Estado                                                                                                                                                                                |
| ------ | ------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA2-A1 | baja                | «Quitar un platillo» dice «0.25 × Barbacoa de horno», no «¼ kg»                               | **Arreglado.** `descripcionDelRenglon` usa el formateador único del peso: «Barbacoa de horno · ¼ kg». Prueba en rojo antes y 2 mutantes.                                              |
| QA2-A2 | baja                | Cobrar las partes de una cuenta dividida deja la mesa en «Limpieza» y el cierre la pide libre | **Por diseño.** La mesa cobrada pasa a limpieza (DP-D66) y el diálogo del cierre trae «Marcar libre» (DP-14.6).                                                                       |
| QA2-A3 | baja                | Tras aplicar un descuento, el cobro vuelve a pedir la propina que ya se había elegido         | **Arreglado.** Al releer la cuenta se conserva la propina elegida en la caja; el porcentaje se recalcula sobre el total nuevo (`propinaAlReleer`). Prueba en rojo antes y 4 mutantes. |
| QA2-A4 | info                | El renombrado de una caja está en la auditoría pero no en Registros                           | Anotado: Registros no tiene pestaña de cambios de configuración.                                                                                                                      |
| QA2-A5 | info, sin confirmar | Registros dice «9 ventas» arriba y «Ventas (13)» en la pestaña                                | Anotado: la pestaña cuenta también las canceladas y la dividida.                                                                                                                      |
| QA2-B1 | info                | Dos clics forzados casi a la vez: sólo se abre un diálogo                                     | Es un límite del gesto: con un dedo real, el velo del primero tapa el segundo; en la misma pasada se encolan y no se pierde ninguno.                                                  |
| QA2-B2 | info                | «Nueva mesa» no reusa el número de una mesa quitada                                           | Anotado (es de antes).                                                                                                                                                                |
| QA2-B3 | info                | No hay pantalla para crear una zona, y el puente deja repetir el nombre                       | Anotado (es de antes).                                                                                                                                                                |
| QA2-B4 | info                | «La copia traía una caja abierta»                                                             | **Descartado:** es de la demo `demo-ferreteria-la-broca` que siembran las migraciones, no de Don Poncho.                                                                              |

## QA-2 · ronda 2 (07-11-2026, con lo arreglado)

Las specs de QA-A del 01 al 06 se corrieron sobre una tercera copia nueva, `qa_dp14_c` (3263), con la app que trae los arreglos de QA2-A1 y QA2-A3: **57 de 58 chequeos en SÍ.**

- **Arreglos comprobados:**
  - «la lista dice el peso como ¼ kg» (QA2-A1);
  - «tras aplicar el descuento, el cobro NO vuelve a pedir la propina ya elegida» (QA2-A3);
  - el ticket de la mesa 2 dice TOTAL $320.76, con la propina del 10 % sobre el total con descuento.
- **El único NO es de la spec:** leyó la reimpresión desde Ventas mientras todavía decía «Cargando ticket…». La reimpresión la cubre `ticket-con-descuento`, que pasó.
- **Fallas en cascada:** después de esa parada, el cobro de la mesa 5 no ocurrió. Por eso tres pasos de la jornada (otra caja ya cobró, los totales del cierre y sus cancelaciones) no encontraron el estado que esperaban. No son defectos confirmados: lo quitado y su cobro los cubren `quitado-en-la-caja` y `barbacoa-por-kilo`, que pasaron con este código.
