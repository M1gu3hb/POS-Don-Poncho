/**
 * LA CONFIGURACIÓN, ORDENADA (DP-21 · Bloque 21): las secciones, sus tarjetas y quién ve cada una.
 *
 * Antes eran 13 pestañas que se amontonaban y cada ajuste estaba donde había caído. Ahora son
 * 16 secciones en una columna (en el teléfono, una lista y luego su página). Nada se quitó salvo
 * «Integraciones»; cada ajuste sigue guardando lo mismo, con el mismo comando, y sólo cambió de
 * lugar. Este archivo es el MAPA: la pantalla (`heredado/pages/Configuracion.jsx`) pinta lo que él
 * dice, y las pruebas (`mudanza.contrato.test.ts`) lo comparan con la fotografía de cómo era antes.
 *
 * Puro: sin React ni servidor.
 */

export type IdDeSeccion =
  | 'el-negocio'
  | 'apariencia'
  | 'ventas-y-cobro'
  | 'ticket-y-folios'
  | 'caja'
  | 'salon'
  | 'cocina'
  | 'portal'
  | 'productos'
  | 'personas'
  | 'sonidos'
  | 'datos'
  | 'este-aparato'
  | 'laboratorio'
  | 'mantenimiento'
  | 'avanzado';

export type GrupoDeSecciones = 'negocio' | 'aparato' | 'final' | 'avanzado';

export interface Seccion {
  readonly id: IdDeSeccion;
  readonly nombre: string;
  /** Una línea: para qué sirve. */
  readonly paraQue: string;
  readonly grupo: GrupoDeSecciones;
}

export const SECCIONES: readonly Seccion[] = [
  {
    id: 'el-negocio',
    nombre: 'El negocio',
    grupo: 'negocio',
    paraQue: 'Quién es: nombre, logo, dirección, teléfono y correo.',
  },
  {
    id: 'apariencia',
    nombre: 'Apariencia',
    grupo: 'negocio',
    paraQue:
      'Cómo se ve el sistema para todo el negocio: estilo, colores, fondo, importes y Morfi.',
  },
  {
    id: 'ventas-y-cobro',
    nombre: 'Ventas y cobro',
    grupo: 'negocio',
    paraQue: 'Con qué se cobra: IVA, propinas y descuentos.',
  },
  {
    id: 'ticket-y-folios',
    nombre: 'Ticket y folios',
    grupo: 'negocio',
    paraQue:
      'Lo que sale en el papel: mensaje, ancho, pies, logos, prefijo y primer folio, copias.',
  },
  {
    id: 'caja',
    nombre: 'Caja',
    grupo: 'negocio',
    paraQue: 'Las cajas y sus nombres, el PIN en retiros y el PDF del corte al cerrar.',
  },
  {
    id: 'salon',
    nombre: 'Salón',
    grupo: 'negocio',
    paraQue: 'Mapa de mesas, zonas, reparto de mesas y asignación a meseros.',
  },
  {
    id: 'cocina',
    nombre: 'Cocina',
    grupo: 'negocio',
    paraQue: 'Estaciones de preparación, alertas de espera y la prueba de la voz de comandas.',
  },
  {
    id: 'portal',
    nombre: 'Portal de comensales',
    grupo: 'negocio',
    paraQue: 'Todos los ajustes del portal QR en un solo lugar.',
  },
  {
    id: 'productos',
    nombre: 'Productos e inventario',
    grupo: 'negocio',
    paraQue: 'Categorías, unidades de medida y proveedores.',
  },
  {
    id: 'personas',
    nombre: 'Personas y seguridad',
    grupo: 'negocio',
    paraQue: 'Usuarios POS, «Pedir PIN al despertar» y el candado de los puestos de mando.',
  },
  {
    id: 'sonidos',
    nombre: 'Sonidos y avisos',
    grupo: 'negocio',
    paraQue: 'Qué suena en cada momento y el silencio de los avisos del administrador.',
  },
  {
    id: 'datos',
    nombre: 'Datos',
    grupo: 'negocio',
    paraQue: 'Exportar e importar: el respaldo de la base de datos.',
  },
  {
    id: 'este-aparato',
    nombre: 'Este aparato',
    grupo: 'aparato',
    paraQue:
      'Lo que sólo vale en este aparato: su nombre, impresora y cajón, sonido, modo espera, voz, anuncio de comandas y barra lateral.',
  },
  {
    id: 'laboratorio',
    nombre: 'Laboratorio del proveedor',
    grupo: 'final',
    paraQue: 'Entrada al laboratorio de impresión (sólo con el permiso del proveedor).',
  },
  {
    id: 'mantenimiento',
    nombre: 'Mantenimiento',
    grupo: 'final',
    paraQue: 'Reiniciar pruebas y reiniciar todo (sólo plataforma).',
  },
  {
    id: 'avanzado',
    nombre: 'Avanzado',
    grupo: 'avanzado',
    paraQue:
      'Ajustes que hoy no hacen nada o que el restaurante no necesita; no se quitan hasta que Miguel decida.',
  },
];

