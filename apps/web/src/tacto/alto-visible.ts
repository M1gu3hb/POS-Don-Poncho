/**
 * EL ALTO QUE DE VERDAD SE VE (DP-21 · Bloque 9 · M16).
 *
 * Con el teclado en pantalla, `100vh` y `100dvh` no bajan (en Android 7 ni siquiera existe `dvh`):
 * el pie de un diálogo con sus botones queda DEBAJO del teclado. Lo que sí baja es el
 * `visualViewport`. Aquí se copia su alto a `--alto-visible` en `<html>` cada vez que cambia, y
 * los diálogos y paneles lo usan (`max-h-[var(--alto-visible,100vh)]`): su pie siempre se ve.
 *
 * Sin `visualViewport` (motores viejos), el alto de la ventana y su `resize`. El `Window` y la raíz
 * entran por parámetro, con sólo lo que se usa, para probarlo con objetos planos.
 */

export const VARIABLE_DEL_ALTO = '--alto-visible';
/** La marca del <html> mientras el teclado en pantalla está arriba: `teclado-en-pantalla.css` la usa. */
export const ATRIBUTO_DEL_TECLADO = 'data-teclado';
/** Menos que esto de diferencia es una barra del navegador que se esconde, no un teclado. */
export const UMBRAL_DEL_TECLADO_PX = 120;

interface VisualViewportMinimo {
  readonly height: number;
  addEventListener(tipo: 'resize', oyente: () => void): void;
  removeEventListener(tipo: 'resize', oyente: () => void): void;
}

export interface VentanaConAlto {
  readonly innerHeight: number;
  readonly visualViewport?: VisualViewportMinimo | null | undefined;
  addEventListener(tipo: 'resize', oyente: () => void): void;
  removeEventListener(tipo: 'resize', oyente: () => void): void;
}

export interface RaizConEstilo {
  readonly style: {
    setProperty(nombre: string, valor: string): void;
    removeProperty(nombre: string): void;
  };
  setAttribute(nombre: string, valor: string): void;
  removeAttribute(nombre: string): void;
}

/** El alto visible: el del `visualViewport` si trae uno utilizable; si no, el de la ventana. */
export function altoVisible(ventana: {
  readonly innerHeight: number;
  readonly visualViewport?: { readonly height: number } | null | undefined;
}): number {
  const visual = ventana.visualViewport?.height;
  return visual !== undefined && Number.isFinite(visual) && visual > 0
    ? visual
    : ventana.innerHeight;
}

/**
 * ¿Hay un teclado en pantalla? El `visualViewport` es bastante más bajo que la ventana. Con un
 * motor que no lo trae no se puede saber, y entonces no hay marca: ahí el teclado achica la propia
 * ventana (`adjustResize`) y los diálogos ya se recentran solos.
 */
export function hayTecladoEnPantalla(ventana: {
  readonly innerHeight: number;
  readonly visualViewport?: { readonly height: number } | null | undefined;
}): boolean {
  const visual = ventana.visualViewport?.height;
  return (
    visual !== undefined &&
    Number.isFinite(visual) &&
    ventana.innerHeight - visual >= UMBRAL_DEL_TECLADO_PX
  );
}

/** Mantiene `--alto-visible` en la raíz. Devuelve cómo dejar de hacerlo (y quitar la variable). */
export function montarAltoVisible(ventana: VentanaConAlto, raiz: RaizConEstilo): () => void {
  let ultimo = '';
  const actualizar = (): void => {
    const valor = `${String(Math.round(altoVisible(ventana)))}px`;
    if (valor === ultimo) return;
    ultimo = valor;
    raiz.style.setProperty(VARIABLE_DEL_ALTO, valor);
    if (hayTecladoEnPantalla(ventana)) raiz.setAttribute(ATRIBUTO_DEL_TECLADO, '');
    else raiz.removeAttribute(ATRIBUTO_DEL_TECLADO);
  };
  actualizar();
  // El `visualViewport` avisa del teclado; la ventana, de girar el aparato. Los dos cuentan.
  const visual = ventana.visualViewport ?? null;
  visual?.addEventListener('resize', actualizar);
  ventana.addEventListener('resize', actualizar);
  return () => {
    visual?.removeEventListener('resize', actualizar);
    ventana.removeEventListener('resize', actualizar);
    raiz.style.removeProperty(VARIABLE_DEL_ALTO);
    raiz.removeAttribute(ATRIBUTO_DEL_TECLADO);
  };
}
