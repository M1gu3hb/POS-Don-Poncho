# Entrega · POS Don Poncho

Para Miguel y para el día de la instalación (sábado 14-11-2026). Sin PIN ni contraseñas aquí: los
PIN de cada persona están en `..\_PRIVADO\PINES-DON-PONCHO.md` (fuera del repositorio, que es
público).

## Los links

| Para quién | Link |
| --- | --- |
| El personal (todos los puestos) | <https://pos-don-poncho.vercel.app/n/don-poncho/login-pos> (también sirve <https://pos-don-poncho.vercel.app/login-pos>) |
| Los comensales | El QR impreso de cada mesa (abre el menú de ESA mesa en el teléfono, sin instalar nada ni crear cuenta) |

- **Los QR de las mesas** se ven e imprimen en Portal QR → «Mesas QR» (uno por mesa, o el PDF con
  todos). Cada QR lleva el código de su mesa; si un QR se pierde o se copia, «Rotar QR» de esa mesa
  invalida el viejo.
- **El teléfono de cocina** (opcional): en Cocina → «Conectar teléfono», se escanea el QR con el
  teléfono que se queda en la estación. Vale por el día; generar otro apaga el anterior.

## Cómo se abre en cada aparato

- **Android (Chrome):** abrir el link del personal. Para dejarlo como app: menú ⋮ → «Agregar a la
  pantalla principal» (o «Instalar app»). Queda con el ícono y el nombre «Don Poncho» y abre a
  pantalla completa.
- **iPhone (Safari):** abrir el link en Safari → botón Compartir → «Agregar a inicio». Queda con el
  ícono de Don Poncho y el nombre «Don Poncho». **Ojo:** la app de «Agregar a inicio» tiene su propia
  sesión, distinta de la de Safari: la primera vez que se abre desde el ícono hay que entrar otra vez
  con el PIN (es del iPhone, no un error).
- **La PC de la caja:** abrir el link en Chrome o Edge y guardarlo en favoritos (o «Instalar» desde la
  barra de direcciones). Para imprimir el ticket: el botón «Imprimir» abre el diálogo del navegador;
  elegir la impresora térmica y, la primera vez, quitar márgenes y encabezados del navegador.
- **El ancho del ticket** (58 u 80 mm) se elige una vez en Configuración → Datos del negocio → «Ancho
  del papel del ticket», según el rollo de la impresora.
- **Varias personas a la vez:** cada aparato tiene su propia sesión. Un aparato compartido (la tableta
  de los meseros) se pasa de persona con «Salir» y el PIN de la siguiente.

## Las personas y su puesto

| Usuario | Puesto | Cae en |
| --- | --- | --- |
| Dueño Don Poncho | Dueño | Tablero (ve todo) |
| Miguel · Morphiq | Dueño (cuenta de soporte de Morphiq) | Tablero |
| Gerente | Gerente | Tablero (sin «Caja», «Descuentos», «Datos» ni «Integraciones» de Configuración) |
| Caja | Caja | Caja |
| Caja 2 | Caja | Caja |
| Mesero 1 | Mesero | Mapa de mesas |
| Mesero 2 | Mesero | Mapa de mesas |
| Cocina | Cocina (estación Cocina) | Cocina |
| Bebidas | Cocina (estación Bebidas) | Cocina |
| Almacén | Almacén | Recetas (y su menú de almacén) |

- Los nombres reales los ponen ellos en Configuración → Usuarios POS (el dueño o el administrador);
  ahí también se cambia el PIN de cada quien, se da de alta a alguien nuevo y se desactiva a quien se
  va.
- Los PIN están en `..\_PRIVADO\PINES-DON-PONCHO.md`. Cada persona puede cambiar el suyo después.

## El primer turno, paso a paso