/** Quién ve una tarjeta. Es lo mismo que decidía cada pestaña de antes: ningún permiso cambia. */
export type VisiblePara =
  | 'todos'
  /** Dueño y administrador (las pestañas Caja, Descuentos, Datos e Integraciones de antes). */
  | 'mando'
  /** Negocios con el módulo de mesas (la pestaña Mesas de antes). */
  | 'mesas'
  /** La pantalla Portal QR de antes sólo la abre el administrador. */
  | 'portal'
  /** DP-21 · Bloque 14: lo que no tiene sentido en un restaurante se esconde (no se borra). */
  | 'fuera-del-restaurante'
  /** La pestaña Mantenimiento: administrador y usuario de plataforma. */
  | 'plataforma';

export interface Tarjeta {
  readonly id: string;
  readonly seccion: IdDeSeccion;
  readonly titulo: string;
  /** El componente que la pinta en `Configuracion.jsx` (se busca su etiqueta en el código). */
  readonly componente: string;
  /** Qué grupo de campos pinta, si el componente se reparte en varias tarjetas. */
  readonly grupo?: string;
  readonly visiblePara: VisiblePara;
  /** Las claves de `configuracion.valores` que guarda (vacío si guarda otra cosa o nada). */
  readonly guarda: readonly string[];
  /** Con qué guarda: el camino genérico, un comando, otra entidad o el aparato. */
  readonly con: string;
  /** Sólo en «Avanzado»: qué era el ajuste. */
  readonly queEra?: string;
}

const GENERICO = 'puente: ConfiguracionNegocio.update';
const APARATO = 'este aparato (almacén del navegador)';

