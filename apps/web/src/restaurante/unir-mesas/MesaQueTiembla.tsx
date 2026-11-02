'use client';

import type { MesaEnPlano } from '@morphiqpos/domain/sala';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';

/**
 * UNA MESA EN «UNIR MESAS» (DP-12.3): la MISMA mesa del mapa —forma, tamaño, color, número, estado
 * y mesero, la dibuja la pantalla con `pintar`— que tiembla como los íconos del iPhone al
 * acomodarlos. Con «reducir movimiento», en lugar del temblor, un contorno punteado.
 *
 * El temblor es `transform` (la animación `temblar`); el arrastre, la inclinación de la vecina y
 * el asentarse al soltar van en `translate` y `scale`, que son propiedades aparte y se componen
 * con él sin pisarlo.
 */

export interface Desplazamiento {
  readonly dx: number;
  readonly dy: number;
  readonly estiron: number;
  /** Con transición (la vecina que llama, el asentarse) o pegado al dedo (el arrastre). */
  readonly suave: boolean;
}

/** Cada mesa tiembla con su propio desfase: todas en fase parecían una sola cosa vibrando. */
const DESFASE_S = 0.065;

export function MesaQueTiembla({
  mesa,
  numero,
  indice,
  escala,
  enElGrupo,
  arrastrando,
  desplazamiento,
  manejadores,
  alTeclear,
  children,
}: {
  readonly mesa: MesaEnPlano;
  readonly numero: number;
  readonly indice: number;
  readonly escala: number;
  readonly enElGrupo: boolean;
  readonly arrastrando: boolean;
  readonly desplazamiento: Desplazamiento | null;
  readonly manejadores: {
    onPointerDown(e: PointerEvent<HTMLElement>): void;
    onPointerMove(e: PointerEvent<HTMLElement>): void;
    onPointerUp(e: PointerEvent<HTMLElement>): void;
    onPointerCancel(e: PointerEvent<HTMLElement>): void;
    onLostPointerCapture(e: PointerEvent<HTMLElement>): void;
  };
  readonly alTeclear: () => void;
  readonly children: ReactNode;
}) {
  const estilo: CSSProperties = {
    left: mesa.x * escala,
    top: mesa.y * escala,
    width: mesa.ancho * escala,
    height: mesa.alto * escala,
    translate:
      desplazamiento === null
        ? '0px 0px'
        : `${String(desplazamiento.dx * escala)}px ${String(desplazamiento.dy * escala)}px`,
    scale: String(desplazamiento?.estiron ?? 1),
    transition:
      arrastrando || desplazamiento?.suave === false
        ? 'none'
        : 'translate 180ms cubic-bezier(0.2, 0.9, 0.3, 1.2), scale 180ms ease-out',
    animationDelay: `${String(-(indice % 7) * DESFASE_S)}s`,
    zIndex: arrastrando ? 30 : enElGrupo ? 20 : 10,
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Mesa ${String(numero)}`}
      aria-pressed={enElGrupo}
      data-mesa-de-union={mesa.id}
      className={`absolute touch-none select-none rounded-xl outline-none animate-temblar focus-visible:ring-2 focus-visible:ring-primario motion-reduce:animate-none motion-reduce:outline-2 motion-reduce:outline-offset-4 motion-reduce:outline-dashed motion-reduce:outline-primario ${arrastrando ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={estilo}
      {...manejadores}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          alTeclear();
        }
      }}
    >
      <div
        className="pointer-events-none"
        style={{
          width: mesa.ancho,
          height: mesa.alto,
          transform: `scale(${String(escala)})`,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>
    </div>
  );
}
