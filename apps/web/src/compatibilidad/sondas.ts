/**
 * «PROBAR COMPATIBILIDAD» (DP-20.1) · qué entiende el motor de ESTE aparato.
 *
 * Los POS con Android viejo traen un WebView que no se puede actualizar (el iMin D4-503: Chromium
 * 99–103). Para saber con qué motor trabaja cada aparato no se mira su nombre: se le pregunta, cosa
 * por cosa. La misma lista, con los mismos `id`, la enseña el Diagnóstico de la app
 * (`compartido/pantallas/compatibilidad.js` en `morphiq-pos-apps`) y queda en la auditoría cuando
 * el aparato entra al laboratorio.
 *
 * Es lógica pura: recibe la ventana, no la busca. Así se prueba sin navegador.
 */

/** Lo que una sonda necesita de la ventana. Todo opcional: en un motor viejo puede no existir. */
export interface VentanaSondeable {
  readonly navigator?: { readonly userAgent?: string } | undefined;
  readonly CSS?: { supports?: (...partes: string[]) => boolean } | undefined;
  readonly document?: unknown;
  readonly [nombre: string]: unknown;
}

export type NivelDelMotor = 'moderno' | 'compatible' | 'demasiado-viejo';

export interface SondaProbada {
  readonly id: string;
  readonly etiqueta: string;
  readonly pasa: boolean;
}

export interface ResultadoDeCompatibilidad {
  readonly ua: string;
  /** `99.0.4844.0`, o `null` si el motor no es Chromium. */
  readonly chromium: string | null;
  readonly mayor: number | null;
  readonly nivel: NivelDelMotor;
  readonly sondas: readonly SondaProbada[];
}

interface Sonda {
  readonly id: string;
  readonly etiqueta: string;
  readonly pasa: (v: VentanaSondeable) => boolean;
}

const css =
  (propiedad: string, valor: string) =>
  (v: VentanaSondeable): boolean =>
    v.CSS?.supports?.(propiedad, valor) === true;
const selector =
  (prueba: string) =>
  (v: VentanaSondeable): boolean =>
    v.CSS?.supports?.(`selector(${prueba})`) === true;
const existe =
  (nombre: string) =>
  (v: VentanaSondeable): boolean =>
    typeof v[nombre] !== 'undefined';

/** `Array.prototype.at`, `HTMLElement.prototype.inert`… sin tocar lo que no exista. */
function enElPrototipo(clase: string, miembro: string) {
  return (v: VentanaSondeable): boolean => {
    const constructor = v[clase] as { prototype?: object } | undefined;
    return constructor?.prototype !== undefined && miembro in constructor.prototype;
  };
}
function estatico(clase: string, miembro: string) {
  return (v: VentanaSondeable): boolean => {
    const constructor = v[clase] as Record<string, unknown> | undefined;
    return typeof constructor?.[miembro] === 'function';
  };
}

/** `gap` en filas flexibles no se puede preguntar con `CSS.supports`: se mide. */
function separacionEnFlex(v: VentanaSondeable): boolean {
  const documento = v.document as Document | undefined;
  if (documento?.body == null) return false;
  const caja = documento.createElement('div');
  caja.style.cssText = 'display:flex;gap:10px;position:absolute;visibility:hidden';
  for (let i = 0; i < 2; i += 1) {
    const hijo = documento.createElement('div');
    hijo.style.cssText = 'width:10px;height:10px';
    caja.appendChild(hijo);
  }
  documento.body.appendChild(caja);
  const ancho = caja.offsetWidth;
  caja.remove();
  return ancho === 30;
}

/** Las cinco que deciden si el POS trabaja «tal cual» o en modo compatible. */
export const SONDAS_DEL_MODO_NATIVO = [
  'color-mix',
  'translate',
  'has',
  'dvh',
  'container',
] as const;