export const TARJETAS: readonly Tarjeta[] = [
  {
    id: 'datos-del-negocio',
    seccion: 'el-negocio',
    titulo: 'Datos del negocio',
    componente: 'TarjetaDeAjustes',
    grupo: 'datos-del-negocio',
    visiblePara: 'todos',
    guarda: ['nombre_negocio', 'direccion', 'telefono', 'correo', 'rfc'],
    con: GENERICO,
  },
  {
    id: 'logo-y-marca',
    seccion: 'el-negocio',
    titulo: 'Logo y marca',
    componente: 'IdentidadNegocio',
    grupo: 'marca',
    visiblePara: 'todos',
    guarda: ['logo_url', 'nombre_sistema', 'platform_brand'],
    con: GENERICO,
  },

  {
    id: 'estilo',
    seccion: 'apariencia',
    titulo: 'Estilo visual',
    componente: 'SelectorDeApariencia',
    visiblePara: 'todos',
    guarda: [],
    con: 'configuracion.fijar_apariencia (sólo dueño)',
  },
  {
    id: 'colores',
    seccion: 'apariencia',
    titulo: 'Colores del sistema',
    componente: 'ColoresSistemaSection',
    visiblePara: 'todos',
    guarda: ['color_primario', 'color_acento'],
    con: GENERICO,
  },
  {
    id: 'fondo',
    seccion: 'apariencia',
    titulo: 'Fondo del sistema',
    componente: 'IdentidadNegocio',
    grupo: 'fondo',
    visiblePara: 'todos',
    guarda: ['background_image_url', 'background_logo_url', 'background_opacity', 'background_fit'],
    con: GENERICO,
  },
  {
    id: 'importes-en-color',
    seccion: 'apariencia',
    titulo: 'Importes en color',
    componente: 'IdentidadNegocio',
    grupo: 'importes',
    visiblePara: 'todos',
    guarda: ['colorear_importes_monetarios'],
    con: GENERICO,
  },
  {
    id: 'morfi',
    seccion: 'apariencia',
    titulo: 'Mascota Morfi',
    componente: 'ExperienciaDelNegocio',
    grupo: 'morfi',
    visiblePara: 'todos',
    guarda: ['experiencia.mascota'],
    con: '/api/datos/escribir (parche `experiencia`)',
  },

  {
    id: 'iva',
    seccion: 'ventas-y-cobro',
    titulo: 'IVA',
    componente: 'IvaDelNegocio',
    visiblePara: 'todos',
    guarda: ['impuesto'],
    con: 'configuracion.fijar_impuesto',
  },
  {
    id: 'propinas',
    seccion: 'ventas-y-cobro',
    titulo: 'Propinas',
    componente: 'TarjetaDeAjustes',
    grupo: 'propinas',
    visiblePara: 'todos',
    guarda: ['propinas_activas', 'propina_porcentajes_sugeridos'],
    con: GENERICO,
  },
  {
    id: 'quien-elige-la-propina',
    seccion: 'ventas-y-cobro',
    titulo: '¿Quién puede elegir la propina?',
    componente: 'QuienEligeLaPropina',
    visiblePara: 'todos',
    guarda: ['propina_la_elige_mesero', 'propina_la_elige_caja'],
    con: 'configuracion.fijar_quien_elige_la_propina',
  },
  {
    id: 'descuentos',
    seccion: 'ventas-y-cobro',
    titulo: 'Permitir descuentos',
    componente: 'PermitirDescuentos',
    visiblePara: 'mando',
    guarda: ['descuentos_permitidos'],
    con: 'configuracion.permitir_descuentos',
  },

  {
    id: 'ticket',
    seccion: 'ticket-y-folios',
    titulo: 'Ticket',
    componente: 'TarjetaDeAjustes',
    grupo: 'ticket',
    visiblePara: 'todos',
    guarda: ['mensaje_ticket', 'ancho_papel_ticket', 'ticket_footer'],
    con: GENERICO,
  },
  {
    id: 'papel-a-tu-gusto',
    seccion: 'ticket-y-folios',
    titulo: 'El ticket a tu gusto',
    componente: 'PapelATuGusto',
    visiblePara: 'todos',
    guarda: ['papel_a_tu_gusto'],
    con: 'caja.fijar_papel_a_tu_gusto',
  },
  {
    id: 'logos-de-papel',
    seccion: 'ticket-y-folios',
    titulo: 'Logos del ticket y de los PDF',
    componente: 'IdentidadNegocio',
    grupo: 'logos-de-papel',
    visiblePara: 'todos',
    guarda: ['logo_ticket_url', 'logo_pdf_url'],
    con: GENERICO,
  },
  {
    id: 'pdf-y-reportes',
    seccion: 'ticket-y-folios',
    titulo: 'PDF del corte y reportes',
    componente: 'TarjetaDeAjustes',
    grupo: 'pdf-y-reportes',
    visiblePara: 'todos',
    guarda: ['pdf_footer'],
    con: GENERICO,
  },
  {
    id: 'folios',
    seccion: 'ticket-y-folios',
    titulo: 'Folios',
    componente: 'FoliosDelNegocio',
    visiblePara: 'todos',
    guarda: ['folios'],
    con: 'configuracion.fijar_folios (sólo dueño)',
  },
  {
    id: 'copias',
    seccion: 'ticket-y-folios',
    titulo: 'Copias de impresión',
    componente: 'CopiasDeImpresion',
    visiblePara: 'todos',
    guarda: ['copias_de_impresion'],
    con: 'caja.fijar_copias_de_impresion',
  },

  {
    id: 'las-cajas',
    seccion: 'caja',
    titulo: 'Cajas abiertas a la vez',
    componente: 'CajasALaVez',
    visiblePara: 'mando',
    guarda: ['nombres_de_cajas'],
    con: 'caja.fijar_cajas_simultaneas y caja.nombrar_cajas',
  },
  {
    id: 'pin-en-retiros',
    seccion: 'caja',
    titulo: 'PIN en retiros',
    componente: 'UmbralDeRetiro',
    visiblePara: 'mando',
    guarda: ['retiro_pin_arriba_de_centavos'],
    con: 'caja.fijar_umbral_de_retiro',
  },
  {
    id: 'corte-de-la-caja',
    seccion: 'caja',
    titulo: 'El corte de la caja',
    componente: 'CorteDeLaCaja',
    visiblePara: 'mando',
    guarda: ['mostrar_costos_a_caja', 'comision_terminal_bp'],
    con: 'caja.fijar_ajustes_del_corte',
  },
  {
    id: 'pdf-al-cerrar',
    seccion: 'caja',
    titulo: 'PDF del corte al cerrar',
    componente: 'TarjetaDeAjustes',
    grupo: 'pdf-al-cerrar',
    visiblePara: 'todos',
    guarda: ['descargar_pdf_corte_auto'],
    con: GENERICO,
  },

  {
    id: 'mapa-de-mesas',
    seccion: 'salon',
    titulo: 'Mapa de mesas',
    componente: 'MapaDeMesasDeConfiguracion',
    visiblePara: 'mesas',
    guarda: [],
    con: 'entidades Mesa y Zona; comandos del salón',
  },
  {
    id: 'asignacion-de-mesas',
    seccion: 'salon',
    titulo: 'Asignación de mesas a meseros',
    componente: 'TarjetaDeAjustes',
    grupo: 'asignacion-de-mesas',
    visiblePara: 'todos',
    guarda: ['asignacion_mesas_activa'],
    con: GENERICO,
  },

  {
    id: 'estaciones',
    seccion: 'cocina',
    titulo: 'Estaciones de preparación',
    componente: 'EstacionesDeCocina',
    visiblePara: 'todos',
    guarda: ['estaciones_preparacion_activas'],
    con: `${GENERICO}; entidad EstacionPreparacion`,
  },
  {
    id: 'alertas-de-espera',
    seccion: 'cocina',
    titulo: 'Alertas de espera de la cocina',
    componente: 'AlertasDeEsperaDeCocina',
    visiblePara: 'todos',
    guarda: ['cocina_alerta_ambar_min', 'cocina_alerta_roja_min'],
    con: GENERICO,
  },
  {
    id: 'voz-de-las-comandas',
    seccion: 'cocina',
    titulo: 'Así se oye una comanda',
    componente: 'PruebaDeLaVozDeComandas',
    visiblePara: 'todos',
    guarda: [],
    con: 'nada (es una prueba)',
  },

  {
    id: 'portal-activacion',
    seccion: 'portal',
    titulo: 'Activación y menú',
    componente: 'ConfiguracionQRTab',
    grupo: 'activacion',
    visiblePara: 'portal',
    guarda: [
      'portal_qr_activo',
      'portal_qr_modo_menu',
      'portal_qr_mostrar_precios',
      'portal_qr_mostrar_sin_imagen',
      'portal_qr_mensaje_bienvenida',
    ],
    con: GENERICO,
  },
  {
    id: 'portal-pedidos',
    seccion: 'portal',
    titulo: 'Pedidos desde el portal',
    componente: 'ConfiguracionQRTab',
    grupo: 'pedidos',
    visiblePara: 'portal',
    guarda: [
      'portal_qr_envia_a_cocina',
      'portal_qr_comensales_abren_mesa',
      'portal_qr_permitir_pedidos_cliente',
    ],
    con: GENERICO,
  },
  {
    id: 'portal-cuenta',
    seccion: 'portal',
    titulo: 'Cuenta y propina desde QR',
    componente: 'ConfiguracionQRTab',
    grupo: 'cuenta',
    visiblePara: 'portal',
    guarda: [
      'portal_qr_permitir_ordenar',
      'portal_qr_permitir_cuenta',
      'portal_qr_permitir_ayuda',
      'portal_qr_cuenta_modo',
      'portal_qr_mostrar_precuenta',
      'portal_qr_permitir_propina_cliente',
    ],
    con: GENERICO,
  },

  {
    id: 'categorias',
    seccion: 'productos',
    titulo: 'Categorías de productos',
    componente: 'CategoriasProductoSection',
    visiblePara: 'todos',
    guarda: [],
    con: 'entidad CategoriaProducto',
  },
  {
    id: 'unidades',
    seccion: 'productos',
    titulo: 'Unidades de medida',
    componente: 'UnidadesMedidaSection',
    visiblePara: 'todos',
    guarda: ['unidades_medida_lista'],
    con: GENERICO,
  },
  {
    id: 'proveedores',
    seccion: 'productos',
    titulo: 'Proveedores',
    componente: 'ProveedoresSection',
    visiblePara: 'todos',
    guarda: [],
    con: 'entidad Proveedor',
  },

  {
    id: 'usuarios-pos',
    seccion: 'personas',
    titulo: 'Usuarios POS',
    componente: 'UsuariosPOSSection',
    visiblePara: 'todos',
    guarda: [],
    con: '/api/identidad/empleados',
  },
  {
    id: 'pin-al-despertar',
    seccion: 'personas',
    titulo: 'Pedir PIN al despertar',
    componente: 'ExperienciaDelNegocio',
    grupo: 'pin',
    visiblePara: 'todos',
    guarda: ['experiencia.pin_al_despertar'],
    con: '/api/datos/escribir (parche `experiencia`)',
  },
  {
    id: 'candado-de-mando',
    seccion: 'personas',
    titulo: 'Entrar con PIN',
    componente: 'CandadoDeMando',
    visiblePara: 'mando',
    guarda: ['candado_de_mando_min'],
    con: 'configuracion.fijar_candado_de_mando',
  },

  {
    id: 'sonidos-de-cada-momento',
    seccion: 'sonidos',
    titulo: 'Sonidos de cada momento',
    componente: 'SonidosDelNegocio',
    visiblePara: 'todos',
    guarda: ['experiencia.tecla', 'experiencia.sonidos_en_el_portal'],
    con: '/api/datos/escribir (parche `experiencia`)',
  },
  {
    id: 'avisos-del-administrador',
    seccion: 'sonidos',
    titulo: 'Avisos del administrador',
    componente: 'TarjetaDeAjustes',
    grupo: 'avisos-del-administrador',
    visiblePara: 'todos',
    guarda: ['silenciar_notificaciones_admin'],
    con: GENERICO,
  },

  {
    id: 'exportar',
    seccion: 'datos',
    titulo: 'Exportar datos actuales',
    componente: 'ExportarDatos',
    visiblePara: 'mando',
    guarda: [],
    con: 'nada (descarga)',
  },
  {
    id: 'importar',
    seccion: 'datos',
    titulo: 'Importar datos desde archivo',
    componente: 'ImportarDatos',
    visiblePara: 'mando',
    guarda: [],
    con: 'las entidades que se importan',
  },

  {
    id: 'nombre-del-aparato',
    seccion: 'este-aparato',
    titulo: 'Nombre de este aparato',
    componente: 'AparatosDeLaSucursal',
    visiblePara: 'todos',
    guarda: [],
    con: 'caja.nombrar_terminal',
  },
  {
    id: 'impresora-y-cajon',
    seccion: 'este-aparato',
    titulo: 'Impresora de este aparato',
    componente: 'ImpresionDelAparato',
    visiblePara: 'todos',
    guarda: [],
    con: APARATO,
  },
  {
    id: 'sonido-del-aparato',
    seccion: 'este-aparato',
    titulo: 'Sonidos de este aparato',
    componente: 'SonidoDelAparato',
    visiblePara: 'todos',
    guarda: [],
    con: APARATO,
  },
  {
    id: 'modo-espera',
    seccion: 'este-aparato',
    titulo: 'Modo espera en este aparato',
    componente: 'ModoEsperaDelAparato',
    visiblePara: 'todos',
    guarda: [],
    con: APARATO,
  },
  {
    id: 'voz-del-aparato',
    seccion: 'este-aparato',
    titulo: 'Voz de los avisos',
    componente: 'ConfiguracionDeVoz',
    visiblePara: 'todos',
    guarda: [],
    con: APARATO,
  },
  {
    id: 'anuncio-de-comandas',
    seccion: 'este-aparato',
    titulo: 'Esta pantalla anuncia las comandas',
    componente: 'AnuncioDeComandasDelAparato',
    visiblePara: 'todos',
    guarda: [],
    con: APARATO,
  },
  {
    id: 'barra-lateral',
    seccion: 'este-aparato',
    titulo: 'Barra lateral',
    componente: 'BarraLateralDelAparato',
    visiblePara: 'todos',
    guarda: [],
    con: `${APARATO}: mpos.barra-lateral`,
  },

  {
    id: 'laboratorio',
    seccion: 'laboratorio',
    titulo: 'Hardware y pruebas de impresión',
    componente: 'EntradaAlLaboratorio',
    visiblePara: 'todos',
    guarda: [],
    con: '/api/proveedor/entrar y salir',
  },
  {
    id: 'reiniciar-sistema',
    seccion: 'mantenimiento',
    titulo: 'Reiniciar sistema para cliente',
    componente: 'ReiniciarSistemaSection',
    visiblePara: 'plataforma',
    guarda: [],
    con: 'mantenimiento.reiniciar_pruebas y mantenimiento.reiniciar_todo',
  },

  {
    id: 'usar-mesas',
    seccion: 'avanzado',
    titulo: 'Usar mesas',
    componente: 'TarjetaDeAjustes',
    grupo: 'usar-mesas',
    visiblePara: 'fuera-del-restaurante',
    guarda: ['usa_mesas'],
    con: GENERICO,
    queEra:
      'Un interruptor que sólo lee el paso «Configura las mesas» de Primeros pasos: apagarlo no esconde mesas, mapa ni mesero. En un restaurante apagarlo no tiene sentido y puede romper el flujo: se esconde con el paquete restaurante (sigue guardado, no se borra).',
  },
  {
    id: 'vender-sin-existencia',
    seccion: 'avanzado',
    titulo: 'Permitir venta sin stock',
    componente: 'TarjetaDeAjustes',
    grupo: 'vender-sin-existencia',
    visiblePara: 'todos',
    guarda: ['permitir_venta_sin_stock'],
    con: GENERICO,
    queEra:
      'Manda la opción de cada producto (`permite_venta_sin_stock`) y, desde DP-D116, lo que pasó por cocina se cobra aunque no haya existencia; este interruptor del negocio no cambia lo que se cobra. Se queda aquí, explicándolo, y no se borra (DP-D135).',
  },
  {
    id: 'texto-legal',
    seccion: 'avanzado',
    titulo: 'Texto legal o pie general',
    componente: 'TarjetaDeAjustes',
    grupo: 'texto-legal',
    visiblePara: 'todos',
    guarda: ['footer_text'],
    con: GENERICO,
    queEra: 'Un texto que se guarda pero que ningún ticket, PDF o corte imprime todavía.',
  },
];

