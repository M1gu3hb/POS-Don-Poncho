/**
 * DP-21 · Bloque 21 · A DÓNDE FUE CADA CONTROL DE LA CONFIGURACIÓN.
 *
 * La fotografía de «antes» (`docs/configuracion-inventario-antes.json`) lista cada control de la
 * Configuración que existía antes de la mudanza. Aquí, para cada archivo de entonces, la tarjeta
 * nueva (`secciones.ts`) donde vive hoy; y, para los archivos que se repartieron en varias
 * tarjetas, qué textos van a cuál. `ahora` es el texto nuevo cuando el título cambió de nombre.
 * Un control que no está aquí, o cuyo texto ya no aparece en su tarjeta, rompe la prueba.
 */

export const QUITADO = 'quitado';

/** Los archivos de entonces que se mudaron ENTEROS a una sola tarjeta. */
export const TARJETA_POR_ARCHIVO: Readonly<Record<string, string>> = {
  'apps/web/heredado/components/configuracion/ColoresSistemaSection.jsx': 'colores',
  'apps/web/heredado/components/configuracion/ConfiguracionDeVoz.jsx': 'voz-del-aparato',
  'apps/web/heredado/components/configuracion/UsuariosPOSSection.jsx': 'usuarios-pos',
  'apps/web/heredado/components/configuracion/IntegracionesRespaldos.jsx': QUITADO,
  'apps/web/heredado/components/configuracion/ReiniciarSistemaSection.jsx': 'reiniciar-sistema',
  'apps/web/heredado/components/configuracion/CategoriasProductoSection.jsx': 'categorias',
  'apps/web/heredado/components/configuracion/EstacionesPreparacionSection.jsx': 'estaciones',
  'apps/web/heredado/components/configuracion/UnidadesMedidaSection.jsx': 'unidades',
  'apps/web/heredado/components/configuracion/ProveedoresSection.jsx': 'proveedores',
  'apps/web/heredado/components/datos/DatosSection.jsx': 'exportar',
  'apps/web/heredado/components/datos/ExportarDatos.jsx': 'exportar',
  'apps/web/heredado/components/datos/ImportarDatos.jsx': 'importar',
  'apps/web/src/configuracion/SelectorDeApariencia.tsx': 'estilo',
  'apps/web/src/configuracion/SonidosDelNegocio.tsx': 'sonidos-de-cada-momento',
  'apps/web/src/configuracion/PruebaDeLaVozDeComandas.tsx': 'voz-de-las-comandas',
  'apps/web/src/configuracion/SonidoDelAparato.tsx': 'sonido-del-aparato',
  'apps/web/src/configuracion/ModoEsperaDelAparato.tsx': 'modo-espera',
  'apps/web/src/configuracion/AnuncioDeComandasDelAparato.tsx': 'anuncio-de-comandas',
  'apps/web/src/configuracion/TerminalesDeLaSucursal.tsx': 'nombre-del-aparato',
  'apps/web/src/configuracion/NombresDeLasCajas.tsx': 'las-cajas',
  'apps/web/src/configuracion/UmbralDeRetiro.tsx': 'pin-en-retiros',
  'apps/web/src/configuracion/CandadoDeMando.tsx': 'candado-de-mando',
  'apps/web/src/configuracion/QuienEligeLaPropina.tsx': 'quien-elige-la-propina',
  'apps/web/src/configuracion/IvaDelNegocio.tsx': 'iva',
  'apps/web/src/configuracion/FoliosDelNegocio.tsx': 'folios',
  'apps/web/src/impresion/pantallas/ImpresionDelAparato.tsx': 'impresora-y-cajon',
  'apps/web/src/impresion/pantallas/AjustesDeLaApp.tsx': 'impresora-y-cajon',
  'apps/web/src/impresion/pantallas/LabProbarCajon.tsx': 'impresora-y-cajon',
  'apps/web/src/impresion/pantallas/CopiasDeImpresion.tsx': 'copias',
  'apps/web/src/impresion/pantallas/EntradaAlLaboratorio.tsx': 'laboratorio',
  'apps/web/src/cocina/AlertasDeEspera.tsx': 'alertas-de-espera',
};

export interface DestinoDeUnTexto {
  readonly archivo: string;
  readonly texto: string;
  readonly tarjeta: string;
  /** El texto nuevo, si el título cambió al mudarse. */
  readonly ahora?: string;
  /** Por qué se quita, si `tarjeta` es `quitado`. */
  readonly razon?: string;
}

