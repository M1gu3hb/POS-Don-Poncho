'use client';

import { useRef, type MouseEvent, type PointerEvent } from 'react';

import { MS_PARA_MANTENER, mesaDeLaPulsacion, seDeslizo, type Pulsacion } from './pulsacion-larga';

/**
 * Mantener presionada una mesa del mapa (DP-12.2). Se pone en el CONTENEDOR del mapa: la mesa se
 * reconoce por `data-mesa-id`, así que ni `MesaShape` ni la rejilla del teléfono cambian su toque.
 * Un toque normal sigue llegando a la mesa; si el dedo se quedó lo bastante, el clic que sigue se
 * tira y se abre el globo. Con ratón, el clic derecho también.
 */
export function usePulsacionLarga(alMantener: (mesaId: string, x: number, y: number) => void) {
  const pulsacion = useRef<Pulsacion | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tirarElClic = useRef(false);

  const soltar = () => {
    if (reloj.current !== null) clearTimeout(reloj.current);
    reloj.current = null;
    pulsacion.current = null;
  };
  // DP-13.4: lo que está dentro de un globo de solicitud no es la mesa (`mesaDeLaPulsacion`).
  const mesaDe = (destino: EventTarget | null): string | null =>
    destino instanceof Element ? mesaDeLaPulsacion(destino) : null;

  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      // Un clic por tirar de la pulsación anterior (en el tacto a veces no llega) no puede comerse
      // el siguiente toque, sea de una mesa o de un globo.
      tirarElClic.current = false;
      const mesaId = mesaDe(e.target);
      if (mesaId === null) return;
      soltar();
      pulsacion.current = { mesaId, x: e.clientX, y: e.clientY, inicio: Date.now() };
      reloj.current = setTimeout(() => {
        const viva = pulsacion.current;
        if (viva === null) return;
        tirarElClic.current = true;
        soltar();
        alMantener(viva.mesaId, viva.x, viva.y);
      }, MS_PARA_MANTENER);
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const viva = pulsacion.current;
      if (viva !== null && seDeslizo(viva, e.clientX, e.clientY)) soltar();
    },
    onPointerUp: soltar,
    onPointerCancel: soltar,
    onContextMenu(e: MouseEvent<HTMLElement>) {
      const mesaId = mesaDe(e.target);
      if (mesaId === null) return;
      // El menú del navegador (y el «copiar» del teléfono) no tienen nada que hacer aquí.
      e.preventDefault();
      if (tirarElClic.current) return;
      soltar();
      alMantener(mesaId, e.clientX, e.clientY);
    },
    onClickCapture(e: MouseEvent<HTMLElement>) {
      if (!tirarElClic.current) return;
      tirarElClic.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