1. **Nombrar las dos cajas.** En la PC de la caja, entra «Caja» y toca «Abrir caja» con el fondo. Luego
   el dueño (en ese mismo aparato o en otro) entra a Configuración → Caja → «El nombre de cada caja»: la
   que dice «con la caja abierta» es la PC; ponle «Caja 1». Repite en la tableta con «Caja 2» → «Caja 2».
   Ahí sólo aparecen los aparatos que alguna vez abrieron caja (los teléfonos de los meseros y la
   tableta de cocina no). Desde ahí, los avisos dicen «Ya se cobró en Caja 1» y no un número.
2. **Abrir caja** en cada aparato de caja, con el fondo contado.
3. **La primera venta:** el mesero toca una mesa libre → «Abrir mesa» con las personas → agrega los
   platillos (la barbacoa por kilo: ¼, ½ o 1 kg) → «Enviar a Cocina». La Cocina (y Bebidas) lo ven,
   tocan «Preparar» y «Listo»; cuando todas las estaciones terminan, la mesa pasa a «Esperando
   entrega»; el mesero entrega y toca «Solicitar cuenta». En Caja,
   la cuenta aparece en «Pendientes»: se elige la propina, el método (efectivo con su cambio, tarjeta,
   transferencia o mixto) y «Cobrar»; sale el ticket.
4. **Durante el día:** lo que se acabó se marca en Cocina → «Agotados» (el mesero y el QR dejan de
   ofrecerlo; mañana vuelve solo). Los retiros de efectivo (pago a un proveedor), las entradas de cambio
   y el corte de turno se registran en Caja → «Movimientos», con su motivo.
5. **El corte:** en cada caja, «Corte de caja» con el efectivo contado. Si la otra caja sigue abierta,
   el cierre lo avisa y cierra sólo la de ese aparato.
6. **El Cierre del día:** con la última caja. Antes, ninguna mesa puede quedar con cuenta abierta (el
   cierre lo dice y lleva al mapa). Sale el documento del día; se guarda en PDF y queda en Registros →
   Cortes.

## Cómo se usa lo nuevo (DP-16 a DP-18)

### Para llevar (en la Caja)

1. En Caja, el botón grande **«Para llevar»**: se arma el pedido como el del mesero (categorías,
   búsqueda, opciones, notas, la barbacoa por kilo) y, si se quiere, el nombre del cliente.
2. **«Cobrar»** abre el cobro de siempre (métodos, descuento con PIN, propina, ticket). Al cobrar, el
   pedido recibe su **número del día** («Pedido para llevar 3 · Don Beto», empieza en 1 cada día) y
   sale a la cocina. Si se cancela el cobro, a la cocina no sale nada y el pedido vuelve a la pantalla.
3. Cuando la cocina lo termina, la Caja lo enseña arriba en **«Para llevar de hoy»** (suena y avisa una
   vez) con su botón **«Entregado»**. Lo listo de un pedido para llevar NO se entrega solo: alguien lo
   tiene que dar al cliente. Uno cobrado antes de medianoche y listo después sigue en la lista, marcado
   «de ayer», hasta que se toca «Entregado».
4. El corte y el Cierre del día separan **mesas y para llevar**; Registros filtra por canal y el CSV
   trae el canal y el nombre del pedido.

### Las opciones con precio (Productos → el platillo → «Opciones»)

- Cada opción puede **sumar o restar** («Queso +$15», «Sin crema −$5»). En lo que va por pieza se cobra
  por pieza; en lo que va por peso o por porción, una vez por renglón (½ kg con tortillas de harina =
  ½ kg + $20).
- Los grupos son una biblioteca: uno se reusa en varios platillos; si se cambia, avisa que aplica a
  todos. «Elige una» o «varias» (con mínimo y máximo), obligatorio o no.
- **Una opción que resta no puede dejar el platillo en $0 o menos:** el editor no deja guardarla y el
  servidor tampoco (si el precio del platillo baja después, esa combinación no se vende).
- Lo que va por peso puede venderse **«sólo en estas presentaciones»** (¼, ½, 1 kg).
- Se ven en el mesero, la Caja, el portal, la comanda (aparte de la nota), el ticket y el corte
  («Opciones vendidas · cuánto sumaron»).

