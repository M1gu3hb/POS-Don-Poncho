#!/usr/bin/env node
/**
 * verify:adopcion · que «usa la biblioteca» deje de ser una cifra que se pueda jugar.
 *
 * La etapa 2.35 cerró diciendo «31 de 72 pantallas usan la biblioteca», y la cuenta
 * era verdad y no decía nada: 22 de esas 31 importaban UN símbolo —casi siempre
 * `Vacio`— y `tabla.tsx`, la pieza más argumentada, no la usaba ni una pantalla de
 * producción. Importar contaba como adoptar.
 *
 * Aquí una pantalla está ADOPTADA sólo si cumple las CUATRO, que el analizador de
 * `lib/adopcion.mjs` mide sobre el árbol de sintaxis:
 *
 *   1.1 cero superficies a mano · 1.2 cero tablas y filas de datos a mano
 *   1.3 cero dinero formateado a mano · 1.4 sus tres estados salen del sistema
 *
 * Sale en 1 mientras UNA no cumpla. `--detalle` lista cada hallazgo con su línea;
 * `--json` lo da para una máquina; `--solo <modelo>` recorta a una carpeta, y
 * `--solo <modelo>/<Pantalla>` a una sola pantalla.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { analizarPantalla, pintaConEnvoltorios } from './lib/adopcion.mjs';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const PANTALLAS = join(RAIZ, 'apps', 'web', 'src');

/**
 * El texto del módulo de un envoltorio local, visto desde la pantalla que lo importa:
 * relativo a ella, o `~/` desde `apps/web/src` (el alias de `tsconfig`). `null` si no
 * existe: un envoltorio que no se puede leer no cuenta.
 */
function lectorDesde(ruta) {
  return (modulo) => {
    const base = modulo.startsWith('~/')
      ? join(PANTALLAS, modulo.slice(2))
      : join(dirname(ruta), modulo);
    for (const candidato of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx')]) {
      if (existsSync(candidato)) return readFileSync(candidato, 'utf8');
    }
    return null;
  };
}

/**
 * LOS ESTADOS QUE UNA PANTALLA NO TIENE, declarados y no escondidos.
 *
 * Una fila por pantalla y estado, con la razón de por qué ESE estado no existe en
 * esa pantalla —no «pendiente»—. La puerta falla también al revés: si la pantalla
 * acaba pintando el estado, la fila sobra y hay que borrarla.
 */
