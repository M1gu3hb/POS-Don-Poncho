/**
 * F-018 · El MENÚ de cada plantilla, y dónde abre cada negocio.
 *
 * ── Qué estaba roto ────────────────────────────────────────────────────────
 * Las 61 pantallas de los cinco modelos estaban construidas, etiquetadas,
 * contadas por `verify:cobertura` y respondiendo por HTTP — y **ninguna colgaba
 * de un menú**. Para abrir cualquiera de ellas había que teclear la URL.
 * `heredado/lib/permissions.js` seguía con su lista fija de doce entradas, que
 * son las del punto de venta de Miguel, y ni una llevaba a una pantalla de
 * modelo. Contar archivos y pedir un 200 mide existencia; esto mide acople.
 *
 * ── Por qué el menú vive en el SERVIDOR y no en `permissions.js` ───────────
 * Porque el navegador no puede ser la fuente de la verdad de lo que un negocio
 * tiene contratado, y ya costó un defecto en esta misma fase: `getCurrentPackage`
 * no reconocía los nombres nuevos y le daba el menú completo a una tienda. El
 * menú se declara aquí, junto a los módulos que lo gobiernan, y el frontend se
 * limita a pintarlo.
 *
 * ── El orden es el DÍA DE TRABAJO, no el alfabeto ──────────────────────────
 * Cada `04-INTERFAZ.md §4.2` lo decide para su giro: un restaurante abre el
 * mapa de mesas y termina en el arqueo; una estética abre la agenda y termina
 * en la liquidación. Ordenar por nombre pondría «Agenda» junto a «Arqueo» y
 * obligaría a leer el menú entero cada vez.
 *
 * ── Lo que esta tabla NO decide ────────────────────────────────────────────
 * Los permisos por rol. Una entrada visible para la plantilla puede seguir
 * estando oculta para un cajero: eso lo filtra `hasPermission` con el rol, y
 * son dos preguntas distintas —qué compró el negocio y qué puede tocar esta
 * persona— que ya se mezclaron una vez.
 */

import { type Giro } from './ambito.ts';
import {
  segunElDato,
  MODULOS_POR_PLANTILLA,
  PLANTILLA_POR_GIRO,
  type Modulo,
  type Plantilla,
} from './plantillas.ts';

export { PLANTILLA_POR_GIRO };
export type { Giro, Modulo, Plantilla };

/**
 * Las entidades que el vocabulario del giro sabe nombrar (F-017).
 *
 * Se escriben aquí como una unión de texto y no se importa el tipo de
 * `@morphiqpos/domain`: `contracts` es la capa de abajo y no depende de nadie.
 * Un contrato en `packages/domain` ata las dos listas.
 */
export type EntidadDeVocabulario =
  | 'unidad_servicio'
  | 'orden'
  | 'linea_orden'
  | 'responsable'
  | 'cliente'
  | 'producto'
  | 'preparacion';

/** Una entrada del menú lateral. */
export interface EntradaDeMenu {
  /** La ruta real de la pantalla. Lo que el navegador abre al tocarla. */
  readonly ruta: string;
  /** El texto por omisión, para cuando el giro no traduce esa entidad. */
  readonly etiqueta: string;
  /** El icono de `lucide-react` que ya usa el menú heredado. */
  readonly icono: string;
  /** El módulo que la gobierna. Sin él en la plantilla, la entrada no sale. */
  readonly modulo: Modulo;
  /** El permiso del rol, con la misma clave que `permissions.js`. */
  readonly permiso: string;
  /** Qué sustantivo del giro la nombra. Sin esto, la etiqueta va tal cual. */
  readonly entidad?: EntidadDeVocabulario;
  /**
   * El plural con el que la entrada conserva su `etiqueta` propia: el restaurante dice
   * «Mesas y pedidos» mientras su diccionario diga «meseros»; otro giro con su plantilla
   * —una cafetería— la nombra con el suyo («Baristas»).
   */
  readonly pluralPropio?: string;
}

