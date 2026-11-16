'use client';

import { useSyncExternalStore } from 'react';

import {
  almacenDeLaBarra,
  barraPlegada,
  guardarEleccion,
  leerEleccion,
  type EleccionDeLaBarra,
} from './barra-lateral';

/**
 * La barra lateral del POS (DP-21 · Bloque 9 · O5): plegada o abierta, recordada en el aparato.
 * La elección se lee del almacén con `useSyncExternalStore`: en el servidor y en el primer pintado
 * es `null` (la omisión, sin diferencia entre servidor y navegador) y pasa a lo elegido en cuanto se
 * puede leer. Si el aparato no deja guardar (ventana privada), la elección vive en memoria mientras
 * la pantalla esté abierta.
 */

const oyentes = new Set<() => void>();
let enMemoria: EleccionDeLaBarra | null = null;

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  window.addEventListener('storage', avisar);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener('storage', avisar);
  };
}

const instantanea = (): EleccionDeLaBarra | null => leerEleccion(almacenDeLaBarra()) ?? enMemoria;
const delServidor = (): EleccionDeLaBarra | null => null;

/** La elección que este aparato recuerda (`null`: nunca eligió y decide la omisión). */
export function useEleccionDeLaBarra(): EleccionDeLaBarra | null {
  return useSyncExternalStore(suscribir, instantanea, delServidor);
}

/**
 * Fija la barra en plegada o abierta (Configuración → Este aparato, DP-21 · Bloque 21). Es lo mismo
 * que hace el botón de la barra: se recuerda en el aparato y la barra se entera al instante.
 */
export function elegirLaBarra(eleccion: EleccionDeLaBarra): void {
  enMemoria = eleccion;
  guardarEleccion(almacenDeLaBarra(), eleccion);
  oyentes.forEach((avisar) => {
    avisar();
  });
}

export function useBarraLateral({
  deModelo,
  secciones,
}: {
  readonly deModelo: boolean;
  readonly secciones: number;
}) {
  const eleccion = useSyncExternalStore(suscribir, instantanea, delServidor);
  const plegada = barraPlegada({ eleccion, deModelo, secciones });
  const alternar = (): void => {
    enMemoria = plegada ? 'abierta' : 'plegada';
    guardarEleccion(almacenDeLaBarra(), enMemoria);
    oyentes.forEach((avisar) => {
      avisar();
    });
  };
  return { plegada, alternar };
}