export interface QuienMira {
  /** El puesto real: `dueno`, `administrador`, `gerente`, `cajero`… (`usePuesto`). */
  readonly puesto: string | null;
  /** El negocio tiene el módulo de mesas. */
  readonly tieneMesas: boolean;
  /** El rol de la sesión es `administrador` (el vocabulario de cuatro roles de `posUser.rol`). */
  readonly rolAdministrador: boolean;
  /** Es el usuario de plataforma. */
  readonly esPlataforma: boolean;
  /** El paquete del negocio (`restaurante`, `tienda`…): decide lo que se esconde para el restaurante. */
  readonly paquete: string | null;
}

const PUESTOS_DE_MANDO: readonly string[] = ['dueno', 'administrador'];

export function laVe(tarjeta: Pick<Tarjeta, 'visiblePara'>, quien: QuienMira): boolean {
  switch (tarjeta.visiblePara) {
    case 'todos':
      return true;
    case 'mando':
      return quien.puesto !== null && PUESTOS_DE_MANDO.includes(quien.puesto);
    case 'mesas':
      return quien.tieneMesas;
    case 'fuera-del-restaurante':
      return quien.paquete !== 'restaurante';
    case 'portal':
      return quien.rolAdministrador;
    case 'plataforma':
      return quien.rolAdministrador && quien.esPlataforma;
  }
}

