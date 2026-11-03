import type { MesaEnPlano } from '@morphiqpos/domain/sala';

/**
 * ARRASTRAR UNA MESA CON UN DEDO (DP-12.3, DP-13.4) · la lógica, sin React ni navegador.
 *
 * La mesa sigue al dedo 1:1. Pero la pantalla puede tener MÁS de un puntero a la vez (un segundo
 * dedo, la palma, un lápiz): mientras un puntero lleva una mesa, los demás no existen para ella.
 * Un segundo dedo que baja NO pisa el origen del primero (la mesa saltaba al dedo nuevo), y que
 * suba, se mueva o se cancele tampoco termina ni mueve el arrastre del primero.
 *
 * Lee de cada evento sólo lo que necesita (`Puntero`), así se prueba con objetos planos.
 */

/** Menos que esto, en píxeles de la pantalla, es un toque y no un arrastre. */
export const TOQUE_PX = 6;

export interface Arrastre {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/** Lo que se lee de un evento de puntero. */
export interface Puntero {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
}

/** Quien tiene capturado el puntero (el elemento de la mesa). */
export interface Agarre {
  readonly isConnected: boolean;
  hasPointerCapture(pointerId: number): boolean;
}

export interface Medidas {
  readonly escala: number;
  readonly anchoDelPlano: number;
  readonly altoDelPlano: number;
}

export interface Destinos {
  readonly alArrastrar: (arrastre: Arrastre | null) => void;
  readonly alSoltar: (id: string, x: number, y: number) => void;
  readonly alTocar: (id: string) => void;
}

interface Inicio {
  readonly id: string;
  readonly puntero: number;
  readonly agarre: Agarre;
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

/**
 * Un arrastre que se quedó sin dueño (su mesa salió del documento a media jugada, o el navegador
 * soltó la captura sin avisar) no puede bloquear a los demás punteros para siempre.
 */
function estaMuerto(inicio: Inicio): boolean {
  return !inicio.agarre.isConnected || !inicio.agarre.hasPointerCapture(inicio.puntero);
}

export function crearArrastreDeUnDedo() {
  let inicio: Inicio | null = null;

  /** Los eventos de up, cancel y lost sólo cuentan si son del dedo que lleva la mesa. */
  const esDelArrastre = (e: Puntero): boolean => inicio !== null && inicio.puntero === e.pointerId;

  const terminar = (tocar: boolean, destinos: Destinos): void => {
    const vivo = inicio;
    inicio = null;
    destinos.alArrastrar(null);
    if (vivo === null) return;
    if (vivo.movida) destinos.alSoltar(vivo.id, vivo.ultimo.x, vivo.ultimo.y);
    else if (tocar) destinos.alTocar(vivo.id);
  };

  return {
    /** ¿Toma este puntero para arrastrar la mesa? No, si otro puntero ya lleva una. */
    bajar(m: MesaEnPlano, e: Puntero, agarre: Agarre): boolean {
      if (inicio !== null && estaMuerto(inicio)) inicio = null;
      if (inicio !== null && inicio.puntero !== e.pointerId) return false;
      inicio = {
        id: m.id,
        puntero: e.pointerId,
        agarre,
        px: e.clientX,
        py: e.clientY,
        x0: m.x,
        y0: m.y,
        movida: false,
        ultimo: { x: m.x, y: m.y },
      };
      return true;
    },

    mover(m: MesaEnPlano, e: Puntero, medidas: Medidas, quieta: boolean, destinos: Destinos): void {
      const vivo = inicio;
      if (vivo?.id !== m.id || vivo.puntero !== e.pointerId || quieta) return;
      if (!vivo.movida && Math.hypot(e.clientX - vivo.px, e.clientY - vivo.py) < TOQUE_PX) return;
      vivo.movida = true;
      vivo.ultimo = adondeVa(vivo, { x: e.clientX, y: e.clientY }, medidas.escala, {
        ancho: Math.max(0, medidas.anchoDelPlano - m.ancho),
        alto: Math.max(0, medidas.altoDelPlano - m.alto),
      });
      destinos.alArrastrar({ id: m.id, ...vivo.ultimo });
    },

    subir(e: Puntero, destinos: Destinos): void {
      if (esDelArrastre(e)) terminar(true, destinos);
    },

    /** El navegador canceló el gesto (una llamada, la palma): la mesa se queda donde iba. */
    cancelar(e: Puntero, destinos: Destinos): void {
      if (esDelArrastre(e)) terminar(false, destinos);
    },

    perderCaptura(e: Puntero, destinos: Destinos): void {
      if (esDelArrastre(e)) terminar(false, destinos);
    },
  };
}
