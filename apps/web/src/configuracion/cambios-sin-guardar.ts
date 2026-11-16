'use client';

import { useEffect } from 'react';

/**
 * «SALIR CON CAMBIOS SIN GUARDAR AVISA» (DP-21 · Bloque 21).
 *
 * Cada tarjeta que tiene un formulario dice aquí si tiene algo sin guardar (`useCambiosSinGuardar`).
 * La pantalla de Configuración pregunta antes de cambiar de sección (`hayCambiosSinGuardar`) y el
 * navegador, antes de cerrar la pestaña. Un registro por tarjeta: guardar o salir de la tarjeta lo
 * limpia.
 */

const sucias = new Set<string>();

export function marcarSucia(id: string, sucia: boolean): void {
  if (sucia) sucias.add(id);
  else sucias.delete(id);
}

export function hayCambiosSinGuardar(): boolean {
  return sucias.size > 0;
}

export function tarjetasSinGuardar(): readonly string[] {
  return [...sucias];
}

export function olvidarTodas(): void {
  sucias.clear();
}

export const PREGUNTA_DE_SALIR =
  'Tienes cambios sin guardar en esta sección. Si sales, se pierden. ¿Salir sin guardar?';

/** Pregunta (si hace falta) antes de dejar la sección. `true` si se puede seguir. */
export function puedoSalir(preguntar: (texto: string) => boolean): boolean {
  if (!hayCambiosSinGuardar()) return true;
  if (!preguntar(PREGUNTA_DE_SALIR)) return false;
  olvidarTodas();
  return true;
}

export function useCambiosSinGuardar(id: string, sucia: boolean): void {
  useEffect(() => {
    marcarSucia(id, sucia);
    return () => {
      marcarSucia(id, false);
    };
  }, [id, sucia]);
}

/** El aviso del navegador al cerrar o recargar con algo sin guardar. */
export function useAvisoAlCerrar(): void {
  useEffect(() => {
    const aviso = (evento: BeforeUnloadEvent): void => {
      if (!hayCambiosSinGuardar()) return;
      evento.preventDefault();
    };
    window.addEventListener('beforeunload', aviso);
    return () => {
      window.removeEventListener('beforeunload', aviso);
    };
  }, []);
}