export const SIN_ESTADO = [
  {
    pantalla: 'restaurante/AnularLineaDialog',
    estado: 'vacio',
    razon:
      'Diálogo: recibe por props la orden, la línea, el platillo y si ya se preparó, y sus cuatro motivos son fijos del giro. No hay ninguna lista que pueda llegar vacía.',
  },
  {
    pantalla: 'restaurante/AnularLineaDialog',
    estado: 'cargando',
    razon:
      'Diálogo: no lee nada —ni consultarPuente ni una espera antes de pintarse—. Lo único asíncrono es el comando, y mientras corre el botón pasa a «Quitando…» con `cargando`.',
  },
  {
    pantalla: 'cliente/EstadosDeCarga',
    estado: 'vacio',
    razon:
      'Pieza de los estados de carga de las pantallas heredadas (21-10): pinta el esqueleto con su espacio reservado y el error con «Reintentar»; el vacío real lo dice cada pantalla que la monta.',
  },
  {
    pantalla: 'proveedores/Proveedores',
    estado: 'vacio',
    razon:
      'No es una pantalla: monta apariencia, sesión, caché de consultas y avisos alrededor de la aplicación.',
  },
  {
    pantalla: 'proveedores/Proveedores',
    estado: 'cargando',
    razon: 'No es una pantalla: no lee nada; cada pantalla de dentro pinta su propia espera.',
  },
  {
    pantalla: 'proveedores/Proveedores',
    estado: 'error',
    razon: 'No es una pantalla: no lee nada; cada pantalla de dentro pinta su propio error.',
  },
  {
    pantalla: 'restaurante/DividirCuentaDialog',
    estado: 'vacio',
    razon:
      'Diálogo: MesaActiva sólo ofrece «Dividir» cuando hay platillos enviados, así que nunca se abre sin líneas que repartir. Tenía un Vacio para ese caso y era una guarda inalcanzable (C.12 de la 2.4).',
  },
  {
    pantalla: 'restaurante/DividirCuentaDialog',
    estado: 'cargando',
    razon:
      'Diálogo: MesaActiva le pasa por props los platillos enviados y la orden; no hay lectura que esperar. Lo único asíncrono es el comando dividir-cuenta, pintado con el botón `cargando` («Dividiendo…»).',
  },
  {
    pantalla: 'configuracion/SelectorDeApariencia',
    estado: 'vacio',
    razon:
      'Los ocho estilos y sus perillas son constantes del sistema de diseño (ESTILOS, PERILLAS), no datos de la red: no hay ninguna lista que pueda llegar vacía.',
  },
  {
    pantalla: 'restaurante/PlatilloParaPedir',
    estado: 'vacio',
    razon:
      'No es una pantalla: es UN renglón bajo una página del menú personalizado del portal (DP-5). Sin platillos que pedir, la página no pinta la lista.',
  },
  {
    pantalla: 'restaurante/PlatilloParaPedir',
    estado: 'cargando',
    razon: 'No lee nada: recibe el platillo ya leído por el portal, que enseña su propia espera.',
  },
  {
    pantalla: 'restaurante/PlatilloParaPedir',
    estado: 'error',
    razon:
      'No lee ni escribe: «Agregar» abre el diálogo del portal, que es quien envía y dice si falló.',
  },
  {
    pantalla: 'restaurante/GlobosDeSolicitud',
    estado: 'vacio',
    razon:
      'No es una pantalla: son los globos de UNA mesa en el mapa (DP-9.2). Sin solicitudes no pinta nada: la mesa se ve como siempre.',
  },
  {
    pantalla: 'restaurante/GlobosDeSolicitud',
    estado: 'cargando',
    razon:
      'No lee nada: recibe las solicitudes que el mapa ya leyó, y el mapa enseña su propia espera.',
  },
  {
    pantalla: 'restaurante/menu-qr/PaginaConBotones',
    estado: 'vacio',
    razon:
      'No es una pantalla: es UNA página del menú del portal (DP-9.7). Sin botones es sólo imagen; sin páginas, el portal dice «Sin menú configurado».',
  },
  {
    pantalla: 'restaurante/menu-qr/PaginaConBotones',
    estado: 'cargando',
    razon:
      'No lee nada: recibe la página y el catálogo que el portal ya leyó, y el portal enseña su espera.',
  },
  {
    pantalla: 'restaurante/menu-qr/PaginaConBotones',
    estado: 'error',
    razon:
      'No lee ni escribe: «Agregar» abre el diálogo del portal, que es quien envía y dice si falló.',
  },
  {
    pantalla: 'restaurante/menu-qr/LienzoDeBotones',
    estado: 'vacio',
    razon:
      'No es una pantalla: es la imagen con sus botones dentro del editor (DP-9.7). Sin botones, el editor dice qué hacer al lado.',
  },
  {
    pantalla: 'restaurante/menu-qr/LienzoDeBotones',
    estado: 'cargando',
    razon: 'No lee nada: el editor ya leyó los botones y enseña su espera.',
  },
  {
    pantalla: 'restaurante/menu-qr/LienzoDeBotones',
    estado: 'error',
    razon: 'No escribe: mover un botón es estado local; guardar y su fallo son del editor.',
  },
  {
    pantalla: 'restaurante/menu-qr/PanelDelBoton',
    estado: 'vacio',
    razon:
      'No es una pantalla: es el formulario de UN botón; sin botón elegido no se pinta (el editor dice qué tocar).',
  },
  {
    pantalla: 'restaurante/menu-qr/PanelDelBoton',
    estado: 'cargando',
    razon: 'No lee nada: el catálogo se lo pasa la pestaña Menú QR, que ya lo leyó.',
  },
  {
    pantalla: 'restaurante/menu-qr/EditorDeBotones',
    estado: 'vacio',
    razon:
      'Es un diálogo de edición (DP-9.7): una página sin botones dice «Toca un botón para elegir qué hace, o agrega uno» con un Aviso.',
  },
  {
    pantalla: 'restaurante/menu-qr/AspectoDelPortal',
    estado: 'vacio',
    razon:
      'Es un formulario de tres opciones que siempre tiene valor (el de siempre si no se guardó nada): no hay vacío que enseñar.',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/ControlesDelDiseno',
    estado: 'vacio',
    razon:
      'No es una pantalla: son los controles del diseño de un QR dentro del editor (DP-9.8); siempre hay un diseño que editar.',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/ControlesDelDiseno',
    estado: 'cargando',
    razon: 'No lee nada: recibe el diseño que el editor ya tiene.',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/ControlesDelDiseno',
    estado: 'error',
    razon:
      'No escribe: cambiar un control es estado local; el editor dice lo que falta y si se lee.',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/MiniaturaDelQr',
    estado: 'vacio',
    razon: 'No es una pantalla: es la imagen de UN QR (DP-9.8); sin mesa con token no se pinta.',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/MiniaturaDelQr',
    estado: 'cargando',
    razon: 'No lee nada: dibuja en el momento el diseño que recibe.',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/MiniaturaDelQr',
    estado: 'error',
    razon: 'No escribe ni lee: el diseño que recibe ya pasó la validación.',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/DisenoDeLaMesa',
    estado: 'vacio',
    razon:
      'No es una pantalla: es el QR de UNA mesa en su tarjeta (DP-9.8); sin token dice «Sin token», y sin mesas la pestaña enseña su vacío.',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/DisenoDeLaMesa',
    estado: 'cargando',
    razon: 'No lee nada: el diseño lo leyó la pestaña, y su panel enseña la espera.',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/DescargasDeLaMesa',
    estado: 'vacio',
    razon: 'No es una pantalla: son las descargas de UNA mesa en su diálogo (DP-9.8).',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/DescargasDeLaMesa',
    estado: 'cargando',
    razon: 'No lee nada: mientras revisa y arma el archivo, el botón dice «Revisando…».',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/EditorDeDisenoDeQr',
    estado: 'vacio',
    razon: 'No es una pantalla: es el diálogo de UN diseño (DP-9.8); siempre abre con uno.',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/EditorDeDisenoDeQr',
    estado: 'cargando',
    razon: 'No lee nada: recibe el diseño ya leído; la revisión de lectura se anuncia con Aviso.',
  },
  {
    pantalla: 'restaurante/qr-de-mesas/PanelDeLosQr',
    estado: 'vacio',
    razon:
      'Sin mesas con token no hay QR que diseñar: lo dice un Aviso que manda a «Generar tokens faltantes», el botón de al lado (DP-9.8).',
  },
  {
    pantalla: 'portal/carrito-compartido/CarritoDeLaMesa',
    estado: 'vacio',
    razon:
      'No es una pantalla: es el pedido de la mesa en el portal (DP-9.5); vacío no se pinta y el menú de al lado es lo que se ve.',
  },
  {
    pantalla: 'portal/carrito-compartido/CarritoDeLaMesa',
    estado: 'cargando',
    razon: 'No lee nada: recibe el carrito que el portal ya sondea; mientras llega no se pinta.',
  },
  {
    pantalla: 'portal/carrito-compartido/AvisoDeLaMesa',
    estado: 'vacio',
    razon:
      'No es una pantalla: es el aviso de arriba del portal (DP-9.5); sin teléfonos conectados no se pinta.',
  },
  {
    pantalla: 'portal/carrito-compartido/AvisoDeLaMesa',
    estado: 'cargando',
    razon: 'No lee nada: recibe el estado que el portal ya sondea.',
  },
  {
    pantalla: 'telefono-de-cocina/ComandaEnElTelefono',
    estado: 'vacio',
    razon:
      'No es una pantalla: es la tarjeta de UNA comanda en el teléfono de cocina (DP-9.4). Sin comanda no se pinta: el teléfono enseña su Vacio.',
  },
  {
    pantalla: 'telefono-de-cocina/ComandaEnElTelefono',
    estado: 'cargando',
    razon:
      'No lee nada: recibe la comanda que el teléfono ya leyó, y el teléfono enseña su espera.',
  },
  {
    pantalla: 'telefono-de-cocina/ConectarTelefono',
    estado: 'vacio',
    razon:
      'Es un diálogo de un paso (DP-9.4): sin estaciones activas dice por qué con un Aviso dentro del diálogo, no con una pantalla vacía.',
  },
  {
    pantalla: 'restaurante/IconoDeSolicitud',
    estado: 'vacio',
    razon: 'No es una pantalla: es el icono de UN tipo de solicitud (DP-9.3); siempre tiene uno.',
  },
  {
    pantalla: 'restaurante/IconoDeSolicitud',
    estado: 'cargando',
    razon: 'No lee nada: recibe el tipo de quien lo pinta.',
  },
  {
    pantalla: 'restaurante/IconoDeSolicitud',
    estado: 'error',
    razon: 'No lee ni escribe: no tiene cómo fallar.',
  },
  {
    pantalla: 'restaurante/SelectorDeVista',
    estado: 'vacio',
    razon:
      'No es una pantalla: son los dos botones Mesas / Solicitudes (DP-9.3); siempre están los dos.',
  },
  {
    pantalla: 'restaurante/SelectorDeVista',
    estado: 'cargando',
    razon: 'No lee nada: el número de pendientes se lo pasa la pantalla de Mesas, que ya las leyó.',
  },
  {
    pantalla: 'restaurante/SelectorDeVista',
    estado: 'error',
    razon: 'No escribe en el servidor: recordar la vista en el aparato no falla para quien la usa.',
  },
  {
    pantalla: 'restaurante/AreaDePreparacionSelect',
    estado: 'vacio',
    razon:
      'No es una pantalla: es UN campo de los diálogos de Recetas y Platillos (DP-9.1). Sus opciones son fijas; nunca está vacío.',
  },
  {
    pantalla: 'restaurante/AreaDePreparacionSelect',
    estado: 'cargando',
    razon: 'No lee nada: las cinco áreas son una lista fija del dominio.',
  },
  {
    pantalla: 'restaurante/AreaDePreparacionSelect',
    estado: 'error',
    razon:
      'No lee ni escribe: el diálogo que lo contiene es quien guarda y dice si el servidor se negó.',
  },
  {
    pantalla: 'restaurante/RecetasPendientes',
    estado: 'vacio',
    razon:
      'No es una pantalla: es el aviso «N platillos sin receta» del tablero (DP-5). Con cero no hay nada que avisar, y no pintar nada ES su estado vacío.',
  },
  {
    pantalla: 'restaurante/RecetasPendientes',
    estado: 'cargando',
    razon:
      'Es un aviso dentro del tablero, que ya enseña sus propios esqueletos: mientras cuenta no se pinta, en vez de empujar el tablero con un hueco que luego desaparece.',
  },
  {
    pantalla: 'marca/CreditoDeMorphiq',
    estado: 'vacio',
    razon:
      'No es una pantalla: es el crédito «Sistema por Morphiq» bajo el teclado del acceso (DP-3). No lista nada que pueda llegar vacío.',
  },
  {
    pantalla: 'marca/CreditoDeMorphiq',
    estado: 'cargando',
    razon: 'No lee nada: el crédito es una constante del código. No hay espera que enseñar.',
  },
  {
    pantalla: 'marca/CreditoDeMorphiq',
    estado: 'error',
    razon: 'No puede fallar al leer: no lee. Es un texto fijo.',
  },
  {
    pantalla: 'cliente/en-linea',
    estado: 'vacio',
    razon:
      'No es una pantalla: es el AVISO «Sin internet. No se puede cobrar» que las cinco pantallas de cobro montan cuando se cae la red. No lista nada que pueda llegar vacío.',
  },
  {
    pantalla: 'cliente/en-linea',
    estado: 'cargando',
    razon:
      'El aviso lee `navigator.onLine` al montar, de forma síncrona: no hay espera que enseñar. Sin red, el aviso ES el estado.',
  },
  {
    pantalla: 'corte/CorteEnPdf',
    estado: 'vacio',
    razon:
      'Se monta sólo con la sesión que se acaba de cerrar, y una sesión cerrada siempre tiene corte: encabezado, arqueo y firmas. No hay lista que pueda llegar vacía; lo que falta dentro se omite sección por sección (C.6 de la 2.4).',
  },
  {
    pantalla: 'corte/HojaDelCorte',
    estado: 'vacio',
    razon:
      'Es el DOCUMENTO impreso, no una pantalla: recibe el corte ya armado por props y siempre lleva encabezado, arqueo y firmas. Sus tablas vacías no se pintan («ninguna sección en cero», §9.4 de cada giro).',
  },
  {
    pantalla: 'corte/HojaDelCorte',
    estado: 'cargando',
    razon:
      'Es el DOCUMENTO impreso: no lee nada, se pinta fuera de pantalla con el corte que CorteEnPdf ya leyó, y es CorteEnPdf quien pinta el Esqueleto mientras lee.',
  },
  {
    pantalla: 'corte/HojaDelCorte',
    estado: 'error',
    razon:
      'Es el DOCUMENTO impreso: no tiene operación que falle. Si la lectura falla, CorteEnPdf pinta su Aviso y NO se genera archivo: un PDF con ceros guardado como corte es peor que ninguno.',
  },
  {
    pantalla: 'configuracion/SelectorDeApariencia',
    estado: 'cargando',
    razon:
      'La apariencia la escribe el servidor en el <html> antes de la primera pintura y el proveedor no hace fetch. Lo único asíncrono es el POST de guardar, con el botón en `cargando`.',
  },
  {
    pantalla: 'venta/GastoDeCaja',
    estado: 'vacio',
    razon:
      'Formulario del gasto en efectivo (bloque D de la 2.4): sus cinco categorías son fijas de `gastos.registrar` y no hay ninguna lista que pueda llegar vacía.',
  },
  {
    pantalla: 'venta/GastoDeCaja',
    estado: 'cargando',
    razon:
      'No lee nada antes de pintarse: lo único asíncrono es registrar el gasto, y mientras corre el botón pasa a `cargando`.',
  },
  {
    pantalla: 'venta/CorteDeTurno',
    estado: 'vacio',
    razon:
      'Formulario del corte de turno (F-233, bloque D de la 2.4): un importe y una nota. No hay ninguna lista que pueda llegar vacía.',
  },
  {
    pantalla: 'venta/CorteDeTurno',
    estado: 'cargando',
    razon:
      'No lee nada antes de pintarse —el esperado aparece DESPUÉS de contar, a ciegas—; entregar el turno pone el botón en `cargando`.',
  },
  {
    pantalla: 'venta/RetiroDeCaja',
    estado: 'vacio',
    razon:
      'Formulario del retiro (D.1 de la 2.4, el de la tienda y el del salón): un importe y a dónde va. No hay ninguna lista que pueda llegar vacía.',
  },
  {
    pantalla: 'venta/RetiroDeCaja',
    estado: 'cargando',
    razon:
      'No lee nada antes de pintarse: lo único asíncrono es registrar el retiro, y mientras corre el botón pasa a `cargando`.',
  },
  {
    pantalla: 'venta/CampoDePesos',
    estado: 'vacio',
    razon:
      'Es un CAMPO, no una pantalla (D.1 de la 2.4): el importe con su `$` que usan la caja de la tienda y el retiro. No pinta ninguna lista.',
  },
  {
    pantalla: 'venta/CampoDePesos',
    estado: 'cargando',
    razon:
      'Un campo de texto controlado por quien lo monta: no lee nada y no espera nada. La espera, si la hay, la pinta el formulario que lo contiene.',
  },
  {
    pantalla: 'venta/CampoDePesos',
    estado: 'error',
    razon:
      'Un campo no decide si lo tecleado está mal: lo decide `aCentavos` en el formulario que lo monta, y ése pinta su Aviso (la caja de la tienda, el retiro).',
  },
  // ── Las piezas del restaurante que salieron de Cobro, Caja, CierreDiario y MesaActiva
  //    cuando pasaban de las 800 líneas (día completo del restaurante, 2.4). Ninguna lee:
  //    lo que pintan llega por props, y la espera y el fallo de la lectura los pinta la
  //    pantalla que las monta.
  {
    pantalla: 'restaurante/AjustesDeLaCuenta',
    estado: 'vacio',
    razon:
      'Dos diálogos del cobro —el descuento de la cuenta y su cancelación con motivo— que ESCRIBEN y no listan: no hay nada de la red que pueda llegar vacío.',
  },
  {
    pantalla: 'restaurante/AjustesDeLaCuenta',
    estado: 'cargando',
    razon:
      'No lee nada antes de pintarse: la cuenta llega por props desde Cobro. Lo único asíncrono es el comando, y mientras corre su botón pasa a `cargando`.',
  },
  {
    pantalla: 'restaurante/MovimientosDeCaja',
    estado: 'vacio',
    razon:
      'Composición de cuatro formularios de `venta/` (corte de turno, retiro, gasto y devolución), cada uno con sus estados. No lista nada él mismo.',
  },
  {
    pantalla: 'restaurante/MovimientosDeCaja',
    estado: 'cargando',
    razon:
      'Composición sin lectura propia: el turno lo lee la Caja, que pinta su Esqueleto; cada formulario pone su botón en `cargando` mientras escribe.',
  },
  {
    pantalla: 'restaurante/MovimientosDeCaja',
    estado: 'error',
    razon:
      'Composición sin operación propia: el fallo de un retiro, un gasto, una devolución o un corte lo pinta ese formulario en su Aviso.',
  },
  {
    pantalla: 'restaurante/ParedDePropina',
    estado: 'vacio',
    razon:
      'Los porcentajes sugeridos son constantes del giro (§4.3) y la venta llega por props: no hay lista de la red que pueda llegar vacía.',
  },
  {
    pantalla: 'restaurante/ParedDePropina',
    estado: 'cargando',
    razon:
      'Pieza del cobro sin lectura ni escritura: elegir la propina sólo la devuelve a Cobro, que la manda con el cobro y pinta su espera.',
  },
  {
    pantalla: 'restaurante/comanda-de-la-mesa',
    estado: 'vacio',
    razon:
      'Módulo de piezas de MesaActiva —columnas de lo enviado y del borrador, importes y su esqueleto—: la cuenta vacía la dice MesaActiva con su Vacio.',
  },
  {
    pantalla: 'restaurante/comanda-de-la-mesa',
    estado: 'error',
    razon:
      'Sus columnas y su esqueleto no tienen operación que falle; la relectura de lo enviado la llama MesaActiva, que pinta su ErrorDePantalla con «Reintentar».',
  },
  {
    pantalla: 'restaurante/piezas-del-cobro',
    estado: 'vacio',
    razon:
      'Funciones puras del cobro (importe de la línea, qué impide cobrar) y las columnas del desglose que Cobro pinta en su Tabla, con el Vacio de Cobro.',
  },
  {
    pantalla: 'restaurante/piezas-del-cobro',
    estado: 'cargando',
    razon:
      'Son columnas y funciones, no una pantalla: no leen nada; el esqueleto de la cuenta lo pinta Cobro mientras la lee.',
  },
  {
    pantalla: 'restaurante/piezas-del-cobro',
    estado: 'error',
    razon:
      'Sin operación propia que falle: el rechazo del cobro o de la lectura lo dice Cobro en su Aviso, con lo capturado en su sitio.',
  },
  {
    pantalla: 'restaurante/semaforo-del-arqueo',
    estado: 'vacio',
    razon:
      'Traduce una diferencia del arqueo a palabra, forma y tinte («Cuadra exacto», «Falta poco»): no lista nada que pueda llegar vacío.',
  },
  {
    pantalla: 'restaurante/semaforo-del-arqueo',
    estado: 'cargando',
    razon:
      'Pieza del cierre sin lectura: la diferencia llega por props DESPUÉS de contar a ciegas; la espera del cierre la pinta CierreDiario.',
  },
  {
    pantalla: 'restaurante/semaforo-del-arqueo',
    estado: 'error',
    razon:
      'No tiene operación que falle: si el cierre lo rechaza el servidor, CierreDiario lo pinta en su Aviso de peligro.',
  },
  {
    pantalla: 'restaurante/AccesosDelDueno',
    estado: 'vacio',
    razon:
      'Seis accesos fijos del giro, escritos en el archivo: no hay lista que pueda llegar vacía.',
  },
  {
    pantalla: 'restaurante/AccesosDelDueno',
    estado: 'cargando',
    razon:
      'No lee nada: la sesión ya la trae el proveedor de autenticación del tablero, y sin dueño ni administrador la pieza no se pinta.',
  },
  {
    pantalla: 'restaurante/AccesosDelDueno',
    estado: 'error',
    razon:
      'Son enlaces: ni lee ni escribe, así que no hay operación que pueda fallar dentro de la pieza.',
  },
  {
    pantalla: 'restaurante/DividirLaCuenta',
    estado: 'vacio',
    razon:
      'Es un botón con su diálogo: sin líneas, o con menos de dos unidades que repartir, el botón queda deshabilitado; la lista la pinta DividirCuentaDialog.',
  },
  {
    pantalla: 'restaurante/DividirLaCuenta',
    estado: 'cargando',
    razon:
      'Las líneas llegan por props de la pantalla de cobro, que pinta su propia carga; mientras son `null` el botón está deshabilitado.',
  },
  {
    pantalla: 'restaurante/DividirLaCuenta',
    estado: 'error',
    razon:
      'No lee ni escribe por sí misma: dividir lo hace DividirCuentaDialog, que pinta su fallo con un Aviso.',
  },
  {
    pantalla: 'restaurante/ListosParaRecoger',
    estado: 'vacio',
    razon:
      'Sin platillos en la ventana la pieza no se pinta: su lugar es el del catálogo de la mesa, y un «no hay nada listo» permanente sería ruido en la pantalla del mesero.',
  },
  {
    pantalla: 'restaurante/ListosParaRecoger',
    estado: 'cargando',
    razon:
      'Recibe los listos por props y se relee cada pocos segundos: hasta que hay algo listo no se pinta nada, y un esqueleto parpadearía con cada relectura sobre la mesa que ya está en pantalla.',
  },
  {
    pantalla: 'restaurante/PedirLaCuentaDialog',
    estado: 'vacio',
    razon:
      'Diálogo con las opciones de propina fijas del giro (OPCIONES_DE_PROPINA): no hay lista que pueda llegar vacía.',
  },
  {
    pantalla: 'restaurante/PedirLaCuentaDialog',
    estado: 'cargando',
    razon:
      'No lee nada antes de pintarse: el total llega por props. Lo único asíncrono es pedir la cuenta, y mientras corre las teselas quedan deshabilitadas.',
  },
  {
    pantalla: 'restaurante/QuePasoConLoQuitado',
    estado: 'vacio',
    razon:
      'Un selector donde «Corrección de conteo» siempre está: la lista nunca llega vacía, y sin motivos de merma queda esa opción.',
  },
  {
    pantalla: 'restaurante/QuePasoConLoQuitado',
    estado: 'cargando',
    razon:
      'Los motivos se leen una vez, y mientras llegan el selector ya ofrece «Corrección de conteo»: no hay nada que esperar para corregir.',
  },
  {
    pantalla: 'restaurante/QuePasoConLoQuitado',
    estado: 'error',
    razon:
      'Va dentro del renglón de un ajuste de inventario: si los motivos no se leen lo dice en una línea bajo el selector y deja la corrección de conteo. Un Aviso o un ErrorDePantalla ahí ocuparía el renglón entero.',
  },
];

