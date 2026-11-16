/**
 * `:has(:checked)` Y `:has(:focus-visible)` EN UN MOTOR SIN `:has()` (DP-21 · Bloque 15).
 *
 * `:has()` llega con Chromium 105; el WebView del iMin (99–103) no lo tiene y tira las reglas que lo
 * usan —la opción elegida de una lista, el anillo de foco de su tarjeta—. El plugin del modo
 * compatible (`scripts/modo-compatible/tiene.mjs`) deja cada una de esas reglas también sobre una
 * MARCA, `data-tiene-checked` o `data-tiene-focus-visible`, dentro de `@supports not selector(:has(a))`.
 * Aquí se pone y se quita la marca: a cada elemento que lleva una clase `has-checked:` o
 * `has-focus-visible:` se le pregunta si lo de adentro está marcado o enfocado. Con `:has()` no se
 * instala nada.
 */

const ESTADOS = [
  { clase: '[class*="has-checked:"]', dentro: ':checked', marca: 'data-tiene-checked' },
  {
    clase: '[class*="has-focus-visible:"]',
    dentro: ':focus-visible',
    marca: 'data-tiene-focus-visible',
  },
] as const;

interface Marcable {
  querySelector(selector: string): unknown;
  setAttribute(nombre: string, valor: string): void;
  removeAttribute(nombre: string): void;
}

export interface RaizBuscable {
  querySelectorAll(selector: string): ArrayLike<Marcable> | Iterable<Marcable>;
}

export function motorSinHas(css: { supports(condicion: string): boolean } | undefined): boolean {
  return css !== undefined && !css.supports('selector(:has(a))');
}

/** Pone o quita cada marca según lo que tenga adentro cada elemento. */
export function refrescarMarcas(raiz: RaizBuscable): void {
  for (const { clase, dentro, marca } of ESTADOS) {
    for (const el of Array.from(raiz.querySelectorAll(clase))) {
      if (el.querySelector(dentro) === null) el.removeAttribute(marca);
      else el.setAttribute(marca, '');
    }
  }
}

export interface DocumentoConMarcas extends RaizBuscable {
  addEventListener(
    tipo: 'change' | 'focusin' | 'focusout',
    oyente: () => void,
    captura?: boolean,
  ): void;
  removeEventListener(
    tipo: 'change' | 'focusin' | 'focusout',
    oyente: () => void,
    captura?: boolean,
  ): void;
}

export interface OpcionesDelMontaje {
  readonly supports: ((condicion: string) => boolean) | undefined;
  /** Avisa cuando cambia el árbol (se agregan tarjetas); devuelve cómo dejar de avisar. */
  readonly observar: (alCambiar: () => void) => () => void;
}

/** Monta el relleno si hace falta; devuelve cómo desmontarlo. */
export function montarTieneDeRespaldo(
  documento: DocumentoConMarcas,
  opciones: OpcionesDelMontaje,
): () => void {
  const css = opciones.supports === undefined ? undefined : { supports: opciones.supports };
  if (!motorSinHas(css)) return () => undefined;
  const refrescar = (): void => {
    refrescarMarcas(documento);
  };
  refrescar();
  // El foco y lo marcado cambian DESPUÉS del evento (`focusout` ve todavía el foco): se mira al
  // siguiente cuadro.
  const pronto = (): void => {
    setTimeout(refrescar, 0);
  };
  for (const tipo of ['change', 'focusin', 'focusout'] as const) {
    documento.addEventListener(tipo, pronto, true);
  }
  const soltar = opciones.observar(pronto);
  return () => {
    for (const tipo of ['change', 'focusin', 'focusout'] as const) {
      documento.removeEventListener(tipo, pronto, true);
    }
    soltar();
  };
}

/** El relleno conectado al documento de verdad: `CSS.supports` y un `MutationObserver` del cuerpo. */
export function montarTieneEnElNavegador(): () => void {
  return montarTieneDeRespaldo(document, {
    supports: typeof CSS === 'undefined' ? undefined : (c) => CSS.supports(c),
    observar: (alCambiar) => {
      const observador = new MutationObserver(alCambiar);
      observador.observe(document.body, { childList: true, subtree: true });
      return () => {
        observador.disconnect();
      };
    },
  });
}
