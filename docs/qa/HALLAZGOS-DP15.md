# Hallazgos del QA de DP-15 (08-11-2026)

Dos agentes Sonnet sobre copias de la base propia: **QA-J**, la jornada completa con dos cajas
(`JORNADA-2026-11-08.md`), y **QA-D**, los aparatos reales emulados (`APARATOS-2026-11-08.md`).
Ningún PIN aparece aquí.

## Estado

| Id            | Gravedad       | Qué                                                                                 | Estado                                                                                                                                                                 |
| ------------- | -------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D H-01        | bloqueante     | El ticket impreso salía cortado por la izquierda (58 y 80 mm)                       | **Arreglado** (`e3f85f9`): el minificador fundía `translate: none` dentro de `transform`; ahora va con `var()` y una prueba pasa el CSS real por el mismo minificador. |
| J-H1          | medio          | No se podía nombrar «Caja 1» / «Caja 2»: 25 aparatos dormidos ya se llamaban así    | **Arreglado** (`7d3db34`): el nombre de un aparato que nunca abrió caja queda libre («Aparato …»), con auditoría.                                                      |
| J-H3          | medio          | La comanda «Cuenta cobrada» que la estación terminaba se quedaba en «Listos»        | **Arreglado** (`fc45004`): lo listo de una cuenta pagada se da por entregado.                                                                                          |
| J-H4          | medio          | La precuenta del mesero se imprimía sin rastro (`precuentas_impresas` en 0)         | **Arreglado** (`9910ef1`): se cuenta en el servidor antes de imprimir.                                                                                                 |
| J-H6          | medio          | El PDF del Cierre del día resumía sólo la última caja                               | **Arreglado** (`58d516f`): «Ventas del día · todas las cajas» en el Cierre; el resumen dice «de esta caja».                                                            |
| J-H7          | medio          | «Fondo esperado apertura» incluía las entradas de cambio                            | **Arreglado** (`cede312`): la entrada sólo deja su movimiento.                                                                                                         |
| J-H2 · D H-02 | mejora · medio | El menú del portal en lista no marcaba «Agotado hoy»                                | **Arreglado** (`fefb5b3`).                                                                                                                                             |
| D H-03        | mejora         | Faltaba `apple-mobile-web-app-capable`                                              | **Arreglado** (`9dacce9`).                                                                                                                                             |
| D H-06        | medio          | El agotado vuelve a los 23 s en el mesero                                           | Dentro de los 30 s pedidos; sin cambio.                                                                                                                                |
| J-H5          | mejora         | Las mesas de cuentas divididas quedan en «Limpieza»                                 | Es el diseño (DP-D66, «Marcar libre»).                                                                                                                                 |
| J-H8          | mejora         | «Dividir cuenta» sin «partes iguales»                                               | Para después.                                                                                                                                                          |
| D H-04        | mejora         | `@page size: 58mm auto` no es válido (Chromium usa la hoja de la impresora)         | Para después; se confirma con la impresora real del sábado.                                                                                                            |
| D H-05        | mejora         | Imágenes de categoría con la URL absoluta de producción (rotas en la copia)         | Sólo en las copias; para después.                                                                                                                                      |
| D H-07        | mejora         | En el celular el menú tapa «Mesa N» y «Historial» de Caja se corta a 360 px         | Para después (el rediseño queda fuera de este encargo).                                                                                                                |
| D H-08, H-10  | mejora         | Almacén cae en Recetas; la caja abierta en otro aparato pide «Traer esta caja aquí» | Es el diseño.                                                                                                                                                          |
| D H-09        | —              | Una entrada en WebKit se interrumpió una vez en la prueba de 8 a la vez             | Artefacto de la herramienta; no se repitió.                                                                                                                            |

La ronda 2 (copia nueva, con todo lo arreglado) está en `RONDA2-2026-11-08.md`.

---

# Hallazgos de la jornada completa (QA-J, DP-15) · 2026-11-08

