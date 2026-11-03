'use client';

import type { MesaEnPlano } from '@morphiqpos/domain/sala';
import { useState, type PointerEvent } from 'react';

import { crearArrastreDeUnDedo, type Arrastre } from './arrastre-de-un-dedo';

/**
 * ARRASTRAR UNA MESA EN «UNIR MESAS» (DP-12.3): la mesa sigue al dedo 1:1, sin saltos. El imán ya
 * no la mueve mientras se arrastra (eso la hacía brincar): lo que se anima es la vecina
 * (`vecinaQueLlama`), y al soltar se pega (`atraer`).
 *
 * Eventos de puntero —dedo, ratón o lápiz— con el puntero capturado y `touch-action: none` en la
 * mesa: la página no se desplaza mientras se arrastra. Si el navegador cancela el gesto (una
 * llamada, otro dedo), la mesa se queda donde iba.
 *
 * DP-13.4 · Un SEGUNDO dedo no pisa al primero: mientras un puntero lleva una mesa, los demás se
 * ignoran (la lógica, con sus pruebas, vive en `arrastre-de-un-dedo.ts`).
 */

export { adondeVa, TOQUE_PX, type Arrastre } from './arrastre-de-un-dedo';

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
  const [controlador] = useState(crearArrastreDeUnDedo);
  const destinos = { alArrastrar: setArrastre, alSoltar, alTocar };
  const medidas = { escala, anchoDelPlano, altoDelPlano };

  const manejadoresDe = (m: MesaEnPlano, quieta = false) => ({
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      if (controlador.bajar(m, e, e.currentTarget)) e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      controlador.mover(m, e, medidas, quieta, destinos);
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      controlador.subir(e, destinos);
    },
    onPointerCancel(e: PointerEvent<HTMLElement>) {
      controlador.cancelar(e, destinos);
    },
    onLostPointerCapture(e: PointerEvent<HTMLElement>) {
      controlador.perderCaptura(e, destinos);
    },
  });

  return { arrastre, manejadoresDe };
}