export const SONDAS: readonly Sonda[] = [
  { id: 'layer', etiqueta: 'Capas de estilo (@layer)', pasa: existe('CSSLayerBlockRule') },
  {
    id: 'property',
    etiqueta: 'Variables registradas (@property)',
    pasa: existe('CSSPropertyRule'),
  },
  {
    id: 'color-mix',
    etiqueta: 'Mezcla de colores (color-mix)',
    pasa: css('color', 'color-mix(in lab, red, red)'),
  },
  { id: 'translate', etiqueta: 'Traslado, escala y giro sueltos', pasa: css('translate', '0') },
  { id: 'has', etiqueta: 'Selector :has()', pasa: selector(':has(a)') },
  { id: 'dvh', etiqueta: 'Alto dinámico de pantalla (dvh)', pasa: css('height', '1dvh') },
  {
    id: 'container',
    etiqueta: 'Consultas de contenedor',
    pasa: css('container-type', 'inline-size'),
  },
  { id: 'gap-flex', etiqueta: 'Separación en filas flexibles (gap)', pasa: separacionEnFlex },
  { id: 'aspect-ratio', etiqueta: 'Proporción (aspect-ratio)', pasa: css('aspect-ratio', '1 / 1') },
  { id: 'inset', etiqueta: 'Posición abreviada (inset)', pasa: css('inset', '0') },
  {
    id: 'backdrop-filter',
    etiqueta: 'Desenfoque del fondo',
    pasa: (v) =>
      css('backdrop-filter', 'blur(1px)')(v) || css('-webkit-backdrop-filter', 'blur(1px)')(v),
  },
  {
    id: 'focus-visible',
    etiqueta: 'Foco visible (:focus-visible)',
    pasa: selector(':focus-visible'),
  },
  { id: 'nesting', etiqueta: 'Reglas anidadas', pasa: selector('&') },
  {
    id: 'text-wrap',
    etiqueta: 'Titulares equilibrados (text-wrap)',
    pasa: css('text-wrap', 'balance'),
  },
  {
    id: 'field-sizing',
    etiqueta: 'Campos que crecen (field-sizing)',
    pasa: css('field-sizing', 'content'),
  },
  { id: 'inert', etiqueta: 'Atributo inert', pasa: enElPrototipo('HTMLElement', 'inert') },
  { id: 'dialog', etiqueta: 'Diálogos nativos', pasa: existe('HTMLDialogElement') },
  {
    id: 'popover',
    etiqueta: 'Ventanas emergentes nativas (popover)',
    pasa: enElPrototipo('HTMLElement', 'popover'),
  },
  {
    id: 'view-transitions',
    etiqueta: 'Transiciones entre pantallas',
    pasa: (v) =>
      typeof (v.document as { startViewTransition?: unknown } | undefined)?.startViewTransition ===
      'function',
  },
  { id: 'structured-clone', etiqueta: 'structuredClone', pasa: existe('structuredClone') },
  { id: 'array-at', etiqueta: 'Array.at', pasa: enElPrototipo('Array', 'at') },
  { id: 'find-last', etiqueta: 'Array.findLast', pasa: enElPrototipo('Array', 'findLast') },
  { id: 'to-sorted', etiqueta: 'Array.toSorted', pasa: enElPrototipo('Array', 'toSorted') },
  { id: 'object-has-own', etiqueta: 'Object.hasOwn', pasa: estatico('Object', 'hasOwn') },
  { id: 'object-group-by', etiqueta: 'Object.groupBy', pasa: estatico('Object', 'groupBy') },
  {
    id: 'promise-with-resolvers',
    etiqueta: 'Promise.withResolvers',
    pasa: estatico('Promise', 'withResolvers'),
  },
  {
    id: 'abort-timeout',
    etiqueta: 'AbortSignal.timeout',
    pasa: estatico('AbortSignal', 'timeout'),
  },
  { id: 'intl-segmenter', etiqueta: 'Intl.Segmenter', pasa: estatico('Intl', 'Segmenter') },
  { id: 'resize-observer', etiqueta: 'ResizeObserver', pasa: existe('ResizeObserver') },
  {
    id: 'intersection-observer',
    etiqueta: 'IntersectionObserver',
    pasa: existe('IntersectionObserver'),
  },
  { id: 'offscreen-canvas', etiqueta: 'Lienzo fuera de pantalla', pasa: existe('OffscreenCanvas') },
  { id: 'create-image-bitmap', etiqueta: 'createImageBitmap', pasa: existe('createImageBitmap') },
  { id: 'crypto-uuid', etiqueta: 'crypto.randomUUID', pasa: estatico('crypto', 'randomUUID') },
  {
    id: 'wake-lock',
    etiqueta: 'Pantalla que no se apaga (wakeLock)',
    pasa: (v) => v.navigator !== undefined && 'wakeLock' in v.navigator,
  },
  { id: 'broadcast-channel', etiqueta: 'BroadcastChannel', pasa: existe('BroadcastChannel') },
];

/** La versión de Chromium que declara el motor, si la declara. */
export function chromiumDe(ua: string): string | null {
  return /(?:Chrome|Chromium|HeadlessChrome)\/(\d+(?:\.\d+){0,3})/.exec(ua)?.[1] ?? null;
}

export function nivelDe(sondas: readonly SondaProbada[]): NivelDelMotor {
  const pasa = (id: string): boolean => sondas.find((s) => s.id === id)?.pasa === true;
  if (!pasa('layer')) return 'demasiado-viejo';
  return SONDAS_DEL_MODO_NATIVO.every(pasa) ? 'moderno' : 'compatible';
}

/** Un motor que revienta al preguntarle por algo, no lo tiene. */
function pasaSinLanzar(sonda: Sonda, v: VentanaSondeable): boolean {
  try {
    return sonda.pasa(v);
  } catch {
    return false;
  }
}

/** Corre todas las sondas. Una que lanza, falla: nunca tumba la pantalla. */
export function probarCompatibilidad(v: VentanaSondeable): ResultadoDeCompatibilidad {
  const sondas = SONDAS.map((sonda) => ({
    id: sonda.id,
    etiqueta: sonda.etiqueta,
    pasa: pasaSinLanzar(sonda, v),
  }));
  const ua = v.navigator?.userAgent ?? '';
  const chromium = chromiumDe(ua);
  const mayor = chromium === null ? null : Number.parseInt(chromium, 10);
  return { ua, chromium, mayor, nivel: nivelDe(sondas), sondas };
}

export const AVISO_DEL_NIVEL: Readonly<Record<NivelDelMotor, string | null>> = {
  moderno: null,
  compatible: 'Este aparato usa un motor antiguo: el POS trabaja en modo compatible.',
  'demasiado-viejo': 'Este aparato es demasiado viejo para el POS. Pide ayuda a tu proveedor.',
};

/** Lo que se guarda en la auditoría al entrar al laboratorio: corto y sin datos de nadie. */
export interface MotorParaLaAuditoria {
  readonly ua: string;
  readonly mayor: number | null;
  readonly nivel: NivelDelMotor;
  readonly fallan: readonly string[];
}

export const LARGO_MAXIMO_DEL_UA = 400;

export function motorParaLaAuditoria(resultado: ResultadoDeCompatibilidad): MotorParaLaAuditoria {
  return {
    ua: resultado.ua.slice(0, LARGO_MAXIMO_DEL_UA),
    mayor: resultado.mayor,
    nivel: resultado.nivel,
    fallan: resultado.sondas.filter((s) => !s.pasa).map((s) => s.id),
  };
}
