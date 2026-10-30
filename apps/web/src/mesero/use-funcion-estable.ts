'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * UNA FUNCIÓN CON IDENTIDAD ESTABLE que siempre llama a la ÚLTIMA versión de la que recibió.
 *
 * Los componentes memoizados del salón y del catálogo (`TeselaDeMesa`, `PlatilloTesela`) sólo se
 * saltan el dibujo si sus propiedades no cambian, y un manejador escrito dentro de `Mesero` es una
 * función nueva en cada dibujo. Envolverlo en `useCallback` exige repetir en una lista cada cosa
 * que lee, y el día que alguien añada una y olvide la lista, el manejador trabaja con datos viejos.
 * Esto no tiene lista: la identidad no cambia y el cuerpo siempre es el de este dibujo.
 *
 * La referencia se actualiza al CONFIRMAR el dibujo (`useLayoutEffect`), antes de que el navegador
 * entregue ningún toque: un manejador sólo se llama desde un evento, nunca durante el dibujo.
 */
export function useFuncionEstable<A extends readonly unknown[], R>(
  funcion: (...argumentos: A) => R,
): (...argumentos: A) => R {
  const ultima = useRef(funcion);
  useLayoutEffect(() => {
    ultima.current = funcion;
  });
  return useCallback((...argumentos: A) => ultima.current(...argumentos), []);
}
