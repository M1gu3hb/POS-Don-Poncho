'use client';

import type { MesaEnPlano } from '@morphiqpos/domain/sala';
import { useRef, useState, type PointerEvent } from 'react';

/**
 * ARRASTRAR UNA MESA EN «UNIR MESAS» (DP-12.3): la mesa sigue al dedo 1:1, sin saltos. El imán ya
 * no la mueve mientras se arrastra (eso la hacía brincar): lo que se anima es la vecina
 * (`vecinaQueLlama`), y al soltar se pega (`atraer`).
 *
 * Eventos de puntero —dedo, ratón o lápiz— con el puntero capturado y `touch-action: none` en la
 * mesa: la página no se desplaza mientras se arrastra. Si el navegador cancela el gesto (una
 * llamada, otro dedo), la mesa se queda donde iba.
 */

/** Menos que esto, en píxeles de la pantalla, es un toque y no un arrastre. */
export const TOQUE_PX = 6;

export interface Arrastre {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

interface Inicio {
  readonly id: string;
  readonly puntero: number;
  readonly px: number;
  readonly py: number;
  readonly x0: number;
  readonly y0: number;
  movida: boolean;
  ultimo: { x: number; y: number };
}

/** A dónde va la mesa: donde la lleva el dedo, sin salirse del plano. Puro. */
export function adondeVa(
  inicio: { readonly px: number; readonly py: number; readonly x0: number; readonly y0: number },
  puntero: { readonly x: number; readonly y: number },
  escala: number,
  limite: { readonly ancho: number; readonly alto: number },
): { readonly x: number; readonly y: number } {
  return {
    x: Math.min(Math.max(0, inicio.x0 + (puntero.x - inicio.px) / escala), limite.ancho),
    y: Math.min(Math.max(0, inicio.y0 + (puntero.y - inicio.py) / escala), limite.alto),
  };
}

export function useArrastreDeMesas({
  escala,
  anchoDelPlano,
  altoDelPlano,
  alSoltar,
  alTocar,
}: {
  readonly escala: number;
  readonly anchoDelPlano: number;
  readonly altoDelPlano: number;
  readonly alSoltar: (id: string, x: number, y: number) => void;
  readonly alTocar: (id: string) => void;
}) {
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const inicio = useRef<Inicio | null>(null);

  const terminar = (tocar: boolean) => {
    const vivo = inicio.current;
    inicio.current = null;
    setArrastre(null);
    if (vivo === null) return;
    if (vivo.movida) alSoltar(vivo.id, vivo.ultimo.x, vivo.ultimo.y);
    else if (tocar) alTocar(vivo.id);
  };

  const manejadoresDe = (m: MesaEnPlano, quieta = false) => ({
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      inicio.current = {
        id: m.id,
        puntero: e.pointerId,
        px: e.clientX,
        py: e.clientY,
        x0: m.x,
        y0: m.y,
        movida: false,
        ultimo: { x: m.x, y: m.y },
      };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const vivo = inicio.current;
      if (vivo?.id !== m.id || vivo.puntero !== e.pointerId || quieta) return;
      if (!vivo.movida && Math.hypot(e.clientX - vivo.px, e.clientY - vivo.py) < TOQUE_PX) return;
      vivo.movida = true;
      vivo.ultimo = adondeVa(vivo, { x: e.clientX, y: e.clientY }, escala, {
        ancho: Math.max(0, anchoDelPlano - m.ancho),
        alto: Math.max(0, altoDelPlano - m.alto),
      });
      setArrastre({ id: m.id, ...vivo.ultimo });
    },
    onPointerUp() {
      terminar(true);
    },
    onPointerCancel() {
      terminar(false);
    },
    onLostPointerCapture() {
      if (inicio.current !== null) terminar(false);
    },
  });

  return { arrastre, manejadoresDe };
}
