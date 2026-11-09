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
  ícono de Don Poncho y el nombre «Don Poncho».
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

## Si algo falla

- **«Demasiados intentos»** al entrar: el PIN se bloquea unos minutos tras varios errores (hasta 5
  minutos). Esperar, o que el dueño le ponga un PIN nuevo desde Usuarios POS.
- **Sin internet:** la app necesita internet. Lo que el mesero llevaba a medias se guarda en el aparato
  y se recupera al volver a abrir la mesa; lo enviado ya está en el servidor.
- **Una pantalla se queda «cargando»:** recargar la página (no se pierde nada de lo ya enviado).
- **En Cocina, una comanda con la marca «Cuenta cobrada»:** la cuenta ya se pagó y ese platillo
  seguía por preparar; la cocina decide si lo prepara (no se borra solo, por si sí se sirve). Lo que
  ya estaba listo sale solo de la pantalla al cobrar.
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
