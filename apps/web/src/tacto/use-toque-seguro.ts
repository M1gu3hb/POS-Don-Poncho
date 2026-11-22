'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

import { bolitaSiSeAgrego, puntoDeLaFicha } from './bolita-dom';
import {
  decidirToque,
  gestoVigente,
  liberarAlTerminar,
  sumaDeDesplazamientosDe,
  type GestoMedido,
  type OpcionesDelToque,
} from './toque-seguro';

/**
 * EL TOQUE SEGURO (DP-23) · lo que se mide con el DOM; la decisión es de `toque-seguro.ts`.
 *
 * Se ponen los manejadores que devuelve en el botón (o la tarjeta) que AGREGA al pedido, en lugar de
 * un `onClick` crudo. Mide el gesto con Pointer Events (ratón, dedo y lápiz por igual; existen en
 * Chromium 99): al bajar anota dónde, cuándo y cuánto están desplazados los contenedores; mientras
 * dura mira cuánto se aleja el puntero y si algo se desplaza; el `click` que sigue lo decide. Sigue
 * siendo el `click` nativo: un `<button>` conserva su nombre, el foco y Enter/Espacio.
 *
 * Enter sostenido no se repite (`event.repeat`), y mientras la acción devuelve una promesa pendiente
 * no entra otro toque de este mismo botón.
 */

export type AccionDeAgregar = () => unknown;

export interface ManejadoresDelToque {
  readonly onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  readonly onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  readonly onClick: (e: MouseEvent<HTMLElement>) => void;
}

interface Medicion {
  readonly x: number;
  readonly y: number;
  readonly inicio: number;
  readonly desplazamientoInicial: number;
  readonly pointerId: number;
  alejamientoPx: number;
  cancelado: boolean;
  terminado: boolean;
  fin: number;
}

/** Suma el desplazamiento de la cadena de contenedores (y de la página) que contiene al botón. */
export function sumaDeDesplazamientos(desde: Element | null): number {
  return sumaDeDesplazamientosDe(desde, document.scrollingElement);
}

export function useToqueSeguro(
  alAgregar: AccionDeAgregar,
  opciones: OpcionesDelToque = {},
): ManejadoresDelToque {
  const medicion = useRef<Medicion | null>(null);
  const ultimoAgregado = useRef<number | null>(null);
  const enCurso = useRef(false);
  const quitarOyentes = useRef<(() => void) | null>(null);
  // Siempre la acción y las opciones de la última pintada: un manejador viejo no agrega lo de antes.
  const accion = useRef(alAgregar);
  const reposoMs = opciones.reposoMs;
  const sinCandado = opciones.sinCandado === true;
  // La acción de la última pintada (no la de antes), anotada al confirmarse la pintada.
  useEffect(() => {
    accion.current = alAgregar;
  });
  useEffect(() => () => quitarOyentes.current?.(), []);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !e.isPrimary) return;
    quitarOyentes.current?.();
    const boton = e.currentTarget;
    const m: Medicion = {
      x: e.clientX,
      y: e.clientY,
      inicio: performance.now(),
      desplazamientoInicial: sumaDeDesplazamientos(boton),
      pointerId: e.pointerId,
      alejamientoPx: 0,
      cancelado: false,
      terminado: false,
      fin: 0,
    };
    medicion.current = m;

    const alMover = (ev: globalThis.PointerEvent): void => {
      if (ev.pointerId !== m.pointerId) return;
      m.alejamientoPx = Math.max(m.alejamientoPx, Math.hypot(ev.clientX - m.x, ev.clientY - m.y));
    };
    const alTerminar = (ev: globalThis.PointerEvent): void => {
      if (ev.pointerId !== m.pointerId) return;
      alMover(ev);
      m.cancelado = ev.type === 'pointercancel';
      m.terminado = true;
      m.fin = performance.now();
      quitar();
    };
    const quitar = (): void => {
      document.removeEventListener('pointermove', alMover, true);
      document.removeEventListener('pointerup', alTerminar, true);
      document.removeEventListener('pointercancel', alTerminar, true);
      quitarOyentes.current = null;
    };
    document.addEventListener('pointermove', alMover, true);
    document.addEventListener('pointerup', alTerminar, true);
    document.addEventListener('pointercancel', alTerminar, true);
    quitarOyentes.current = quitar;
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    // Sin gesto de puntero que medir: lo que quede de uno viejo no vale para el teclado.
    medicion.current = null;
    // Enter sostenido dispara un clic por cada repetición: sólo cuenta el primero.
    if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
  }, []);

  const onClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      const m = medicion.current;
      medicion.current = null;
      const ahora = performance.now();
      let gesto: GestoMedido | null = null;
      // Un gesto viejo (terminado o huérfano) no es el de este clic: un `click()` programático, el teclado.
      if (m !== null && gestoVigente(m, ahora)) {
        const seDesplazo = sumaDeDesplazamientos(e.currentTarget) !== m.desplazamientoInicial;
        gesto = {
          alejamientoPx: m.alejamientoPx,
          desplazamientoPx: seDesplazo ? 1 : 0,
          duracionMs: (m.terminado ? m.fin : ahora) - m.inicio,
          cancelado: m.cancelado,
        };
      }
      const decision = decidirToque(
        gesto,
        { ahora, ultimoAgregado: ultimoAgregado.current, enCurso: enCurso.current },
        { ...(reposoMs === undefined ? {} : { reposoMs }), sinCandado },
      );
      if (!decision.agrega) return;
      ultimoAgregado.current = ahora;
      // DP-25 · Parte 5 · La bolita sale DESPUÉS de que el toque se aceptó y la acción confirmó que
      // agregó (`SE_AGREGO`); el punto se anota antes por si la acción desmonta el botón. No retrasa
      // ni condiciona el agregado.
      const origen = puntoDeLaFicha(e.currentTarget);
      const resultado = accion.current();
      const conCandado = resultado instanceof Promise && !sinCandado;
      bolitaSiSeAgrego(resultado, origen, { yaSeAtiendeElRechazo: conCandado });
      if (resultado instanceof Promise && conCandado) {
        enCurso.current = true;
        // Libera y vuelve a lanzar el rechazo: no se lo traga.
        void liberarAlTerminar(resultado, () => {
          enCurso.current = false;
        });
      }
    },
    [reposoMs, sinCandado],
  );

  return { onPointerDown, onKeyDown, onClick };
}