Copia `qa_dp15_j` + app :32741. Evidencia en `D:\mpos-tmp\dp15-qa\j\` (capturas `.png`, `pdf-corte-1.txt` y `pdf-corte-2.txt` con el texto de los PDF de corte, `consultas-qa2-salida.txt`, `JORNADA-2026-11-08.md` con el registro y el cuadre).

Resumen: **ningún bloqueante**. El dinero cuadró al centavo, las 34 consultas de violación dieron 0 filas y las novedades de DP-15 funcionan (ver al final «Lo que sí funcionó»). 8 hallazgos: 4 medios, 4 mejoras.

| Id   | Gravedad | Resumen                                                                                                                          |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| J-H1 | medio    | No se pueden nombrar «Caja 1» / «Caja 2»: terminales dormidas ya se llaman así y no hay forma de liberarlas desde la pantalla    |
| J-H2 | mejora   | El portal (lista) no marca «Agotado hoy» en el renglón del platillo agotado                                                      |
| J-H3 | medio    | La comanda «Cuenta cobrada» que Bebidas/Cocina despacha queda para siempre en «Listos» sin botón                                 |
| J-H4 | medio    | La PRE-CUENTA del mesero se imprime sin dejar rastro (contador de copias en 0, nunca sale «reimpresión»)                         |
| J-H5 | mejora   | Las mesas de cuentas divididas quedan en «Limpieza» y bloquean el cierre de caja                                                 |
| J-H6 | medio    | El PDF del «Cierre del día» mezcla alcances: resumen de ventas sólo de la última caja, descuentos y cancelaciones de todo el día |
| J-H7 | medio    | «Fondo esperado apertura» del PDF de corte incluye las entradas de cambio                                                        |
| J-H8 | mejora   | «Dividir la cuenta» sólo reparte por renglones (no hay «partes iguales»)                                                         |

---

## J-H1 · medio · «Caja 1» y «Caja 2» no se pueden poner: nombres tomados por terminales dormidas

- **Pasos:** abrir las dos cajas (PC y tableta). Dueño → Configuración → Caja → «El nombre de cada caja». Escribir «Caja 1» en la caja de la PC y Guardar.
- **Esperado:** quedar nombrada «Caja 1» (y «Caja 2» la otra), como en el encargo y como la dueña la querría llamar.
- **Visto:** «Ya hay otra caja que se llama «Caja 1». Elige otro nombre.» (HTTP 422 `/api/caja/nombrar-terminal`). La base (copia de la de Don Poncho) trae 28 terminales de Don Poncho; cada navegador que entra se dio de alta como «Caja N» (Caja 1 … Caja 25). La pantalla de DP-15 ya sólo lista las que abrieron caja (2), así que **no hay manera de ver ni renombrar las dormidas**, y la comprobación de nombre repetido sí las cuenta (`packages/app/src/caja/terminales.ts`, comando `nombrarTerminal`, consulta `nombre_libre`: todas las terminales de la sucursal, sin filtrar por abierta/enrolada). Para seguir tuve que renombrar por SQL en la copia desechable las terminales dormidas «Caja 1» y «Caja 2».
- **Por qué importa el sábado:** si producción tiene las mismas terminales de alta, la dueña no podrá poner «Caja 1»/«Caja 2» (justo los nombres naturales) y no sabrá por qué.
- **Evidencia:** `j01-nombre-repetido-aviso.png`, `j01-configuracion-caja.png` (muestra sólo las 2 abiertas), `j01-cajas-nombradas.png` (ya con las dormidas renombradas). Propuesta: que la comprobación de nombre repetido sólo mire terminales con sesión de caja (las que la pantalla muestra) o que el dueño pueda ver/archivar las demás.

## J-H2 · mejora · El portal no marca «Agotado hoy» en la lista de platillos

- **Pasos:** Cocina → Agotados → marcar «Quesadilla». Un comensal (Android, mesa 8, QR) abre el portal.
- **Esperado:** el platillo agotado se ve agotado (el mesero lo ve: «Agotado hoy», `aria-disabled`).
- **Visto:** la API del portal ya manda `agotado:true`, pero el renglón sigue con su botón «+ Agregar» normal y sin distintivo; sólo al tocarlo dice «Quesadilla se agotó por hoy. Pregúntale a tu mesero qué más hay.» y no la agrega. El distintivo existe en la tarjeta con imagen (`apps/web/heredado/pages/PortalCliente.jsx:847`) pero este menú, en modo lista, no lo pinta. No se pierde nada (el servidor lo rechaza), pero el comensal se entera hasta que lo toca.
- **Evidencia:** `j04-portal-quesadilla-agotada.png`, `scratch-portal-quesadilla.png`.

## J-H3 · medio · La comanda «Cuenta cobrada» queda atorada en «Listos»

- **Pasos:** Mesa 1: mole (Cocina) + Coca (Bebidas); Cocina deja el mole «Listo», Bebidas no toca la Coca. El mesero pide la cuenta sin entregar, la Caja cobra. Después Bebidas toca «Preparar» y «Listo» a la Coca (que sigue en su estación con la marca «Cuenta cobrada»).
- **Esperado:** poder cerrar esa comanda (la mesa ya se cobró y quedó libre) y que salga de la pantalla.
- **Visto:** la tarjeta se queda en la columna «Listos» con «Cuenta cobrada · Esperando que el mesero recoja», sin ningún botón; nadie la puede entregar (la mesa está libre, no hay diálogo de mesa). Sigue ahí 9 min después y **tras hacer el Cierre del día** («1 pedido(s) activos» en Bebidas). Cocina sí quedó en 0 (lo listo sale al cobrar: bien). Por diseño «no se cierra sola» (`platos-de-la-estacion.ts`), pero una vez preparada ya no hay decisión que tomar.
- **Evidencia:** `j06-bebidas-cuenta-cobrada.png` (la marca, antes de despachar), `j10-bebidas-tras-el-cierre.png` (atorada después del cierre), libro: chequeo 13b.3 en NO. Propuesta: que al pasar a «Listo» una comanda de cuenta cobrada se entregue sola, o que la tarjeta tenga «Quitar».

## J-H4 · medio · La PRE-CUENTA del mesero se imprime sin dejar rastro

- **Pasos:** Mesa 2: el mesero (Android 412) pide la cuenta, sale «PRE-CUENTA … CÓDIGO PARA CAJA M02-9628», toca «Imprimir» (se llama a `window.print`), la cierra y la reabre.
- **Esperado:** `ordenes.precuentas_impresas` sube y las hojas siguientes salen marcadas como «reimpresión» (`packages/app/src/restaurante/precuenta.ts`: «una impresión que no deja rastro es justo la que permite cobrar la hoja vieja»).
- **Visto:** `precuentas_impresas = 0` y `precuenta_impresa_en` vacío después de imprimir. El comando `restaurante.imprimir_precuenta` sólo lo llama `apps/web/src/restaurante/Precuenta.tsx`, y esa pantalla (`/restaurante/precuenta`) sólo dice «Abre la mesa en el mapa y pide la precuenta desde ahí»; el diálogo heredado del mesero (`Mesero.jsx`, `PreCuentaTicket.jsx`) imprime sin contarla. En la mesa del mesero tampoco hay botón de «reimprimir precuenta» una vez cerrada (botones: Quitar un platillo, Cancelar la cuenta, carta). El ticket sí se reimprime bien desde Ventas (13.3 SÍ).
- **Evidencia:** `j07-precuenta.png`, libro 13.1 (NO) y asiento «precuentas_impresas de la mesa 2 | 0».

## J-H5 · mejora · Las mesas de cuentas divididas quedan en «Limpieza» y frenan el cierre

- **Pasos:** dividir las mesas 7 y 8 (renglones) y cobrar todas sus partes (en las dos cajas). Intentar «Cierre diario».
- **Esperado:** la mesa vuelve a «libre» como las demás (las 12 cuentas sin dividir quedaron libres solas).
- **Visto:** las mesas 7 y 8 quedaron en «Limpieza» y el cierre contestó «No puedes cerrar caja. Hay mesas pendientes … 7 Mesa 7 Estado: Limpieza · Marcar libre», hasta que alguien las marcó libres (el diálogo lo permite en un toque). Es lo mismo que DP-14 llamó QA2-A-limpieza; sigue igual (DP-D66: «pasa a limpieza si alguna se cobró»). Sólo molesta al cerrar con prisa.
- **Evidencia:** `j08-cierre-negado-limpieza.png`.

## J-H6 · medio · El PDF del «Cierre del día» mezcla alcances y no trae las ventas del día

- **Pasos:** Caja 2 cierra primero («Cerrar esta caja»); Caja 1 hace el «Cierre del día» (menú). Registros → Ver PDF del folio 2.
- **Esperado:** que un documento que se llama «Cierre del día» diga las ventas del día (o que diga clarísimo qué alcance tiene su resumen).
- **Visto:** «TOTAL VENTAS $2,476.75 · 9 tickets · Efectivo $2,011.00 · Tarjeta $333.75 · Transferencia $132.00 · propinas $252.76» = sólo Caja 1. Las ventas de Caja 2 ($1,600.40, 5 tickets, propinas $74.75) no aparecen. En cambio «Descuentos del día $90.60» (de una venta de Caja 2) y las cancelaciones sí son de todo el día (con la nota «Cierre del día: todas las de la sucursal…»). Es lo que DP-D50 eligió («cada caja cuenta sus cuentas»), y cada cifra cuadra con su caja al centavo; pero el resumen no lo dice y la dueña que sólo lee el Cierre del día cree que el día vendió $2,476.75 en lugar de $4,077.15. Hoy el total del día sólo sale sumando los dos cortes (o en Ventas → «Cobrado»).
- **Evidencia:** `pdf-corte-2.txt` (folio 2), `pdf-corte-1.txt` (Caja 2), `j10-registros-pdf-2.png`; cuadre en `JORNADA-2026-11-08.md`.

## J-H7 · medio · «Fondo esperado apertura» incluye las entradas de cambio

- **Pasos:** abrir Caja 1 con $1,500.00 (no había cierre previo), registrar una entrada de cambio de $200.00 «Del dueño» (Caja → Movimientos), cerrar y ver el PDF.
- **Esperado:** «Fondo esperado apertura» = lo que se esperaba AL ABRIR (aquí $1,500.00 o «—»); la entrada va aparte (`apps/web/src/corte/hoja.ts:437` dice «la diferencia de apertura se mide contra lo que se esperaba AL ABRIR» y resta las entradas).
- **Visto:** el PDF dice «FONDO ESPERADO APERTURA $1,700.00 · EFECTIVO INICIAL CONTADO $1,500.00 · DIFERENCIA APERTURA —» (Caja 2: $900.00 contra $800.00 contados, con $100.00 de entrada). Parece que la cajera abrió $200 corta. La base: `fondo_esperado_centavos` 170000 / 90000 (sube con la entrada, `entrada-cambio.ts`) y el PDF heredado lee la columna cruda (`packages/app/src/puente/mapa.ts:1278` → `CorteTicket.jsx:239`) sin restar las entradas que sí resta `hoja.ts`. El efectivo esperado y la diferencia de efectivo SÍ están bien ($3,583.85, +$20.00).
- **Evidencia:** `pdf-corte-1.txt` («FONDO ESPERADO APERTURA $900.00 … EFECTIVO INICIAL CONTADO $800.00»), `pdf-corte-2.txt` ($1,700.00 / $1,500.00), `j10-registros-pdf-2.png`.

## J-H8 · mejora · «Dividir la cuenta» no ofrece «partes iguales»

- **Pasos:** Caja → cobro de una cuenta → «Dividir cuenta».
- **Esperado (encargo: «por renglones o partes iguales»):** una de las dos vías.
- **Visto:** sólo reparte por renglones (botones «Añadir X a la cuenta N»); para partir una cuenta en tres mitades iguales hay que repartir platillo por platillo a mano (con platillos impares no sale igual). Funciona bien (las partes suman la cuenta, cada parte cobra y se imprime con lo suyo): se anota como mejora, no como fallo.
- **Evidencia:** `j05-mesa7-dividir-renglones.png`, `j05-mesa8-dividir-iguales.png`.

---

## Lo que sí funcionó (las novedades de DP-15 y el resto de la jornada)

- **Configuración → Caja** muestra sólo las 2 cajas que abrieron (de 28 terminales), con «Abiertas ahora: 2» (1.c). El renombrado se guarda y la pantalla lo dice (1.d).
- **Mesa con Cocina y Bebidas:** con sólo Cocina lista la mesa sigue en preparación; al terminar Bebidas pasa a «Esperando entrega» (5.1), y también cuando sólo había Cocina y cuando se quita lo último que faltaba (7.2).
- **Al cobrar:** lo «listo» sale de Cocina; lo «nuevo» queda en Bebidas con «Cuenta cobrada» (13b.2; ver J-H3 para lo que pasa después).
- **Quitar el único platillo de una comanda** (limonada) la saca de Bebidas y la comanda queda cancelada; quitar uno ya preparado (tlacoyo) deja pérdida $20.00; cancelar la cuenta completa con tacos listos: monto $237.00, pérdida $190.00 (corte y PDF coinciden).
- **Caja → Movimientos:** retiro y entrada de cambio con motivo en las dos cajas; el efectivo esperado se mueve exactamente lo registrado (11.r/11.e).
- **Agotado del día:** Cocina lo marca; el mesero ve «Agotado hoy» en 1 s (16.2); el portal lo rechaza con aviso (16.3, ver J-H2); al desmarcarlo el mesero lo pide y el envío sale (16.5).
- Portal: iPhone en WebKit, dos Android con carrito compartido (el A y el B ven el mismo carrito de 5 cosas), el mesero confirma en modo mesero; propina del portal (10 %) llega como origen portal y se cobra sin volver a preguntar. Unir 5+6 con cuentas y separar al cobrar; unir y separar vacías 9+10.
- Cobros en efectivo con cambio, tarjeta, transferencia y mixto; descuento 10 % con PIN de la gerente y el de 40 % rechazado por el tope.
- Reimpresión del ticket desde Ventas con folio y totales (13.3).

---

# Hallazgos · QA-D (aparatos) · 2026-11-08

Copia D (`localhost:32742`, base `qa_dp15_d`). Las rutas de evidencia son relativas a `D:\mpos-tmp\dp15-qa\d\`.

## Resumen

| Id   | Hallazgo                                                                                     | Gravedad                               |
| ---- | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| H-01 | El ticket impreso (58 y 80 mm) sale cortado por la izquierda                                 | **Bloqueante**                         |
| H-02 | El portal no enseña «apagado» el platillo agotado                                            | Medio                                  |
| H-03 | Falta `apple-mobile-web-app-capable`                                                         | Mejora                                 |
| H-04 | `@page { size: 58mm auto }` no es válido; Chromium lo ignora                                 | Mejora                                 |
| H-05 | Las imágenes de categoría del portal salen rotas en la copia y sin respaldo                  | Mejora (medio si se cambia de dominio) |
| H-06 | Mesero: el platillo vuelve a los 23 s al desmarcarlo (marcar 12 s); sondeo pesado            | Medio                                  |
| H-07 | Detalles de pantalla móvil: menú encima del título, aviso encima del menú, pestañas cortadas | Mejora                                 |
| H-08 | Almacén cae en «Recetas» solo lectura                                                        | Mejora (por confirmar)                 |
| H-09 | Una entrada del dueño en WebKit se interrumpió en paralelo con 7 más                         | No reproducido (artefacto)             |
| H-10 | Caja de otro aparato: «No hay caja abierta» y hay que traerla                                | Mejora                                 |

## H-01 · El ticket sale cortado por la izquierda al imprimir · BLOQUEANTE

- **Pasos:** Dueño pone «Ancho del papel del ticket» en 58 mm (Configuración → Operación → Datos del negocio) y guarda. Mesero 2 pide la cuenta de la Mesa 8 (3 platillos, $82). En Caja (escritorio 1280x900, caja abierta) se cobra en efectivo sin propina, aparece el ticket y se pulsa «Imprimir». Se deja que la app prepare el documento (`printDocument`: `data-print-mode="thermal"`, `@page`, aislado) y se corre `page.emulateMedia({ media: 'print' })` + `page.pdf({ width: '58mm' })`. Igual con 80 mm en la Mesa 9 (5 platillos, $446).
- **Esperado:** una sola hoja con el ticket completo: negocio, dirección, folio, platillos con su nombre, IVA, total, pago, cambio.
- **Visto:** una hoja, pero el ticket queda corrido hacia la izquierda y se pierde la mitad izquierda. `pdftotext` del 58 mm solo da los importes (`$25.00`, `$30.00`, `$27.00`, `$82.00`...) y fragmentos como «r tu visita!» / «ste ticket»; el 80 mm igual («arbacoa $160.00», «rada $38.00»). Medido en print: caja del ticket `left = -26 mm` (58) y `-36 mm` (80), o sea menos la mitad de su ancho.
- **Causa (por el CSS servido):** el diálogo del ticket trae de Tailwind `translate: -50% -50%` (`translate-x-[-50%] translate-y-[-50%]`). El CSS de aislado (`apps/web/heredado/index.css`, `html[data-print-mode] [data-ruta-impresion]`) trae `transform: none; translate: none`, pero en la hoja compilada que sirve la app (`/_next/static/chunks/*.css`) la regla quedó solo con `transform:translate(0)!important` y **sin `translate:none`**. Ese `translate` individual sigue aplicando. `getComputedStyle` del diálogo, en print: `translate = -50% -50%` aun con `position: static`.
- **Comprobación del arreglo (sin tocar el repo):** añadiendo en la prueba `@media print { html[data-print-mode] [data-ruta-impresion] { translate: none !important } }`, el mismo cobro imprime completo (`p8b-58mm-con-translate-none.pdf`).
- **Evidencia:** `p8-ticket-58mm-mesa8-width.pdf`, `p8-ticket-80mm-mesa9-width.pdf`, `p8b-58mm-sin-arreglo.pdf`, `p8b-58mm-con-translate-none.pdf`, `p8-ticket-58mm-mesa8.png`, `p8.log`, `p8b.js` (muestra `translate=-50% -50%` en la cadena de contenedores).
- **Límite:** es el motor de impresión de Chromium con el CSS real; no se probó en una impresora térmica física ni en Safari. Chrome en Android o escritorio usa el mismo motor, así que conviene confirmarlo con la impresora del sábado antes de la entrega.

## H-02 · El portal no apaga el platillo agotado · MEDIO

- **Pasos:** teléfono con el portal de la Mesa 6 abierto; Cocina marca «Aguacate» en «Agotados»; esperar más de 30 s (el portal relee a +3, +15 y +27 s).
- **Esperado:** el platillo se ve apagado y con «Agotado hoy» (el texto de la pantalla de Cocina dice «Lo que marques ya no se puede pedir hoy (ni el mesero ni desde el QR)»).
- **Visto:** la fila de «Aguacate» no cambia: «Agregar» a todo color, sin etiqueta. Solo al tocarlo sale el aviso «Aguacate se agotó por hoy. Pregúntale a tu mesero qué más hay.» y no agrega. El servidor sí niega (422 `PRODUCTO_AGOTADO`). El estilo «apagado» + «Agotado hoy» existe en la tarjeta de `apps/web/heredado/pages/PortalCliente.jsx:817-850`, pero las filas del menú por botones (`apps/web/src/restaurante/menu-qr/PaginaConBotones.tsx`) no tienen ninguna referencia a `agotado`.
- **Evidencia:** `p5-portal-intento-agotado.png`, `p5-portal-agotado.png`, `p5b.js`, `p5c.js`.

## H-03 · Falta `apple-mobile-web-app-capable` · MEJORA

- **Pasos:** pedir el HTML de `/n/don-poncho/login-pos` y buscar las etiquetas `apple-mobile-web-app-*`.
- **Esperado:** `apple-mobile-web-app-capable=yes` junto a `-title` y `-status-bar-style`.
- **Visto:** hay `-title` («Don Poncho»), `-status-bar-style` y `mobile-web-app-capable`, pero no `apple-mobile-web-app-capable`. Con el manifiesto `display: standalone` iOS 16.4+ abre sin barra; en iOS anteriores a esa versión no comprobado.
- **Evidencia:** HTML de la entrada (`curl`).

## H-04 · `@page { size: 58mm auto }` no es válido · MEJORA

- **Pasos:** misma impresión que H-01 con `page.pdf({ preferCSSPageSize: true })`.
- **Esperado:** hoja de 58 mm de ancho y alto según el ticket.
- **Visto:** hoja A4 (209.9 x 297 mm). `auto` solo es válido como valor único de `size`, no como segundo valor; el navegador descarta la regla. El `@page` lo escribe `paginaDeImpresion` en `apps/web/src/impresion/papel.ts`.
- **Efecto:** con el diálogo de impresión de Chrome, el papel lo decide la impresora elegida; si se «guarda como PDF» sale en A4. Con `size: 58mm 200mm`, o dejando solo el ancho por el diálogo, sería válido.
- **Evidencia:** `p8-ticket-58mm-mesa8-css.pdf`.

## H-05 · Imágenes de categoría rotas en el portal, sin respaldo · MEJORA (medio si cambia el dominio)

- **Pasos:** abrir `/qr/<token>` de cualquier mesa en la copia.
- **Esperado:** imagen de cada categoría, o nada limpio.
- **Visto:** las 8 imágenes (`/menu-qr/01-pa-empezar-y-sopas.webp`… `08-pulques.webp`) están guardadas con la URL absoluta `https://pos-don-poncho.vercel.app/menu-qr/…` y se piden a ese dominio; en la copia fallan y se ve el icono de imagen rota con el texto alternativo, dejando un hueco grande en cada categoría. En la misma app las imágenes existen y responden 200 por `localhost:32742/menu-qr/…`. En producción el dominio coincide y funcionaría; si se entrega con otro dominio, se rompen. Y no hay `onError` que oculte el hueco.
- **Nota:** esto hizo que el navegador de la prueba intentara 8 lecturas de imágenes estáticas al host de producción (solo GET de imágenes públicas, sin tocar nada).
- **Evidencia:** `p4-imagen-categoria-rota.png`, `px17.js`, `p4-B-ve-carrito.png`.

## H-06 · Agotado en la pantalla del mesero: 12 s al marcar, 23 s al desmarcar; sondeo pesado · MEDIO

- **Pasos:** Cocina marca y luego desmarca «Aguacate»; el mesero (Pixel 7) tiene abierta una mesa con el menú de platillos.
- **Esperado:** ≤ 30 s.
- **Visto:** marcar → el mesero lo ve a los 12 s; desmarcar → vuelve a los 23 s. Cumple, pero con poco margen: el sondeo de la pantalla de mesa hace del orden de 20 peticiones (`/api/datos/consultar` y `carrito-de-la-mesa`) en 8 s por aparato (corrida de `p5.js`, no cronometrada con precisión). Con 8 aparatos activos serían ~20 peticiones por segundo; no medido contra Vercel.
- **Evidencia:** `p5.js`, `p5d.js`; el conteo, en la salida de `px5.js` (misma sesión de trabajo).

## H-07 · Detalles de pantalla móvil · MEJORA

- El botón de menú (hamburguesa, arriba a la izquierda) tapa el título «Mesa N» en la pantalla de la mesa del mesero a 412 px: se lee «lesa 4» (`explor-orden.png`, `p5-mesero-confirmar.png`).
- Los avisos rojos (por ejemplo el de «No llegó la respuesta del servidor…» y el de caja cerrada) caen encima de ese menú y del título (`p7-enviar-sin-red.png`, `explor-cuenta-pedida.png`).
- La tira de pestañas de Caja a 360 px corta «Historial» sin indicar que se desliza (`p1-android360-Caja.png`).
- El inicio del dueño en teléfono muestra dos botones de menú a la vez: el negro arriba y el café abajo a la derecha (`p2-Due_o_Don_Poncho.png`).
- En el portal, el botón flotante «Atención» tapa el nombre y parte de los platillos del lado izquierdo (`p4-B-ve-carrito.png`).

## H-08 · Almacén cae en «Recetas» solo lectura · MEJORA (por confirmar)

- **Pasos:** entrar como Almacén en cualquier aparato.
- **Visto:** cae en `/recetas` («Solo lectura», «0 ingredientes» en cada platillo) y no en inventario. No sé si es lo previsto: `ROLE_HOME_ROUTES` (`apps/web/heredado/lib/constants.js:153`) no lista a este puesto y no comprobé la matriz de permisos.
- **Evidencia:** `p1-android360-Almac_n.png`.

## H-09 · Entrada del dueño interrumpida en WebKit con 8 en paralelo · NO REPRODUCIDO

- **Pasos:** los 8 aparatos entran a la vez (`p2.js`); el iPhone del dueño.
- **Visto:** `/api/auth/entrar` contestó 200 y la pantalla quedó bien, pero el guion recibió «Frame load interrupted» de WebKit. 2 repeticiones solo y 1 con el Gerente: OK en 2.0 s. Parece de la herramienta (navegación de Playwright WebKit al saltar de página), no de la app; lo anoto por transparencia.
- **Evidencia:** `p2.log`, `p2b.js`.

## H-10 · La caja abierta en otro aparato no cuenta en el aparato nuevo · MEJORA

- **Pasos:** el cajero abre caja en un aparato; entra en un contexto limpio (otro navegador, datos borrados) y mira «Caja».
- **Visto:** «No hay caja abierta en este aparato» y al cobrar «No hay caja abierta. Abre caja para cobrar.» hasta pulsar «Traer esta caja aquí» y «Sí, traerla». Funciona y avisa; si el cajero limpia datos o cambia de navegador en plena jornada, tiene que saber ese paso. Conviene decirlo en la capacitación del sábado.
- **Evidencia:** `p8-traer-caja.png`, `p8.log`.

## Lo que se comprobó y está bien

- 54 de 54 entradas (9 puestos × 6 aparatos) sin desborde ni controles fuera de pantalla; ocho aparatos a la vez sin bloqueo (0 respuestas 429 ni 423); sesiones independientes.
- Portal: precios, opciones y peso; carrito compartido en ~1 s; una mesa no ve otra; «Llamar a mi mesero», «Necesito ayuda» y «Pedir cuenta» llegan solo al mesero de esa mesa.
- Agotado: el servidor niega por el portal y por el mesero (422 `PRODUCTO_AGOTADO`), el mesero lo ve a los 12 s con la tarjeta desactivada, y el portal relee cada 12 s.
- Red lenta (25 s a la pantalla del puesto; 1.7 s abrir mesa; 1.0 s comanda en Cocina) y red que se cae (aviso claro, sin duplicar, el pedido se recupera tras recargar).
- Manifiesto, íconos y `apple-touch-icon`.

## Notas de la corrida

- El repositorio no se modificó desde esta sesión. En el árbol `D:\MIS PROYECTOS\MORPHIQ POS\POS Don Poncho\.claude\worktrees\dp15-codigo`, `git status` mostraba al final 3 archivos modificados (`apps/web/src/portal/carrito-compartido/api-del-carrito.ts`, `apps/web/src/restaurante/CancelarDelMesero.tsx`, `scripts/verificar-acople.mjs`) que yo no toqué: estaba limpio al empezar, así que los cambió otra sesión durante la corrida.
- Escribí solo en la base `qa_dp15_d` (mesas abiertas, pedidos, caja abierta, ancho del ticket en 80 al final) y en `D:\mpos-tmp\dp15-qa\`. No toqué la copia J (32741), ni producción, ni `_PRIVADO`, ni Vercel. Dos corridas de `p6.js` se interrumpieron a mano antes de la buena; quedó Mesa 1 y Mesa 3 abiertas por eso.
- El servidor 32742 respondió durante toda la prueba; no lo reinicié.