const CFG = 'apps/web/heredado/pages/Configuracion.jsx';
const IDN = 'apps/web/heredado/components/configuracion/IdentidadNegocio.jsx';
const QR = 'apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx';
const EXP = 'apps/web/src/configuracion/ExperienciaDelNegocio.tsx';
const CAJ = 'apps/web/src/configuracion/CajaYDescuentos.tsx';

const d = (
  archivo: string,
  tarjeta: string,
  textos: readonly string[],
  ahora?: string,
): DestinoDeUnTexto[] =>
  textos.map((texto) => ({ archivo, texto, tarjeta, ...(ahora === undefined ? {} : { ahora }) }));

/** Los archivos que se repartieron en varias tarjetas: cada texto con la suya. */
export const DESTINOS_POR_TEXTO: readonly DestinoDeUnTexto[] = [
  // ── Configuracion.jsx: el formulario único de «Operación» se partió en tarjetas ───────────────
  ...d(CFG, 'datos-del-negocio', ['Datos del negocio', 'Dirección', 'Teléfono', 'Correo']),
  ...d(CFG, 'ticket', ['Mensaje en ticket', 'Ancho del papel del ticket', '58 mm', '80 mm']),
  ...d(CFG, 'usar-mesas', ['Usar mesas']),
  ...d(CFG, 'vender-sin-existencia', ['Permitir venta sin stock']),
  ...d(CFG, 'propinas', [
    'Propinas',
    'Activar propinas',
    'Porcentajes sugeridos (separados por coma)',
  ]),
  ...d(CFG, 'pdf-al-cerrar', ['Abrir PDF automático al cerrar caja']),
  ...d(CFG, 'asignacion-de-mesas', ['Activar asignación de mesas a meseros'], undefined),
  {
    archivo: CFG,
    texto: 'Asignación de mesas y notificaciones',
    tarjeta: 'asignacion-de-mesas',
    ahora: 'Asignación de mesas a meseros',
  },
  ...d(CFG, 'avisos-del-administrador', ['Silenciar notificaciones del administrador']),
  {
    archivo: CFG,
    texto: 'Pedidos desde Portal QR',
    tarjeta: 'portal-pedidos',
    ahora: 'Pedidos desde el portal',
  },
  ...d(CFG, 'portal-pedidos', ['Permitir que el comensal envíe pedidos desde el QR']),
  {
    archivo: CFG,
    texto: 'Guardar configuración',
    tarjeta: QUITADO,
    razon:
      'El botón único que mandaba todo el formulario: cada tarjeta guarda lo suyo, con su «Guardar» y su «Guardado».',
  },
  ...d(CFG, 'estaciones', [
    'Estaciones de preparación',
    'Activar estaciones de preparación',
    'Guardar',
  ]),
  ...d(CFG, 'mapa-de-mesas', [
    'Mapa de mesas',
    'Nueva mesa',
    'Mesas desactivadas',
    'setShowRepartir(true)}> Repartir mesas',
    'setShowZonas(true)}> Zonas',
    'reactivarMesa(m)}> Reactivar',
    'setShowEliminarMesas(false)}> Cancelar',
  ]),

  // ── IdentidadNegocio.jsx: una tarjeta por grupo ───────────────────────────────────────────────
  ...d(IDN, 'datos-del-negocio', ['Nombre del negocio']),
  ...d(IDN, 'logo-y-marca', ['Nombre del sistema', 'Plataforma (marca)', 'Logo del negocio']),
  { archivo: IDN, texto: 'Logos del negocio', tarjeta: 'logo-y-marca', ahora: 'Logo y marca' },
  ...d(IDN, 'logos-de-papel', ['Logo en tickets', 'Logo en PDFs']),
  { archivo: IDN, texto: 'Fondo del sistema', tarjeta: 'fondo', ahora: 'Fondo del sistema' },
  ...d(IDN, 'fondo', [
    'Opacidad del fondo: %',
    'Fondo del sistema (imagen completa)',
    'Logo de fondo (marca de agua)',
    'Ajuste del fondo',
    'Cubrir toda la pantalla (recomendado)',
    'Mostrar imagen completa',
  ]),
  {
    archivo: IDN,
    texto: 'Pie de tickets y PDFs',
    tarjeta: 'ticket',
    ahora: 'Pie del ticket térmico',
  },
  ...d(IDN, 'ticket', ['Pie del ticket térmico']),
  ...d(IDN, 'pdf-y-reportes', ['Pie de los PDFs']),
  ...d(IDN, 'texto-legal', ['Texto legal o pie general']),
  { archivo: IDN, texto: 'Apariencia', tarjeta: 'importes-en-color', ahora: 'Importes en color' },
  ...d(IDN, 'importes-en-color', ['Colorear importes monetarios']),

  // ── ExperienciaDelNegocio.tsx: Morfi y el PIN al despertar ────────────────────────────────────
  ...d(EXP, 'morfi', ['Experiencia del negocio', 'Mascota Morfi']),
  ...d(EXP, 'pin-al-despertar', ['Pedir PIN al despertar']),

  // ── CajaYDescuentos.tsx: las cajas y los descuentos ──────────────────────────────────────────
  ...d(CAJ, 'descuentos', ['Permitir descuentos', 'No se pudieron leer los topes de cada puesto.']),
  ...d(CAJ, 'las-cajas', [
    'Cajas abiertas a la vez',
    'No se pudo leer cuántas cajas puede haber.',
    'void lectura.refetch()}> Reintentar',
  ]),

  // ── ConfiguracionQRTab.jsx: el portal en tres tarjetas ───────────────────────────────────────
  ...d(QR, 'portal-pedidos', [
    'Pedidos desde el portal',
    'Quién manda a cocina',
    'Sólo el mesero confirma y envía',
    'También los comensales',
    'Los comensales pueden abrir su mesa',
  ]),
  ...d(QR, 'portal-cuenta', [
    'Botones de atención del cliente',
    'Quiero ordenar',
    'Pedir cuenta',
    'Necesito ayuda',
    'Cuenta y propina desde QR',
    '¿Quién dispara la pantalla de propina del QR?',
    'Mesero dispara (recomendado)',
    'Cliente solicita',
    'Ambos',
    'Mostrar precuenta al cliente',
    'Propina elegida por comensal desde QR',
  ]),
];

