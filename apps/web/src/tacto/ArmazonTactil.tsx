'use client';

import { useEffect } from 'react';

import { hayPunteroGrueso } from '@morphiqpos/ui/foco-al-abrir';

import { montarTieneEnElNavegador } from '~/compatibilidad/tiene-de-respaldo';

import { montarAltoVisible } from './alto-visible';
import { montarLlevarAlCentro } from './llevar-al-centro';
import { montarSinMenuNativo } from './sin-seleccion';

/**
 * LO TÁCTIL DEL ARMAZÓN DEL POS (DP-21 · Bloque 9). Se monta UNA vez, en el armazón de las pantallas
 * internas (`AppLayout`); el portal del comensal no lo monta y por eso queda fuera.
 *
 *  · M4 — la pulsación larga no selecciona ni saca el menú del sistema (`sin-seleccion.ts`);
 *  · M16 — `--alto-visible` en `<html>`, para que los diálogos y paneles no queden bajo el teclado
 *    (`alto-visible.ts`), y el campo enfocado se lleva al centro, una vez (`llevar-al-centro.ts`).
 *
 * No pinta nada.
 */

/** Sin animar si la persona lo pidió, o si el aparato va en modo ligero. */
function movimientoReducido(): boolean {
  const raiz = document.documentElement;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    raiz.dataset['movimiento'] === 'nula' ||
    raiz.hasAttribute('data-ligero')
  );
}

export function ArmazonTactil(): null {
  useEffect(() => {
    const desmontarMenu = montarSinMenuNativo(document);
    const desmontarAlto = montarAltoVisible(window, document.documentElement);
    const desmontarCentro = montarLlevarAlCentro(
      document,
      {
        visual: window.visualViewport,
        programar: (accion, ms) => window.setTimeout(accion, ms),
        cancelar: (id) => {
          window.clearTimeout(id as number);
        },
        reducirMovimiento: movimientoReducido,
        medir: (campo: HTMLElement) => {
          const caja = campo.getBoundingClientRect();
          const visual = window.visualViewport;
          return {
            campo: { top: caja.top, bottom: caja.bottom },
            visible: { top: visual?.offsetTop ?? 0, height: visual?.height ?? window.innerHeight },
          };
        },
        llevar: (campo: HTMLElement, comportamiento) => {
          campo.scrollIntoView({ block: 'center', behavior: comportamiento });
        },
      },
      () => hayPunteroGrueso(),
    );
    // DP-21 · Bloque 15: `:has(:checked)` y `:has(:focus-visible)` en un motor sin `:has()` (Chromium < 105).
    const desmontarTiene = montarTieneEnElNavegador();
    return () => {
      desmontarTiene();
      desmontarMenu();
      desmontarAlto();
      desmontarCentro();
    };
  }, []);
  return null;
}
