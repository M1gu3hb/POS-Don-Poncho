/**
 * LLEVAR EL CAMPO ENFOCADO AL CENTRO, UNA VEZ (DP-21 · Bloque 9 · M16).
 *
 * Con el teclado en pantalla, la vista brincaba de golpe y el campo quedaba tapado. Ahora, al
 * enfocar un campo de texto en un aparato táctil: se ESPERA a que el `visualViewport` cambie (el
 * teclado subiendo) y se asiente, y entonces —si el campo no quedó ya a la vista— se lleva al centro
 * con `scrollIntoView({ block: 'center', behavior: 'smooth' })`. Una sola vez por foco, cancelable
 * (perder el foco, otro foco), y sin animar con «reducir movimiento».
 *
 * La decisión va aquí, con el reloj, el `visualViewport` y el DOM entrando por parámetro, para
 * probarla sin navegador. `montarLlevarAlCentro` (abajo) la conecta al documento de verdad.
 */

/** Cuánto aire debe tener un campo sobre el teclado y bajo el encabezado para contar «a la vista». */
export const MARGEN_DEL_CAMPO_PX = 24;
/** Sin cambio del visualViewport (el teclado ya estaba arriba, o es físico): se lleva tras esto. */
export const ESPERA_SIN_CAMBIO_MS = 500;
/** Tras el último cambio del visualViewport: lo que el teclado tarda en asentarse. */
export const ESPERA_DE_ASENTARSE_MS = 120;
/** Aunque el visualViewport no deje de cambiar, se lleva al llegar a este tope desde el primero. */
export const TOPE_DE_ESPERA_MS = 700;

const TIPOS_SIN_TECLADO = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'file',
  'range',
  'color',
  'image',
  'hidden',
]);

interface CampoPosible {
  readonly tagName?: string;
  readonly type?: string;
  readonly isContentEditable?: boolean;
}

/** ¿Es un campo donde se teclea (y por tanto sale el teclado en pantalla)? */
export function esCampoDeTexto(elemento: CampoPosible | null): boolean {
  if (elemento === null) return false;
  if (elemento.isContentEditable === true) return true;
  const etiqueta = elemento.tagName?.toUpperCase();
  if (etiqueta === 'TEXTAREA') return true;
  return etiqueta === 'INPUT' && !TIPOS_SIN_TECLADO.has((elemento.type ?? '').toLowerCase());
}

export interface CajaVertical {
  readonly top: number;
  readonly bottom: number;
}

/** ¿El campo cabe, con su aire, en la parte que se ve (descontado el teclado)? */
export function estaALaVista(
  campo: CajaVertical,
  visible: { readonly top: number; readonly height: number },
): boolean {
  return (
    campo.top >= visible.top + MARGEN_DEL_CAMPO_PX &&
    campo.bottom <= visible.top + visible.height - MARGEN_DEL_CAMPO_PX
  );
}

export interface DepsDelCentro<C = unknown> {
  /** El `visualViewport`, si el motor lo trae. */
  readonly visual: {
    addEventListener(tipo: 'resize', oyente: () => void): void;
    removeEventListener(tipo: 'resize', oyente: () => void): void;
  } | null;
  programar(accion: () => void, ms: number): unknown;
  cancelar(id: unknown): void;
  reducirMovimiento(): boolean;
  medir(campo: C): {
    readonly campo: CajaVertical;
    readonly visible: { readonly top: number; readonly height: number };
  };
  llevar(campo: C, comportamiento: 'smooth' | 'auto'): void;
}

export function crearLlevarAlCentro<C>(deps: DepsDelCentro<C>) {
  let pendiente: { readonly campo: C } | null = null;
  let esperaSinCambio: unknown = null;
  let asentarse: unknown = null;
  let tope: unknown = null;

  const limpiar = (): void => {
    for (const id of [esperaSinCambio, asentarse, tope]) if (id !== null) deps.cancelar(id);
    esperaSinCambio = asentarse = tope = null;
    deps.visual?.removeEventListener('resize', alCambiar);
    pendiente = null;
  };

  const ejecutar = (): void => {
    const viva = pendiente;
    limpiar();
    if (viva === null) return;
    const medida = deps.medir(viva.campo);
    if (estaALaVista(medida.campo, medida.visible)) return;
    deps.llevar(viva.campo, deps.reducirMovimiento() ? 'auto' : 'smooth');
  };

  function alCambiar(): void {
    if (pendiente === null) return;
    if (esperaSinCambio !== null) deps.cancelar(esperaSinCambio);
    esperaSinCambio = null;
    if (tope === null) tope = deps.programar(ejecutar, TOPE_DE_ESPERA_MS);
    if (asentarse !== null) deps.cancelar(asentarse);
    asentarse = deps.programar(ejecutar, ESPERA_DE_ASENTARSE_MS);
  }

  return {
    /** Un campo ganó el foco: se prepara llevarlo, sin tocar nada todavía. */
    alEnfocar(campo: C): void {
      limpiar();
      pendiente = { campo };
      deps.visual?.addEventListener('resize', alCambiar);
      esperaSinCambio = deps.programar(ejecutar, ESPERA_SIN_CAMBIO_MS);
    },
    /** El foco se fue (o la pantalla se desmontó): no se mueve nada. */
    cancelar: limpiar,
  };
}

/** Lo que `montarLlevarAlCentro` necesita del navegador. */
export interface DocumentoConFoco {
  addEventListener(tipo: 'focusin' | 'focusout', oyente: (e: Event) => void): void;
  removeEventListener(tipo: 'focusin' | 'focusout', oyente: (e: Event) => void): void;
}

/**
 * Conecta la decisión al documento: un único `focusin` y un único `focusout`. Sólo cuenta en un
 * aparato con dedo (`hayDedo`, que se pregunta en cada foco: se puede conectar un ratón o una
 * pantalla táctil después), y sólo en campos donde sale el teclado.
 */
export function montarLlevarAlCentro<C extends CampoPosible>(
  documento: DocumentoConFoco,
  deps: DepsDelCentro<C>,
  hayDedo: () => boolean,
): () => void {
  const centro = crearLlevarAlCentro(deps);
  const alEnfocar = (e: Event): void => {
    const campo = e.target as C | null;
    if (!hayDedo() || !esCampoDeTexto(campo) || campo === null) return;
    centro.alEnfocar(campo);
  };
  const alDesenfocar = (): void => {
    centro.cancelar();
  };
  documento.addEventListener('focusin', alEnfocar);
  documento.addEventListener('focusout', alDesenfocar);
  return () => {
    documento.removeEventListener('focusin', alEnfocar);
    documento.removeEventListener('focusout', alDesenfocar);
    centro.cancelar();
  };
}