### El retiro con PIN de gerente

- **Configuración → Caja → «Pedir PIN de gerente en retiros mayores a $____»** (vacío no pide nada; un
  monto razonable: $500.00). La cajera registra el retiro en Caja → «Movimientos»; si pasa del monto,
  la gerente teclea su PIN ahí mismo. El PIN se gasta una vez y queda en el corte quién autorizó.

### El teléfono de cocina

- En la pantalla de **Cocina → «Conectar teléfono»**, se escanea el QR con el teléfono que se queda en
  la estación (vale por el día; generar otro apaga el anterior).
- Enseña **todas las comandas activas** en un carrusel (se desliza de lado; con más de 8 dice «3 de
  16»); arriba la tira de mesas por estado (tocar una lleva a su comanda); abajo **Preparar** y
  **Listo** grandes, que actúan sobre la comanda a la vista; vibra y avisa por voz al llegar una nueva.

### «Personalizar menú» y el modo del menú (Portal QR)

- **Portal QR → «Personalizar menú»**: todo el menú del comensal en un solo lugar, con la **vista
  previa del teléfono** al lado (cambia mientras se edita):
  - **por platillo:** la foto, la descripción corta (hasta 140 letras) y el fondo de la tarjeta (para
    los que no tienen foto); «Guardar platillo»;
  - **del menú:** el mensaje de bienvenida y los colores, y el **orden de las secciones** (↑ ↓, «Guardar
    orden»).
- **Portal QR → Configuración → «Cómo se ve el menú»:** Menú digital (tarjetas con foto o fondo), A la
  carta (lista con letra grande), Páginas subidas o A la carta y páginas. Lo de «Personalizar menú» se
  ve en «Menú digital» y en «A la carta».

### Dos cajas y el traslado

- **Configuración → Caja → «Cajas abiertas a la vez»: 1 o 2.**
- La pantalla de **Caja enseña siempre las cajas abiertas en otros aparatos** («Caja 2 · abierta por
  Ana desde las 10:14»), aunque este aparato tenga la suya. Si este aparato no tiene caja:
  - **«Trasladar aquí»** trae esa caja a este aparato (pide confirmar: el otro se queda sin caja), para
    cobrar y hacer su corte aquí;
  - **«Abrir otra caja aquí (2 de 2)»** si todavía cabe otra; si no cabe, lo dice.
- Se actualiza sola cada pocos segundos, al volver a la pestaña y al cambiar el cupo.
- Cada caja hace su corte en su aparato; el **Cierre del día** se hace con la última.

### El almacén y las compras (DP-18, lunes)

- **Una sola vez, antes de la primera compra o del primer inventario:** el dueño o la gerente abre
  Compras (o Inventario) y, si dice «Esta sucursal todavía no tiene almacén», toca **«Crear el almacén
  principal»**. Sin almacén no se pueden recibir compras ni guardar el inventario.
- **Una compra en «Efectivo» sale del cajón de la caja abierta**, como un gasto en efectivo: el corte
  de la noche ya no espera ese dinero. Si la compra se pagó con dinero que NO salió de la caja (de la
  bolsa del dueño, por ejemplo), elige **Transferencia** o **Tarjeta** en «Método de pago»: el diálogo
  empieza en Efectivo. Sin una caja abierta, la compra en efectivo no se registra.
- **Un platillo por peso o por porción con «Ingrediente base»** (Recetas) baja ese insumo al cobrarse:
  la barbacoa por kilo baja sus kilos. Si el insumo no tiene existencias, el cobro NO se frena (lo que
  pasó por cocina ya se sirvió): el insumo queda en negativo y el conteo lo enseña. Para que el
  inventario diga la verdad, carga su inventario inicial o regístralo con una compra.

## La revisión de Miguel antes del sábado (10 minutos, con sus PIN)

