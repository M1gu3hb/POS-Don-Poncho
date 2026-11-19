'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * LA LISTA QUE SE DESPLAZA DICE QUE HAY MÁS (DP-22 · hallazgo 5, barra lateral en pantalla baja).
 *
 * En una ventana baja (Windows 1366×768 al 125 % mide 1093×614) el menú no cabe: la lista se desplaza,
 * pero «Compras» quedaba cortado bajo «Modo oscuro» y nada decía que seguía. Aquí la lista pinta, al
 * borde de abajo, un degradado y una flecha mientras queda algo por desplazar; al llegar al final, o
 * cuando todo cabe, se quitan. El aviso no recibe toques (`pointer-events-none`): no tapa ningún enlace.
 */

/** Píxeles de tolerancia: el redondeo de pantallas al 125 % deja a veces una fracción por sobrar. */
const TOLERANCIA_PX = 2;

export interface NavegacionConAvisoProps {
  readonly etiqueta: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function NavegacionConAviso({ etiqueta, className, children }: NavegacionConAvisoProps) {
  const lista = useRef<HTMLElement | null>(null);
  const [hayMas, setHayMas] = useState(false);

  const medir = useCallback((): void => {
    const el = lista.current;
    if (el === null) return;
    setHayMas(el.scrollHeight - el.scrollTop - el.clientHeight > TOLERANCIA_PX);
  }, []);

  // Cada pintada: si cambiaron los enlaces (otro puesto, otro modelo) la medida cambia.
  useLayoutEffect(medir);

  useEffect(() => {
    const el = lista.current;
    if (el === null) return undefined;
    el.addEventListener('scroll', medir, { passive: true });
    // La ventana que cambia de alto (teclado, rotar el aparato, zoom) cambia lo que cabe.
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => {
      el.removeEventListener('scroll', medir);
      observador.disconnect();
    };
  }, [medir]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <nav
        ref={lista}
        aria-label={etiqueta}
        className={`min-h-0 flex-1 overflow-y-auto ${className ?? ''}`}
      >
        {children}
      </nav>
      {hayMas ? (
        <div
          aria-hidden="true"
          data-mas-por-desplazar=""
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-(--altura-control) items-end justify-center bg-gradient-to-t from-lateral-fondo via-lateral-fondo/80 to-transparent pb-0.5 text-lateral-texto/70"
        >
          <ChevronDown className="size-4" />
        </div>
      ) : null}
    </div>
  );
}
