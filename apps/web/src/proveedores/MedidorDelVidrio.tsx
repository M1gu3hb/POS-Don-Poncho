'use client';

import { useEffect } from 'react';

import { CLAVE_DEL_VIDRIO } from '@/tema-arranque';

import { almacenDelAparato } from '~/restaurante/vista-de-solicitudes';

import { CUADROS_A_MEDIR, debeMedirElVidrio, decidirVidrio } from './vidrio';

/**
 * DP-11.4 · MIDE UNA VEZ SI ESTE APARATO AGUANTA EL VIDRIO (ver `vidrio.ts`).
 *
 * Espera a que la pantalla repose —lo que cuesta cargar no es lo que cuesta el vidrio—, cuenta
 * 60 cuadros y guarda la decisión en el aparato. Si es «sólido», lo aplica ya; las siguientes
 * veces lo aplica el guion de arranque antes del primer pintado. No pinta nada.
 */
const REPOSO_MS = 2500;

export function MedidorDelVidrio(): null {
  useEffect(() => {
    const raiz = document.documentElement;
    const almacen = almacenDelAparato();
    let guardado: string | null;
    try {
      guardado = almacen?.getItem(CLAVE_DEL_VIDRIO) ?? null;
    } catch {
      // Datos del sitio bloqueados: no hay dónde guardar la decisión, así que no se mide.
      return undefined;
    }
    const circunstancia = {
      guardado,
      elevacion: raiz.dataset['elevacion'],
      automatizado: navigator.webdriver,
      visible: document.visibilityState === 'visible',
    };
    if (!debeMedirElVidrio(circunstancia)) return undefined;

    let cancelado = false;
    let cuadro = 0;
    const duraciones: number[] = [];

    const medir =
      (anterior: number) =>
      (ahora: number): void => {
        // Escondida a media medición: los cuadros de una pestaña oculta no dicen nada.
        if (cancelado || document.visibilityState !== 'visible') return;
        duraciones.push(ahora - anterior);
        if (duraciones.length < CUADROS_A_MEDIR) {
          cuadro = requestAnimationFrame(medir(ahora));
          return;
        }
        const decision = decidirVidrio(duraciones);
        if (decision === null) return;
        try {
          almacen?.setItem(CLAVE_DEL_VIDRIO, decision);
        } catch {
          // Sin almacén: se aplica en esta visita y se vuelve a medir en la siguiente.
        }
        if (decision === 'solido') raiz.setAttribute('data-vidrio', 'solido');
      };

    const espera = window.setTimeout(() => {
      cuadro = requestAnimationFrame((inicio) => {
        cuadro = requestAnimationFrame(medir(inicio));
      });
    }, REPOSO_MS);

    return () => {
      cancelado = true;
      window.clearTimeout(espera);
      cancelAnimationFrame(cuadro);
    };
  }, []);

  return null;
}