Lo que necesita un PIN real en producción no lo prueba nadie más que Miguel: los PIN están en
`..\_PRIVADO\PINES-DON-PONCHO.md`. Sin abrir caja ni cobrar:

1. En el teléfono, abrir el link del personal y entrar como «Mesero 1». Debe caer en el mapa de mesas.
2. En la PC, entrar como «Cocina»; en una tableta (u otro teléfono), como «Dueño Don Poncho».
3. En el teléfono, «Salir» y entrar como «Bebidas»: el otro aparato no se sale.
4. Escanear el QR de una mesa con otro teléfono: abre el menú de esa mesa.
5. En el teléfono y en el iPhone: «Agregar a la pantalla principal» / «Agregar a inicio»; el ícono
   abre «Don Poncho» a pantalla completa.
6. Salir de todos los aparatos. Si se abrió una mesa por error, avisar: hay un guion probado que la
   cancela y la purga (`scripts/limpiar-ventas-de-prueba.mjs`).

**Dejar producción en ceros antes de operar** (lo que se cobró en las pruebas): avisar en el chat. Se
corre `scripts/dejar-en-ceros.mjs` (primero con `--ensayo`, por la conexión de sesión): comprueba que
todo lo que encuentra es de prueba (nada de antes del día que se le dice y no más ventas cobradas de
las que se le dicen), purga ventas, comandas, carritos, cajas, cortes, movimientos de caja e inventario
de esas ventas, y reinicia los folios (el siguiente ticket es el 1; el número para llevar vuelve a 1
solo). La auditoría se queda.

## Si algo falla

- **«Demasiados intentos»** al entrar: el PIN se bloquea unos minutos tras varios errores (hasta 5
  minutos). Esperar, o que el dueño le ponga un PIN nuevo desde Usuarios POS.
- **Sin internet:** la app necesita internet. Lo que el mesero llevaba a medias se guarda en el aparato
  y se recupera al volver a abrir la mesa; lo enviado ya está en el servidor.
- **Una pantalla se queda «cargando»:** recargar la página (no se pierde nada de lo ya enviado).
- **En Cocina, una comanda con la marca «Cuenta cobrada»:** la cuenta ya se pagó y ese platillo
  seguía por preparar; la cocina decide si lo prepara (no se borra solo, por si sí se sirve). Lo que
  ya estaba listo sale solo de la pantalla al cobrar.
- **Revisiones contra la base de producción** (sólo quien desarrolla): mientras el restaurante opera,
  **ninguna por el pooler de transacción (6543)**, el puerto de la app; por la conexión de sesión
  (5432) y en una transacción de sólo lectura que se cierra siempre (`docs/RUNBOOK.md` §3, DP-D92).
- **Lo que hay que mirar la primera semana:** en Vercel, el uso del proyecto (invocaciones, CPU activa,
  transferencia); en Supabase, Reports → Egress (ver `docs/infra/CAPACIDAD.md`).
- **Regreso a la base anterior** (sólo Miguel o quien desarrolla, con el restaurante sin usar el
  sistema): `..\_PRIVADO\mudanza\regreso-atras\LEEME.md` y `docs/infra/MUDANZA-FASE-B.md` («El regreso
  atrás, listo»). Son 10 minutos; lo escrito después en la base propia no viaja de regreso.
- **Respaldos:** Supabase guarda un respaldo diario de los últimos 7 días (se restaura desde su panel:
  Database → Backups). Además hay una exportación manual de la base ya lista en `..\_PRIVADO\mudanza\`.

## Lo que queda fuera de esta entrega

- La impresión directa a las térmicas (hoy se imprime con el diálogo del navegador).
- Las apps (APK o Linux), el rediseño visual, Google Drive/Sheets, Mercado Pago y el servidor privado.
- **Las recetas por cargar:** los 107 platillos están sin receta; el margen dice «sin receta» hasta que
  se carguen (Recetas → «Nueva receta», con sus insumos).