const argumentos = process.argv.slice(2);
const conDetalle = argumentos.includes('--detalle');
const comoJson = argumentos.includes('--json');
const solo = argumentos.includes('--solo') ? argumentos[argumentos.indexOf('--solo') + 1] : null;

function archivos(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return nombre.endsWith('.tsx') && !nombre.includes('.test.') ? [ruta] : [];
  });
}

const ESTADOS = {
  vacio: 'no pinta Vacio',
  cargando: 'no pinta Esqueleto ni EsqueletoDeLista',
  error: 'no pinta ErrorDePantalla ni Aviso',
};

const filas = [];
const problemasDeLaLista = [];

for (const ruta of archivos(PANTALLAS).sort()) {
  const pantalla = relative(PANTALLAS, ruta)
    .split(sep)
    .join('/')
    .replace(/\.tsx$/, '');
  if (solo !== null && pantalla !== solo && !pantalla.startsWith(`${solo}/`)) continue;
  const analisis = analizarPantalla(readFileSync(ruta, 'utf8'), ruta);
  const { interfaz, hallazgos } = analisis;
  const pinta = pintaConEnvoltorios(analisis.pinta, analisis.envoltorios, lectorDesde(ruta));
  if (!interfaz) {
    filas.push({ pantalla, interfaz, hallazgos: [] });
    continue;
  }
  for (const [estado, motivo] of Object.entries(ESTADOS)) {
    const declarada = SIN_ESTADO.find((e) => e.pantalla === pantalla && e.estado === estado);
    if (declarada !== undefined && pinta[estado]) {
      problemasDeLaLista.push(
        `${pantalla} · «${estado}» declarado sin estado, y lo pinta: borra la fila`,
      );
    }
    if (!pinta[estado] && declarada === undefined)
      hallazgos.push({ condicion: '1.4', motivo, linea: 0 });
  }
  filas.push({ pantalla, interfaz, hallazgos });
}