/**
 * La cola común: el tablero y la configuración.
 *
 * Van en las cinco porque son del sistema, no del giro — y porque
 * Configuración es donde se cambia de plantilla: dejarla fuera de un menú
 * encerraría a un negocio en la plantilla que estrenó.
 */
const CIERRE: readonly EntradaDeMenu[] = [
  {
    ruta: '/',
    etiqueta: 'Tablero',
    icono: 'LayoutDashboard',
    modulo: 'dashboard_basico',
    permiso: 'ver_dashboard',
  },
  {
    ruta: '/configuracion',
    etiqueta: 'Configuración',
    icono: 'Settings',
    modulo: 'configuracion_basica',
    permiso: 'ver_configuracion',
  },
];

/** El día de un restaurante: se abre una mesa y se cierra el arqueo. */
const RESTAURANTE: readonly EntradaDeMenu[] = [
  {
    ruta: '/restaurante/mapa-de-mesas',
    etiqueta: 'Mesas',
    icono: 'LayoutGrid',
    modulo: 'mapa_mesas',
    permiso: 'ver_mesero',
    entidad: 'unidad_servicio',
  },
  {
    ruta: '/restaurante/mesa-activa',
    etiqueta: 'Mesa activa',
    icono: 'UtensilsCrossed',
    modulo: 'mesas',
    permiso: 'ver_mesero',
  },
  {
    ruta: '/restaurante/precuenta',
    etiqueta: 'Precuenta',
    icono: 'ReceiptText',
    modulo: 'pedidos_mesa',
    permiso: 'ver_mesero',
  },
  {
    ruta: '/restaurante/cocina',
    etiqueta: 'Cocina',
    icono: 'ChefHat',
    modulo: 'cocina',
    permiso: 'ver_cocina',
    entidad: 'preparacion',
  },
  {
    ruta: '/restaurante/cobro',
    etiqueta: 'Cobro',
    icono: 'CreditCard',
    modulo: 'ventas',
    permiso: 'ver_caja',
  },
  {
    ruta: '/restaurante/caja',
    etiqueta: 'Caja',
    icono: 'Landmark',
    modulo: 'caja_directa',
    permiso: 'ver_caja',
  },
  {
    ruta: '/restaurante/cierre-diario-y-arqueo',
    etiqueta: 'Cierre y arqueo',
    icono: 'ClipboardCheck',
    modulo: 'cortes',
    permiso: 'ver_caja',
  },
  {
    ruta: '/restaurante/productos',
    etiqueta: 'Productos',
    icono: 'Tag',
    modulo: 'productos_basicos',
    permiso: 'ver_productos',
    entidad: 'producto',
  },
  {
    ruta: '/restaurante/recetas',
    etiqueta: 'Recetas',
    icono: 'BookOpen',
    modulo: 'recetas',
    permiso: 'ver_recetas',
  },
  {
    ruta: '/restaurante/inventario',
    etiqueta: 'Inventario',
    icono: 'Package',
    modulo: 'inventario',
    permiso: 'ver_inventario',
  },
  {
    ruta: '/restaurante/registros',
    etiqueta: 'Registros',
    icono: 'FileText',
    modulo: 'registros_basicos',
    permiso: 'ver_registros',
  },
];

/*
 * POS Don Poncho (DP-2): los menús de cafetería, tienda, ferretería y estética se fueron con
 * sus pantallas. Las plantillas siguen declaradas en `plantillas.ts` —son los valores que
 * puede guardar `organizaciones.paquete`, como el esquema guarda sus tablas—, pero este
 * sistema sólo sirve al restaurante: a cualquier otra le queda el punto de venta heredado
 * que sus módulos permitan y el tablero.
 */

