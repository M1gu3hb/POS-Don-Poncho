'use client';

import { useEffect, useRef, useState } from 'react';

import { seccionALaVista } from './menu-digital';

/** La altura de lo que se queda pegado arriba (encabezado del portal + esta barra). */
export const MARGEN_DE_LAS_SECCIONES = 132;

/**
 * DP-16 · LA BARRA DE SECCIONES DEL MENÚ (menú digital y «a la carta»).
 *
 * Fichas que se quedan pegadas arriba: tocar una lleva a su sección (suave, salvo con «reducir
 * movimiento») y la ficha de la sección que se está leyendo se marca sola al desplazar. Las
 * secciones se marcan con `data-seccion-del-menu`.
 */
export function BarraDeSecciones({
  secciones,
}: {
  readonly secciones: readonly { readonly id: string; readonly nombre: string }[];
}) {
  const [activa, setActiva] = useState<string | null>(secciones[0]?.id ?? null);
  const fichas = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const posiciones = [...document.querySelectorAll<HTMLElement>('[data-seccion-del-menu]')].map(
        (el) => ({
          id: el.dataset['seccionDelMenu'] ?? '',
          arriba: el.getBoundingClientRect().top,
        }),
      );
      setActiva(seccionALaVista(posiciones, MARGEN_DE_LAS_SECCIONES));
    };
    const alDesplazar = () => {
      if (cuadro === 0) cuadro = requestAnimationFrame(medir);
    };
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => {
      window.removeEventListener('scroll', alDesplazar);
      if (cuadro !== 0) cancelAnimationFrame(cuadro);
    };
  }, []);

  useEffect(() => {
    const ficha = fichas.current?.querySelector<HTMLElement>(`[data-ficha="${activa ?? ''}"]`);
    ficha?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activa]);

  const irA = (id: string) => {
    const seccion = document.querySelector<HTMLElement>(`[data-seccion-del-menu="${id}"]`);
    if (seccion === null) return;
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: seccion.getBoundingClientRect().top + window.scrollY - MARGEN_DE_LAS_SECCIONES + 8,
      behavior: suave ? 'smooth' : 'auto',
    });
    setActiva(id);
  };

  return (
    <nav
      aria-label="Secciones del menú"
      className="sticky top-[4.5rem] z-20 -mx-(--espacio-4) bg-fondo/95 px-(--espacio-4) py-(--espacio-2) backdrop-blur"
    >
      <div ref={fichas} className="flex gap-(--espacio-2) overflow-x-auto">
        {secciones.map((s) => (
          <button
            key={s.id}
            type="button"
            data-ficha={s.id}
            aria-current={activa === s.id ? 'true' : undefined}
            onClick={() => {
              irA(s.id);
            }}
            className={`min-h-11 shrink-0 rounded-full px-(--espacio-4) text-base font-semibold transition-colors duration-(--duracion-rapida) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anillo ${
              activa === s.id
                ? 'bg-texto text-superficie'
                : 'bg-fondo-sutil text-texto hover:bg-acento-suave'
            }`}
          >
            {s.nombre}
          </button>
        ))}
      </div>
    </nav>
  );
}
