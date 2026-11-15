'use client';

import { useEffect } from 'react';

import type { MorphiqApp } from './puente/contrato.ts';

/**
 * EL MODO LIGERO (DP-20 · Parte 6).
 *
 * En un POS viejo, los desenfoques, las sombras grandes y las animaciones son lo que hace lenta la
 * pantalla. La app sabe con qué cuenta el aparato (RAM y procesador) y decide —o lo fija alguien a
 * mano en Configuración → Impresión → Este aparato—; se lo dice a la página, y la página se pone
 * `<html data-ligero>`. El CSS (`heredado/index.css`) hace el resto: sin desenfoque, sin sombras
 * pesadas y con las duraciones en cero, igual que con «reducir movimiento».
 *
 * Sin la app (navegador o PWA) no cambia nada.
 */

export const MARCA_DE_LIGERO = 'data-ligero';

/** Pone o quita la marca. Lo único que hace falta del elemento es eso. */
export function aplicarModoLigero(
  raiz: {
    setAttribute(nombre: string, valor: string): void;
    removeAttribute(nombre: string): void;
  },
  activo: boolean,
): void {
  if (activo) raiz.setAttribute(MARCA_DE_LIGERO, '');
  else raiz.removeAttribute(MARCA_DE_LIGERO);
}

/** Lo que llega por el evento `modo-ligero` (o de `modoLigero()`): sólo importa `activo`. */
export function estaActivo(datos: unknown): boolean {
  return (
    typeof datos === 'object' && datos !== null && (datos as { activo?: unknown }).activo === true
  );
}

export function useModoLigero(app: MorphiqApp | null): void {
  useEffect(() => {
    if (app === null) return undefined;
    let vivo = true;
    const raiz = document.documentElement;
    app
      .modoLigero()
      .then((modo) => {
        if (vivo) aplicarModoLigero(raiz, estaActivo(modo));
      })
      .catch((error: unknown) => {
        // Sin saberlo, la pantalla se queda como estaba (completa): no es un fallo de la venta.
        console.error('[modo-ligero] la app no dijo si el aparato va en modo ligero:', error);
      });
    const dejarDeEscuchar = app.escuchar('modo-ligero', (datos) => {
      aplicarModoLigero(raiz, estaActivo(datos));
    });
    return () => {
      vivo = false;
      dejarDeEscuchar();
    };
  }, [app]);
}