/**
 * EL PUNTO DE VENTA DE TODOS LOS DÍAS.
 *
 * ── Por qué está aquí, y por qué casi se perdió ────────────────────────────
 * Estas diez entradas son el menú que Miguel y su personal abren cada mañana:
 * las pantallas del punto de venta heredado, las que llevan meses cobrando y
 * las que Codex arregló —propinas, bucle de cobro, arqueo—.
 *
 * Al escribir el menú por plantilla se sustituyeron por las de los cinco
 * modelos, que es exactamente el error que esta etapa venía a arreglar, pero al
 * revés: las 61 pantallas nuevas dejaron de estar huérfanas y las doce viejas se
 * quedaron sin menú. Respondían, y sólo se abrían tecleando la URL. Un negocio
 * que cobra esta noche no puede perder su menú porque haya uno nuevo.
 *
 * Van DESPUÉS de las del modelo —el día de trabajo empieza en la pantalla del
 * giro— y cada una lleva su módulo, así que la plantilla sigue decidiendo: una
 * ferretería no ve «Mesero» ni «Cocina», y sólo las dos plantillas con portal
 * ven «Portal QR».
 *
 * `/mesas`, `/pos` y `/corte-caja` NO están: tampoco estaban en el menú
 * original —se llega a ellas desde dentro— y añadirlas aquí sería inventar
 * navegación que nadie pidió.
 */
const HEREDADO: readonly EntradaDeMenu[] = [
  {
    ruta: '/mesero',
    etiqueta: 'Mesero',
    icono: 'UtensilsCrossed',
    modulo: 'mesero',
    permiso: 'ver_mesero',
    entidad: 'responsable',
  },
  {
    ruta: '/cocina',
    etiqueta: 'Cocina',
    icono: 'ChefHat',
    modulo: 'cocina',
    permiso: 'ver_cocina',
    entidad: 'preparacion',
  },
  {
    ruta: '/caja',
    etiqueta: 'Caja',
    icono: 'Landmark',
    modulo: 'caja_directa',
    permiso: 'ver_caja',
  },
  {
    ruta: '/ventas',
    etiqueta: 'Ventas',
    icono: 'Receipt',
    modulo: 'ventas',
    permiso: 'ver_ventas',
  },
  {
    ruta: '/recetas',
    etiqueta: 'Recetas',
    icono: 'BookOpen',
    modulo: 'recetas',
    permiso: 'ver_recetas',
  },
  {
    ruta: '/productos',
    etiqueta: 'Productos',
    icono: 'Tag',
    modulo: 'productos_basicos',
    permiso: 'ver_productos',
    entidad: 'producto',
  },
  {
    ruta: '/inventario',
    etiqueta: 'Inventario',
    icono: 'Package',
    modulo: 'inventario',
    permiso: 'ver_inventario',
  },
  {
    ruta: '/compras',
    etiqueta: 'Compras',
    icono: 'ShoppingBag',
    modulo: 'compras',
    permiso: 'ver_compras',
  },
  {
    ruta: '/registros',
    etiqueta: 'Registros',
    icono: 'FileText',
    modulo: 'registros_basicos',
    permiso: 'ver_registros',
  },
  {
    ruta: '/portal-qr',
    etiqueta: 'Portal QR',
    icono: 'QrCode',
    modulo: 'portal_qr',
    permiso: 'ver_portal_qr',
  },
];

/**
 * Las pantallas DEL MODELO, por plantilla. Sin las heredadas y sin el cierre:
 * los tres grupos se mantienen aparte porque `navegacionDePlantilla` los trata
 * distinto.
 */
const MENU_DEL_MODELO: Readonly<Partial<Record<Plantilla, readonly EntradaDeMenu[]>>> = {
  restaurante: RESTAURANTE,
};

/**
 * El menú de una plantilla: filtrado por sus módulos, y con UNA entrada por
 * módulo.
 *
 * ── El filtro por módulo ───────────────────────────────────────────────────
 * No es decorativo: una entrada que la plantilla no incluye sería una promesa
 * que el POST rechaza, que es exactamente el defecto que cerró esta fase cuando
 * `getCurrentPackage` le daba el menú completo a una tienda.
 *
 * ── Y por qué una sola por módulo ──────────────────────────────────────────
 * Porque las pantallas del modelo y las del punto de venta heredado se solapan:
 * un restaurante tiene `/restaurante/caja` y `/caja`, y las dos gobierna
 * `caja_directa`. Un menú con dos entradas llamadas «Caja» que van a sitios
 * distintos no es un menú completo: es uno que obliga a adivinar.
 *
 * Gana la del MODELO, que es la que la plantilla trae para ese módulo, y la
 * heredada sólo aparece donde el modelo no cubre ese módulo —«Mesero»,
 * «Compras», «Portal QR» en un restaurante—. Ninguna pantalla se pierde: las
 * que salen del menú son las que tienen una equivalente del giro, y siguen
 * respondiendo en su ruta.
 *
 * El orden decide: `MENU` pone primero las del modelo a propósito.
 */
