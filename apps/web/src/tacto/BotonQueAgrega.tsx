'use client';

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';

import { useToqueSeguro, type AccionDeAgregar } from './use-toque-seguro';

/**
 * EL BOTÓN QUE AGREGA AL PEDIDO (DP-23). Todo botón que agrega (la ficha de un platillo, el + y el –
 * de una línea del pedido) es éste, no un `<button onClick>` crudo: sólo agrega si alguien quiso
 * tocarlo (`toque-seguro.ts`). Sigue siendo un `<button>`: nombre accesible, foco, Enter y Espacio.
 */

/**
 * El + y el – de una línea: una persona no toca dos veces a propósito en menos de esto; es más corto
 * que el reposo de una ficha (350 ms) para no estorbar al que suma de cuatro en cuatro.
 */
export const REPOSO_DE_MAS_Y_MENOS_MS = 200;

export interface BotonQueAgregaProps extends Omit<
  ComponentPropsWithoutRef<'button'>,
  'onClick' | 'onPointerDown' | 'onKeyDown'
> {
  /** Lo que hace un toque de verdad. Si devuelve una promesa, no entra otro toque hasta que termine. */
  readonly alAgregar: AccionDeAgregar;
  readonly reposoMs?: number;
}

export function BotonQueAgrega({
  alAgregar,
  reposoMs,
  type = 'button',
  ...resto
}: BotonQueAgregaProps) {
  const toque = useToqueSeguro(alAgregar, reposoMs === undefined ? {} : { reposoMs });
  return <button type={type} data-boton-que-agrega="" {...resto} {...toque} />;
}

/**
 * La rejilla de fichas vuelve arriba cuando cambia lo que muestra (la categoría, la búsqueda): antes
 * se quedaba donde estaba y la categoría nueva aparecía ya desplazada.
 */
export function useRejillaQueVuelveArriba<T extends HTMLElement>(clave: string) {
  const rejilla = useRef<T | null>(null);
  useEffect(() => {
    if (rejilla.current !== null) rejilla.current.scrollTop = 0;
  }, [clave]);
  return rejilla;
}