export function tarjetasDe(id: IdDeSeccion, quien: QuienMira): readonly Tarjeta[] {
  return TARJETAS.filter((t) => t.seccion === id && laVe(t, quien));
}

/** Las secciones que esta persona ve: las que tienen al menos una tarjeta suya. */
export function seccionesVisibles(quien: QuienMira): readonly Seccion[] {
  return SECCIONES.filter((s) => tarjetasDe(s.id, quien).length > 0);
}

/**
 * Los `?tab=` de antes y la sección a la que llevan. Siguen sirviendo para siempre: hay enlaces
 * desde el tablero, el aviso de impresión y las pruebas.
 */
export const TABS_DE_ANTES: Readonly<Record<string, IdDeSeccion>> = {
  identidad: 'el-negocio',
  apariencia: 'apariencia',
  aparato: 'este-aparato',
  impresion: 'este-aparato',
  sonidos: 'sonidos',
  negocio: 'ventas-y-cobro',
  usuarios: 'personas',
  caja: 'caja',
  descuentos: 'ventas-y-cobro',
  mesas: 'salon',
  datos: 'datos',
  integraciones: 'datos',
  mantenimiento: 'mantenimiento',
};

/** La ancla dentro de la sección a la que lleva un `?tab=` de antes, si apunta a una tarjeta. */
export const ANCLAS_DE_ANTES: Readonly<Record<string, string>> = {
  impresion: 'impresora-y-cajon',
  usuarios: 'usuarios-pos',
  descuentos: 'descuentos',
  mesas: 'mapa-de-mesas',
};