export function navegacionDePlantilla(plantilla: Plantilla): readonly EntradaDeMenu[] {
  const modulos = new Set<string>(segunElDato(MODULOS_POR_PLANTILLA, plantilla) ?? []);
  const delModelo = (segunElDato(MENU_DEL_MODELO, plantilla) ?? []).filter((entrada) =>
    modulos.has(entrada.modulo),
  );

  // El solape se resuelve por MÓDULO, y sólo entre grupos. Dentro del modelo dos
  // pantallas pueden compartirlo —«Cobrar» y «Caja» de una tiendita son las dos
  // `caja_directa`, y son dos pantallas distintas que la tiendita necesita—; lo
  // que no puede repetirse es el concepto ENTRE el menú del giro y el heredado.
  const cubiertos = new Set(delModelo.map((entrada) => entrada.modulo));
  const heredadas = HEREDADO.filter(
    (entrada) => modulos.has(entrada.modulo) && !cubiertos.has(entrada.modulo),
  );

  return [...delModelo, ...heredadas, ...CIERRE.filter((e) => modulos.has(e.modulo))];
}

/**
 * Dónde abre cada negocio al entrar.
 *
 * No es una preferencia: está decidido en `04-SISTEMA-DE-DISENO §2 eje A` y en
 * cada `04-INTERFAZ.md`. Un restaurante abre el mapa de mesas porque lo primero
 * que hace el mesero es ver quién está sentado; una estética abre la agenda
 * porque el hueco de las 3 pm no se recupera mañana; una tiendita abre el cobro
 * con el foco en el escáner porque la fila no espera.
 */
export const INICIO_POR_PLANTILLA: Readonly<Record<Plantilla, string>> = {
  restaurante: '/restaurante/mapa-de-mesas',
  // Las que este sistema no sirve (DP-2) abren en el tablero: sus pantallas ya no existen.
  tienda: '/',
  cafeteria: '/',
  ferreteria: '/',
  estetica: '/',
};

/**
 * Las pantallas de modelo que NO llevan sesión de negocio.
 *
 * Son las mismas dos que no cuelgan de ningún menú, y por la misma razón:
 *
 * · `acceso-por-pin` se ve ANTES de que exista sesión — es la pantalla de entrar,
 *   y exigir sesión para verla es un bucle;
 * · el portal del comensal lo abre el CLIENTE desde su teléfono, con el token de su
 *   mesa. No hay empleado, no hay plantilla y no hay menú lateral.
 *
 * La guarda de `app/(modelos)/` las salta, y `verify:acople` comprueba que esta
 * lista y las filas `PANTALLA-SIN-MENU` de `EXCEPCIONES-COBERTURA.md` digan lo
 * MISMO. Dos listas que se pueden separar es cómo se cuela una pantalla privada
 * a la calle.
 */
export const RUTAS_DE_MODELO_SIN_SESION: readonly string[] = [
  '/restaurante/acceso-por-pin',
  '/restaurante/portal-del-comensal',
];

/** ¿Esta ruta de modelo se abre sin sesión? */
export function rutaDeModeloSinSesion(ruta: string): boolean {
  const limpia = ruta.split('?')[0]?.replace(/\/+$/, '') ?? '';
  return RUTAS_DE_MODELO_SIN_SESION.includes(limpia);
}

/** ¿Esta ruta pertenece a la plantilla? Lo que el envoltorio de modelos exige. */
export function rutaPermitidaEnPlantilla(ruta: string, plantilla: Plantilla): boolean {
  const limpia = ruta.split('?')[0]?.replace(/\/+$/, '') ?? '';
  return navegacionDePlantilla(plantilla).some((entrada) => entrada.ruta === limpia);
}
