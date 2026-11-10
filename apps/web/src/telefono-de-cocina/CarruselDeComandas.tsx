'use client';

import { cn } from '@morphiqpos/ui/utilidades';
import { useCallback, useEffect, useRef } from 'react';

import { haceCuanto } from '~/restaurante/vista-de-solicitudes';
import { rotuloDeLaComanda } from '~/restaurante/rotulo-de-la-comanda';

import { guiaDelCarrusel, indiceALaVista } from './carrusel-del-telefono';
import { ComandaEnElTelefono } from './ComandaEnElTelefono';
import { datosDelRotulo, type ComandaDelTelefono } from './pantalla-del-telefono';

const MARCA_DE_LA_PISTA = 'telefono-de-cocina:pista-de-deslizar';

function sinMovimiento(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function yaVioLaPista(): boolean {
  try {
    return window.localStorage.getItem(MARCA_DE_LA_PISTA) !== null;
  } catch {
    return true; // Sin almacenamiento no se puede recordar: mejor no molestar cada vez.
  }
}

function marcarLaPista(): void {
  try {
    window.localStorage.setItem(MARCA_DE_LA_PISTA, '1');
  } catch {
    // Sin almacenamiento la pista simplemente no se recuerda.
  }
}

/**
 * Las comandas activas en un carrusel horizontal con `scroll-snap` (DP-16 · 2.3): cada tarjeta
 * ocupa ~88 % del ancho para que se asome la siguiente, y los puntos de abajo dicen dónde vas.
 * La primera vez, la primera tarjeta se mece un momento para sugerir el deslizar (si el aparato
 * no pidió menos movimiento). Una comanda nueva entra al final: nunca mueve la vista.
 */
export function CarruselDeComandas({
  comandas,
  vistaId,
  ahora,
  alVer,
  alElegir,
}: {
  readonly comandas: readonly ComandaDelTelefono[];
  /** La comanda que cuenta como «a la vista» (ya resuelta por el padre). */
  readonly vistaId: string | null;
  readonly ahora: number;
  /** Lo que el desplazamiento dejó a la vista. */
  readonly alVer: (comandaId: string) => void;
  /** Un punto pidió ir a esa tarjeta. */
  readonly alElegir: (indice: number) => void;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const tarjetas = useRef<(HTMLDivElement | null)[]>([]);
  const cuadro = useRef(0);
  const pistaMostrada = useRef(false);
  /** Lo último que el dedo dejó a la vista: distingue «me deslicé» de «me mandaron». */
  const reportada = useRef<string | null>(null);

  const irA = useCallback((indice: number, suave: boolean): void => {
    tarjetas.current[indice]?.scrollIntoView({
      behavior: suave && !sinMovimiento() ? 'smooth' : 'instant',
      block: 'nearest',
      inline: 'start',
    });
  }, []);

  // La vista cambió por algo que no fue el dedo (una pastilla, un punto, una que se fue): ir allá.
  useEffect(() => {
    if (vistaId === null || vistaId === reportada.current) return;
    reportada.current = vistaId;
    const indice = comandas.findIndex((c) => c.id === vistaId);
    if (indice !== -1) irA(indice, true);
  }, [vistaId, comandas, irA]);

  const alDesplazar = useCallback((): void => {
    cancelAnimationFrame(cuadro.current);
    cuadro.current = requestAnimationFrame(() => {
      const contenedor = pista.current;
      const primera = tarjetas.current[0];
      const segunda = tarjetas.current[1];
      if (contenedor === null || primera === null || primera === undefined) return;
      const paso = segunda ? segunda.offsetLeft - primera.offsetLeft : 0;
      const indice = indiceALaVista(contenedor.scrollLeft, paso, comandas.length);
      const id = comandas[indice]?.id;
      if (id === undefined) return;
      reportada.current = id;
      alVer(id);
    });
  }, [comandas, alVer]);

  useEffect(
    () => () => {
      cancelAnimationFrame(cuadro.current);
    },
    [],
  );

  // La pista de la primera vez: la primera tarjeta se mece hacia la izquierda y vuelve.
  const hayQueDeslizar = comandas.length > 1;
  useEffect(() => {
    if (!hayQueDeslizar || pistaMostrada.current || sinMovimiento() || yaVioLaPista()) return;
    const primera = tarjetas.current[0];
    if (primera === null || primera === undefined || typeof primera.animate !== 'function') return;
    pistaMostrada.current = true;
    const animacion = primera.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-14%)', offset: 0.45 },
        { transform: 'translateX(0)' },
      ],
      { duration: 1100, delay: 600, easing: 'ease-in-out' },
    );
    marcarLaPista();
    return () => {
      animacion.cancel();
    };
  }, [hayQueDeslizar]);

  return (
    <section aria-label="Comandas activas" className="flex flex-col gap-(--espacio-2)">
      <div
        ref={pista}
        onScroll={alDesplazar}
        tabIndex={0}
        aria-label="Comandas, desliza para ver la siguiente"
        className="-mx-(--espacio-3) relative flex snap-x snap-mandatory items-start gap-(--espacio-2) overflow-x-auto scroll-px-(--espacio-3) px-(--espacio-3) pb-(--espacio-1) focus-visible:ring-[3px] focus-visible:ring-anillo focus-visible:outline-none"
      >
        {comandas.map((comanda, i) => (
          <div
            key={comanda.id}
            ref={(el) => {
              tarjetas.current[i] = el;
            }}
            role="group"
            aria-roledescription="comanda"
            aria-label={`${String(i + 1)} de ${String(comandas.length)}`}
            className="w-[88%] shrink-0 snap-start snap-always"
          >
            <ComandaEnElTelefono
              comanda={comanda}
              haceCuanto={haceCuanto(comanda.creadaEn, ahora)}
            />
          </div>
        ))}
      </div>
      {guiaDelCarrusel(comandas.length) === 'contador' ? (
        // DP-17 · Con muchas comandas los puntos no caben: se dice dónde vas (la tira lleva a cada una).
        <p
          aria-live="polite"
          className="text-center text-base font-bold text-texto-sutil tabular-nums"
        >
          {Math.max(1, comandas.findIndex((c) => c.id === vistaId) + 1)} de {comandas.length}
        </p>
      ) : guiaDelCarrusel(comandas.length) === 'puntos' ? (
        <ol aria-label="Dónde vas" className="flex flex-wrap items-center justify-center">
          {comandas.map((comanda, i) => {
            const activa = comanda.id === vistaId;
            const quien = rotuloDeLaComanda(datosDelRotulo(comanda));
            return (
              <li key={comanda.id}>
                <button
                  type="button"
                  aria-label={`Comanda ${String(i + 1)} de ${String(comandas.length)}: ${quien}`}
                  aria-current={activa ? 'true' : undefined}
                  className="flex size-[calc(var(--altura-control)*0.6)] items-center justify-center rounded-full focus-visible:ring-[3px] focus-visible:ring-anillo focus-visible:outline-none"
                  onClick={() => {
                    alElegir(i);
                  }}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'block size-2.5 rounded-full',
                      activa ? 'scale-125 bg-primario' : 'bg-borde-fuerte',
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
