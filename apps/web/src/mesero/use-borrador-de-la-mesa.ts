'use client';

import { useState, useSyncExternalStore } from 'react';

import {
  crearAlmacenDelBorrador,
  type AlmacenDelBorrador,
  type EstadoDelBorrador,
} from './almacen-del-borrador';

/**
 * LOS GANCHOS DEL BORRADOR DE LA MESA.
 *
 * `Mesero` llama a `useCrearBorrador()` y NO lee el estado: lo reparte. Cada componente que pinta
 * algo del borrador —el buscador, el pedido, el carrito flotante del teléfono— llama a
 * `useBorrador(borrador, selector)` y sólo se redibuja cuando CAMBIA lo que su selector saca.
 * (Por eso el nombre es de la mesa y no «carrito»: ya existe `src/portal/carrito-compartido`, que
 * es el del comensal.)
 */

/** Un almacén por pantalla: se crea al montar y no cambia mientras viva. */
export function useCrearBorrador(): AlmacenDelBorrador {
  const [almacen] = useState(crearAlmacenDelBorrador);
  return almacen;
}

/**
 * Lo que el selector saca del estado, y nada más. El selector debe devolver algo que conserve su
 * identidad mientras no cambie (un campo del estado, no un objeto nuevo): `useSyncExternalStore`
 * compara con `Object.is` y un valor nuevo en cada lectura lo haría pintar sin fin.
 */
export function useBorrador<T>(
  almacen: AlmacenDelBorrador,
  selector: (estado: EstadoDelBorrador) => T,
): T {
  return useSyncExternalStore(
    almacen.suscribir,
    () => selector(almacen.leer()),
    () => selector(almacen.leer()),
  );
}
