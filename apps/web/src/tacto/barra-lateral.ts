import { almacenDelAparato } from '~/restaurante/vista-de-solicitudes';

/**
 * LA BARRA LATERAL: SI EMPIEZA PLEGADA, Y LO QUE EL APARATO ELIGIÓ (DP-21 · Bloque 9 · O5/M3).
 *
 * Un puesto con una o dos secciones (el mesero, la cocina) no tiene caso que ocupe 240 px para
 * enseñar sólo «Mesas»: empieza plegada. Pero lo que la persona elige en ese aparato manda siempre
 * —plegar o abrir—, y se recuerda en `localStorage` (envuelto en `try/catch`: un navegador en
 * ventana privada, o con los datos del sitio bloqueados, lo niega o lanza).
 *
 * Lo puro (decidir, leer, guardar) vive aquí, con su prueba; el hook (`use-barra-lateral.ts`) sólo
 * lo conecta a React.
 */

export const CLAVE_DE_LA_BARRA = 'mpos.barra-lateral';

/** Con tantas secciones o menos, la barra empieza plegada si el aparato no ha elegido. */
export const SECCIONES_PARA_EMPEZAR_PLEGADA = 2;

export type EleccionDeLaBarra = 'plegada' | 'abierta';

export interface AlmacenDeLaBarra {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

/** La elección de este aparato; `null` si nunca eligió, si el valor no es nuestro o si no se puede leer. */
export function leerEleccion(
  almacen: Pick<AlmacenDeLaBarra, 'getItem'> | null,
): EleccionDeLaBarra | null {
  try {
    const guardada = almacen?.getItem(CLAVE_DE_LA_BARRA);
    return guardada === 'plegada' || guardada === 'abierta' ? guardada : null;
  } catch {
    // Ventana privada o datos del sitio bloqueados: se decide por la omisión, como el primer día.
    return null;
  }
}

/** Recuerda la elección. Si no se puede, la barra funciona igual (sólo que no se acuerda). */
export function guardarEleccion(
  almacen: Pick<AlmacenDeLaBarra, 'setItem'> | null,
  eleccion: EleccionDeLaBarra,
): void {
  try {
    almacen?.setItem(CLAVE_DE_LA_BARRA, eleccion);
  } catch {
    // Cuota llena o datos bloqueados: no hay dónde recordarlo, y no es motivo para romper la pantalla.
  }
}

/** ¿La barra se pinta plegada? Lo elegido manda; sin elegir, las pantallas de modelo y los puestos chicos. */
export function barraPlegada(entrada: {
  readonly eleccion: EleccionDeLaBarra | null;
  readonly deModelo: boolean;
  readonly secciones: number;
}): boolean {
  if (entrada.eleccion !== null) return entrada.eleccion === 'plegada';
  return entrada.deModelo || entrada.secciones <= SECCIONES_PARA_EMPEZAR_PLEGADA;
}

/** El almacén del aparato, para quien conecta esto a la pantalla. */
export const almacenDeLaBarra = almacenDelAparato;
