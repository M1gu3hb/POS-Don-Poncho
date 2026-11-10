import { useEffect, useState, type RefObject } from 'react';

/** Desde la tableta en vertical (md de Tailwind); abajo, la página corre normal. */
const ANCHO_MINIMO = 768;
/** Un respiro bajo el tablero, para que la última tarjeta no pegue con el borde de la ventana. */
const RESPIRO_PX = 12;
/** Lo mínimo que se le deja al tablero aunque lo de arriba ocupe casi todo. */
const ALTO_MINIMO_PX = 320;

/**
 * DP-16 · 2.2 · EL ALTO QUE LE QUEDA AL TABLERO.
 *
 * Mide dónde empieza el elemento y le da lo que resta de la ventana, para que cada columna se
 * desplace sola. No depende de cuánto mida el encabezado de la aplicación ni la tira de resumen:
 * se vuelve a medir al girar la tableta, al cambiar el tamaño y cuando lo de arriba cambia de
 * alto (se agrega un platillo al resumen, el encabezado se parte en dos renglones).
 * Devuelve `null` en pantallas angostas: ahí no hay alto fijo.
 */
export function useAlturaDisponible(ref: RefObject<HTMLElement | null>): number | null {
  const [alto, setAlto] = useState<number | null>(null);

  useEffect(() => {
    const medir = (): void => {
      const elemento = ref.current;
      if (elemento === null || window.innerWidth < ANCHO_MINIMO) {
        setAlto(null);
        return;
      }
      const libre = Math.floor(
        window.innerHeight - elemento.getBoundingClientRect().top - RESPIRO_PX,
      );
      setAlto(Math.max(ALTO_MINIMO_PX, libre));
    };
    medir();
    window.addEventListener('resize', medir);
    const observador = new ResizeObserver(medir);
    observador.observe(document.body);
    return () => {
      window.removeEventListener('resize', medir);
      observador.disconnect();
    };
  }, [ref]);

  return alto;
}