const SECCION_POR_OMISION: IdDeSeccion = 'el-negocio';

export function esSeccion(valor: string | null | undefined): valor is IdDeSeccion {
  return SECCIONES.some((s) => s.id === valor);
}

export interface DestinoDeLaUrl {
  readonly seccion: IdDeSeccion;
  readonly ancla: string | null;
}

/**
 * A dónde lleva una dirección: `?seccion=` (la de ahora) o `?tab=` (la de antes). Sin nada, o con
 * algo que no existe, la primera sección.
 */
export function destinoDeLaUrl(busqueda: string): DestinoDeLaUrl {
  const parametros = new URLSearchParams(busqueda);
  const nueva = parametros.get('seccion');
  if (esSeccion(nueva)) return { seccion: nueva, ancla: parametros.get('tarjeta') };
  const vieja = parametros.get('tab');
  if (vieja !== null && Object.hasOwn(TABS_DE_ANTES, vieja)) {
    const seccion = TABS_DE_ANTES[vieja];
    if (seccion !== undefined) return { seccion, ancla: ANCLAS_DE_ANTES[vieja] ?? null };
  }
  return { seccion: SECCION_POR_OMISION, ancla: null };
}

/**
 * La sección a mostrar: la de la dirección si esta persona la ve; si no, la primera que sí. Así un
 * `?tab=caja` de un cajero no abre nada que no veía (cae en lo primero que ve).
 */
export function seccionAMostrar(
  destino: DestinoDeLaUrl,
  visibles: readonly Seccion[],
): IdDeSeccion | null {
  if (visibles.some((s) => s.id === destino.seccion)) return destino.seccion;
  return visibles[0]?.id ?? null;
}

export function direccionDeLaSeccion(id: IdDeSeccion): string {
  return `/configuracion?seccion=${id}`;
}
