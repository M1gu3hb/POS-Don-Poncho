/**
 * EL FOCO AL ABRIR UN DIÁLOGO, EN UN APARATO TÁCTIL (DP-21 · Bloque 9 · M16 y O7).
 *
 * Radix pone el foco en el primer campo al abrir un diálogo, un aviso o un panel. Con ratón es lo
 * correcto; con el dedo, el teclado en pantalla sale solo, tapa la mitad del diálogo y la vista
 * brinca. Aquí vive la decisión, UNA vez, para todas las ventanas del sistema (`Dialog`,
 * `AlertDialog`, `Sheet` y sus hermanas de `heredado`): con puntero grueso (`(any-pointer: coarse)`)
 * el foco se queda en el contenedor de la ventana —sigue atrapado ahí, y un lector de pantalla
 * la anuncia— y el teclado sale cuando la persona TOCA el campo.
 *
 * Se respeta a quien llama: su `onOpenAutoFocus` corre primero, y si ya dijo dónde va el foco
 * (`preventDefault`) no se le pisa. El teclado de PIN es propio (no es un campo de texto) y no pasa
 * por aquí.
 */

type Manejador = (evento: Event) => void;

/** Lo único que se le pide a la ventana: poder preguntar por una media query. */
interface ConMatchMedia {
  matchMedia(consulta: string): { readonly matches: boolean };
}

/** ¿Hay un dedo en este aparato? `any-pointer` y no `pointer`: una PC con pantalla táctil cuenta. */
export function hayPunteroGrueso(
  ventana: ConMatchMedia | undefined = typeof window === 'undefined' ? undefined : window,
): boolean {
  return ventana?.matchMedia('(any-pointer: coarse)').matches === true;
}

/** Para probar la decisión sin navegador: `esGrueso` dice si hay un dedo. */
export function crearFocoAlAbrir(esGrueso: () => boolean) {
  return (delLlamador?: Manejador): Manejador =>
    (evento) => {
      delLlamador?.(evento);
      if (evento.defaultPrevented || !esGrueso()) return;
      evento.preventDefault();
      // El contenedor de Radix tiene `tabindex="-1"`: puede tener el foco sin ser un campo.
      const contenedor = evento.currentTarget as {
        focus?: (o?: { preventScroll?: boolean }) => void;
      };
      contenedor.focus?.({ preventScroll: true });
    };
}

/** El `onOpenAutoFocus` de toda ventana del POS. Uso: `onOpenAutoFocus={focoAlAbrir(props.onOpenAutoFocus)}`. */
export const focoAlAbrir = crearFocoAlAbrir(() => hayPunteroGrueso());

/**
 * Para el `autoFocus` de un campo de texto dentro de un diálogo: `autoFocus={puedeEnfocarAlAbrir()}`.
 * Con ratón enfoca (se teclea de inmediato); con dedo no, y el teclado sale cuando se TOCA el campo.
 * Lo que no pasa por aquí (el PIN, que tiene su teclado) se declara en `foco-al-abrir.contrato.test.ts`.
 */
export function puedeEnfocarAlAbrir(esGrueso: () => boolean = () => hayPunteroGrueso()): boolean {
  return !esGrueso();
}
