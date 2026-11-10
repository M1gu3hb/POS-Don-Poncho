/**
 * DE DÓNDE CRECE UNA VENTANA (DP-16, 1.3).
 *
 * Una ventana que se abre por un toque tiene que parecer que SALE de lo que se tocó: el
 * botón, la mesa. Antes entraba corrida desde la izquierda (`slide-in-from-left-1/2`), que no
 * dice de dónde viene nada. Esta pieza es la única que lo decide, para todos los diálogos y las
 * alertas del sistema (`Dialog`, `AlertDialog`, y los de `heredado`):
 *
 *   1 · Un oyente en `document` (fase de captura, `pointerdown`) guarda el ÚLTIMO punto tocado.
 *   2 · Al montarse la ventana, `fijarOrigenDeVentana` mide su caja y escribe dos variables CSS:
 *       `--origen-x` y `--origen-y` (px dentro de la caja) y `--escala-inicial-ventana`.
 *   3 · `ventanas.css` anima sólo `transform` y `opacity` con esas variables.
 *
 * Sin toque reciente (teclado, apertura programática, más de ~1 s) aparece al centro con un
 * zoom mínimo; con `prefers-reduced-motion`, sin zoom (la hoja deja sólo el fundido).
 *
 * ── Por qué se mide el CENTRO de la caja ───────────────────────────────────
 * Radix centra el diálogo con `translate: -50% -50%` (propiedad `translate`, aparte de
 * `transform`). Al montarse, la animación aún no ha movido nada alrededor del centro, y escalar
 * respecto al centro no lo desplaza: el centro del rectángulo medido ES el centro real. De ahí
 * se obtiene la esquina real con el tamaño de layout (`offsetWidth`, que ignora transformaciones).
 */

/** Zoom inicial cuando hay un punto del que crecer. */
export const ESCALA_CON_TOQUE = 0.9;
/** Zoom inicial sin punto: casi nada, que sólo se note el fundido. */
export const ESCALA_SIN_TOQUE = 0.97;
/** Pasado este tiempo, el toque ya no es «el que abrió la ventana». */
export const VIGENCIA_DEL_TOQUE_MS = 1_000;

export interface ToqueRegistrado {
  readonly x: number;
  readonly y: number;
  /** `performance.now()` del toque. */
  readonly en: number;
}

export interface CajaDeVentana {
  /** Centro de la caja en la pantalla, en px. */
  readonly centroX: number;
  readonly centroY: number;
  /** Tamaño de layout (sin transformaciones). */
  readonly ancho: number;
  readonly alto: number;
}

export interface OrigenDeVentana {
  /** px desde la esquina superior izquierda de la caja. */
  readonly x: number;
  readonly y: number;
  readonly escala: number;
}

export interface EntradaDelOrigen {
  readonly toque: ToqueRegistrado | null;
  readonly ahora: number;
  readonly caja: CajaDeVentana;
  readonly reducirMovimiento: boolean;
}

const acotar = (valor: number, minimo: number, maximo: number): number =>
  Math.min(maximo, Math.max(minimo, valor));

/**
 * El origen de la animación. Puro: no toca el DOM, para poder probarlo sin navegador.
 *
 * El origen se acota a una caja de ancho y alto de margen alrededor de la ventana: un toque
 * en el otro extremo de la pantalla no debe lanzar la ventana desde allá, sólo inclinar su
 * entrada hacia ese lado.
 */
export function calcularOrigenDeVentana(entrada: EntradaDelOrigen): OrigenDeVentana {
  const { toque, ahora, caja, reducirMovimiento } = entrada;
  const alCentro = { x: caja.ancho / 2, y: caja.alto / 2 };
  if (reducirMovimiento) return { ...alCentro, escala: 1 };

  const edad = toque === null ? Number.POSITIVE_INFINITY : ahora - toque.en;
  if (toque === null || edad < 0 || edad > VIGENCIA_DEL_TOQUE_MS) {
    return { ...alCentro, escala: ESCALA_SIN_TOQUE };
  }

  const izquierda = caja.centroX - caja.ancho / 2;
  const arriba = caja.centroY - caja.alto / 2;
  return {
    x: acotar(toque.x - izquierda, -caja.ancho, caja.ancho * 2),
    y: acotar(toque.y - arriba, -caja.alto, caja.alto * 2),
    escala: ESCALA_CON_TOQUE,
  };
}

/* ── La parte con DOM ─────────────────────────────────────────────────────── */

let ultimoToque: ToqueRegistrado | null = null;
let oyendo = false;

/**
 * Empieza a recordar el último toque. Idempotente. Se llama sola al montar la primera ventana,
 * pero también puede llamarse al arrancar la aplicación para no perder el primer toque.
 */
export function registrarToquesParaVentanas(): void {
  if (oyendo || typeof document === 'undefined') return;
  oyendo = true;
  document.addEventListener(
    'pointerdown',
    (evento) => {
      ultimoToque = { x: evento.clientX, y: evento.clientY, en: performance.now() };
    },
    { capture: true, passive: true },
  );
  // Abrir con el teclado no es un toque: el toque viejo no debe «adoptar» esa ventana.
  document.addEventListener(
    'keydown',
    () => {
      ultimoToque = null;
    },
    { capture: true, passive: true },
  );
}

const pideMenosMovimiento = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Ventanas que ya tienen su origen: un `ref` nuevo en cada render no debe medirlas otra vez. */
const yaFijadas = new WeakSet<HTMLElement>();

/** Escribe el origen en la ventana recién montada. Pensado para un `ref` de React. */
export function fijarOrigenDeVentana(elemento: HTMLElement | null): void {
  if (elemento === null || yaFijadas.has(elemento)) return;
  yaFijadas.add(elemento);
  registrarToquesParaVentanas();
  const rect = elemento.getBoundingClientRect();
  const origen = calcularOrigenDeVentana({
    toque: ultimoToque,
    ahora: performance.now(),
    caja: {
      centroX: rect.left + rect.width / 2,
      centroY: rect.top + rect.height / 2,
      ancho: elemento.offsetWidth,
      alto: elemento.offsetHeight,
    },
    reducirMovimiento: pideMenosMovimiento(),
  });
  elemento.style.setProperty('--origen-x', `${String(Math.round(origen.x))}px`);
  elemento.style.setProperty('--origen-y', `${String(Math.round(origen.y))}px`);
  elemento.style.setProperty('--escala-inicial-ventana', String(origen.escala));
}

type RefExterno<T> = ((valor: T | null) => void) | { current: T | null } | null | undefined;

/**
 * Un `ref` que fija el origen Y avisa al `ref` que ya traía el componente (`forwardRef`,
 * `ref` del que usa el diálogo). Sin dependencias: Radix no exporta su `composeRefs`.
 */
export function refConOrigenDeVentana<T extends HTMLElement>(
  externo: RefExterno<T>,
): (valor: T | null) => void {
  return (valor) => {
    fijarOrigenDeVentana(valor);
    if (typeof externo === 'function') externo(valor);
    else if (externo) externo.current = valor;
  };
}

/** Sólo para pruebas: olvida el toque guardado. */
export function olvidarToquesParaVentanas(): void {
  ultimoToque = null;
}

// DP-16 · El oyente se registra al CARGAR el módulo (lo importan los diálogos), no al abrir la
// primera ventana: si no, el toque que abre la primera ventana de la página se perdía y ésta
// aparecía al centro.
registrarToquesParaVentanas();
