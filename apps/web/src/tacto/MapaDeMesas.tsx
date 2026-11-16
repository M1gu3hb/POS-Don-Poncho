'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { calcularEscalaDelMapa, type CajaDeMesa } from './escala-del-mapa';

/**
 * EL MAPA DE MESAS DEL MESERO, ESCALADO AL ESPACIO QUE HAY (DP-21 · Bloque 9 · O4/M2).
 *
 * Medía 600 px fijos con las mesas en píxeles absolutos y `overflow-hidden`: con la barra lateral
 * abierta las mesas de la orilla se cortaban. Ahora el dibujo entero de la zona se pinta a una
 * escala (`escala-del-mapa.ts`) que cabe en el ancho y el alto que hay, sin tocar las posiciones
 * guardadas: las mesas (`children`) siguen en `left/top` del plano, y es el LIENZO el que se escala
 * con `transform: scale()`.
 *
 * ── Por qué dos contenedores ────────────────────────────────────────────────
 * Un `transform` no cambia la caja de layout: un lienzo escalado a 0.6 sigue ocupando su tamaño
 * completo y el desplazamiento mediría lo que no es. Por eso el lienzo (a escala 1, con su tamaño de
 * plano) va DENTRO de otro contenedor que mide lo YA ESCALADO; ese es el que el dedo desplaza cuando
 * ni a la escala mínima (56 px por mesa) cabe todo.
 *
 * Los toques, el globo de la mesa y la pulsación larga no necesitan cuenta: los eventos traen
 * coordenadas de la pantalla y el globo se pone en la pantalla (`position: fixed`), no en el lienzo.
 *
 * Sólo `transform` (y a escala 1 ni eso: cero cambio, y sin el bloque de contención que un
 * `transform` crea). El plugin del modo compatible no toca los estilos en línea, y `scale()` dentro
 * de `transform` lo entiende cualquier motor (no es la propiedad suelta `scale`, de Chromium 104).
 */

/** Lo que se deja entre el mapa y el borde de abajo de la pantalla. */
const MARGEN_INFERIOR_PX = 16;
/** La cuadrícula de puntos del suelo, en píxeles de pantalla (no se escala con el dibujo). */
const CUADRICULA = '24px 24px';

export interface FondoDelMapa {
  readonly color: string;
  readonly patron?: string | undefined;
  readonly borde: string;
  readonly sombra: string;
}

interface Medidas {
  readonly ancho: number;
  readonly alto: number;
}

export function MapaDeMesas({
  cajas,
  fondo,
  agarre,
  superposicion,
  children,
}: {
  /** Las cajas que se pintan (posición y tamaño en el plano), para sacar la escala. */
  readonly cajas: readonly CajaDeMesa[];
  readonly fondo: FondoDelMapa;
  /** Los manejadores del contenedor (la pulsación larga). */
  readonly agarre?: HTMLAttributes<HTMLDivElement> | undefined;
  /** Lo que va encima SIN escalar: «no hay mesas», «cargando». */
  readonly superposicion?: ReactNode;
  readonly children: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState<Medidas>({ ancho: 0, alto: 0 });

  useEffect(() => {
    const nodo = caja.current;
    if (nodo === null) return undefined;
    const medir = (): void => {
      // El ancho que se mide NO descuenta la barra de desplazamiento: si dependiera de ella, mostrarla
      // cambiaría la escala, que la quitaría, que cambiaría el ancho... Se mide la caja menos su borde.
      const ancho = nodo.offsetWidth - 2 * nodo.clientLeft;
      const debajoDeLaPagina = nodo.getBoundingClientRect().top + window.scrollY;
      const alto = window.innerHeight - debajoDeLaPagina - MARGEN_INFERIOR_PX;
      setMedidas((antes) =>
        antes.ancho === ancho && antes.alto === Math.round(alto)
          ? antes
          : { ancho, alto: Math.round(alto) },
      );
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    window.addEventListener('resize', medir);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, []);

  const medida = calcularEscalaDelMapa({
    anchoDisponible: medidas.ancho,
    altoDisponible: medidas.alto,
    mesas: cajas,
  });
  const { escala } = medida;
  const lienzo: CSSProperties = {
    width: medida.lienzo.ancho,
    height: medida.lienzo.alto,
    transform: escala === 1 ? undefined : `scale(${String(escala)})`,
  };

  return (
    <div
      {...agarre}
      ref={caja}
      data-mapa-de-mesas
      data-escala={escala}
      data-desplaza={medida.desplaza}
      // Sin desplazar, `overflow-hidden` como siempre (ni barras ni rebotes de más); desplazando, el
      // dedo mueve el mapa y el gesto no se le pasa a la página al llegar al borde.
      className={`relative rounded-2xl border-2 ${medida.desplaza ? 'overflow-auto overscroll-contain' : 'overflow-hidden'}`}
      role={medida.desplaza ? 'region' : undefined}
      aria-label={medida.desplaza ? 'Mapa de mesas' : undefined}
      tabIndex={medida.desplaza ? 0 : undefined}
      style={{
        height: medida.caja.alto,
        background: fondo.color,
        borderColor: fondo.borde,
        boxShadow: fondo.sombra,
      }}
    >
      <div
        className="relative min-h-full min-w-full"
        style={{
          width: medida.pantalla.ancho,
          height: medida.pantalla.alto,
          backgroundImage: fondo.patron,
          backgroundSize: CUADRICULA,
        }}
      >
        <div className="absolute top-0 left-0 origin-top-left overflow-hidden" style={lienzo}>
          {children}
        </div>
      </div>
      {superposicion}
    </div>
  );
}