/** El resto de lo que decía `ConfiguracionQRTab.jsx` (activar, menú, precios, bienvenida). */
export const TARJETA_POR_OMISION: Readonly<Record<string, string>> = {
  [QR]: 'portal-activacion',
  [IDN]: 'logo-y-marca',
};

/** Los archivos donde vive el texto de cada tarjeta nueva (además del componente que la pinta). */
export const ARCHIVOS_DE_LA_TARJETA: Readonly<Record<string, readonly string[]>> = {
  'datos-del-negocio': ['apps/web/src/configuracion/ajustes-de-tarjetas.ts', IDN],
  propinas: ['apps/web/src/configuracion/ajustes-de-tarjetas.ts'],
  ticket: ['apps/web/src/configuracion/ajustes-de-tarjetas.ts'],
  'pdf-y-reportes': ['apps/web/src/configuracion/ajustes-de-tarjetas.ts'],
  'pdf-al-cerrar': ['apps/web/src/configuracion/ajustes-de-tarjetas.ts'],
  'asignacion-de-mesas': ['apps/web/src/configuracion/ajustes-de-tarjetas.ts'],
  'avisos-del-administrador': ['apps/web/src/configuracion/ajustes-de-tarjetas.ts'],
  'usar-mesas': ['apps/web/src/configuracion/ajustes-de-tarjetas.ts'],
  'vender-sin-existencia': ['apps/web/src/configuracion/ajustes-de-tarjetas.ts'],
  'texto-legal': ['apps/web/src/configuracion/ajustes-de-tarjetas.ts'],
  'mapa-de-mesas': ['apps/web/heredado/components/configuracion/MapaDeMesasDeConfiguracion.jsx'],
  estaciones: [
    'apps/web/heredado/components/configuracion/EstacionesDeCocina.jsx',
    'apps/web/heredado/components/configuracion/EstacionesPreparacionSection.jsx',
  ],
  'portal-pedidos': [QR],
  'portal-cuenta': [QR],
  'portal-activacion': [QR],
  'logo-y-marca': [IDN],
  'logos-de-papel': [IDN],
  fondo: [IDN],
  'importes-en-color': [IDN],
  morfi: [EXP],
  'pin-al-despertar': [EXP],
  descuentos: [CAJ],
  'las-cajas': [CAJ, 'apps/web/src/configuracion/NombresDeLasCajas.tsx'],
};