for (const e of SIN_ESTADO) {
  if (!existsSync(join(PANTALLAS, `${e.pantalla}.tsx`))) {
    problemasDeLaLista.push(`${e.pantalla} · declarada sin «${e.estado}» y no existe`);
  }
  if (typeof e.razon !== 'string' || e.razon.length < 40) {
    problemasDeLaLista.push(`${e.pantalla} · «${e.estado}» sin una razón que diga por qué`);
  }
}

const deInterfaz = filas.filter((f) => f.interfaz);
const adoptadas = deInterfaz.filter((f) => f.hallazgos.length === 0);
const rojas = deInterfaz.length - adoptadas.length;

if (comoJson) {
  process.stdout.write(
    `${JSON.stringify({ filas, adoptadas: adoptadas.length, rojas, problemasDeLaLista }, null, 1)}\n`,
  );
  process.exit(rojas > 0 || problemasDeLaLista.length > 0 ? 1 : 0);
}

/** `1.1 superficie a mano en <div> ×3 · 1.3 …`: el mismo motivo se cuenta, no se repite. */
function resumen(hallazgos) {
  const cuenta = new Map();
  for (const h of hallazgos) {
    const clave = `${h.condicion} ${h.motivo}`;
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  return [...cuenta].map(([clave, n]) => (n > 1 ? `${clave} ×${n}` : clave)).join(' · ');
}

const ancho = Math.max(...filas.map((f) => f.pantalla.length)) + 2;
console.log(
  `verify:adopcion · ${filas.length} archivos de apps/web/src contra las cuatro condiciones\n`,
);
console.log(`${'pantalla'.padEnd(ancho)}adoptada  qué le falta`);
for (const f of filas) {
  if (!f.interfaz) {
    console.log(
      `${f.pantalla.padEnd(ancho)}—         no es una pantalla: no pinta ningún elemento`,
    );
    continue;
  }
  const si = f.hallazgos.length === 0;
  console.log(
    `${f.pantalla.padEnd(ancho)}${si ? 'sí' : 'NO'}        ${si ? '' : resumen(f.hallazgos)}`,
  );
  if (conDetalle && !si) {
    for (const h of f.hallazgos.toSorted((a, b) => a.linea - b.linea)) {
      console.log(
        `${' '.repeat(ancho + 4)}${h.linea > 0 ? `:${h.linea}`.padEnd(6) : '      '}${h.condicion} ${h.motivo}`,
      );
    }
  }
}

const porCondicion = (c) =>
  deInterfaz.filter((f) => f.hallazgos.some((h) => h.condicion === c)).length;
console.log(`\n${adoptadas.length} de ${deInterfaz.length} pantallas adoptadas · ${rojas} en rojo`);
console.log(`  1.1 superficies a mano ........ ${porCondicion('1.1')}`);
console.log(`  1.2 tablas o filas a mano ..... ${porCondicion('1.2')}`);
console.log(`  1.3 dinero a mano ............. ${porCondicion('1.3')}`);
console.log(`  1.4 estados fuera del sistema . ${porCondicion('1.4')}`);
const sinInterfaz = filas.length - deInterfaz.length;
if (sinInterfaz > 0)
  console.log(`  (${sinInterfaz} archivo(s) sin interfaz: proveedores, no pantallas)`);

for (const p of problemasDeLaLista) console.log(`✗ ${p}`);
if (rojas > 0 || problemasDeLaLista.length > 0) {
  console.log(
    `\n✗ La adopción NO está completa.${conDetalle ? '' : ' `--detalle` da cada hallazgo con su línea.'}`,
  );
  process.exit(1);
}
console.log('\n✓ Las pantallas usan el sistema: superficies, tablas, dinero y estados.');
