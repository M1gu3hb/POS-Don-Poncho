import { mesasElegibles, type MesaElegible } from './mesas-elegibles';

/**
 * CAMBIAR DE MESA SIN SALIR DEL MAPA (DP-21 · Bloque 10 · M24), sin pantalla.
 *
 * «Cambiar de mesa» llevaba a «Mesa activa», otra pantalla: el mesero perdía el mapa para algo
 * que se dice en una frase («nos pasamos a la 7»). Ahora el panel de la mesa abre AHÍ MISMO las
 * mesas libres, primero las de su zona; al tocar una pregunta, y al pasar avisa.
 *
 * Qué mesa es elegible lo sigue diciendo `mesas-elegibles.ts` (libre, sin cuenta y no oculta en
 * una unión), quién puede mover la cuenta lo sigue diciendo `puede-mover-la-cuenta.ts`, y la
 * cuenta la mueve el comando de siempre (`restaurante.cambiar_mesa`).
 */

/** La zona, para comparar: sin mayúsculas ni espacios de más; sin zona, cadena vacía. */
function zonaComparable(zona: string | null | undefined): string {
  return (zona ?? '').trim().toLocaleLowerCase('es-MX');
}

export interface DestinosDelCambio {
  /** Las libres de la zona de la mesa: lo primero que se ofrece. */
  readonly deLaZona: readonly MesaElegible[];
  /** Las libres del resto del salón («nos pasamos a la terraza»). */
  readonly deOtrasZonas: readonly MesaElegible[];
}

/** A qué mesas se puede pasar la cuenta, las de su zona primero. Cada grupo, por número. */
export function destinosDelCambio(
  mesas: readonly MesaElegible[],
  propia: { readonly id: string; readonly zona: string | null | undefined },
): DestinosDelCambio {
  const suZona = zonaComparable(propia.zona);
  const libres = mesasElegibles(mesas, propia.id);
  return {
    deLaZona: libres.filter((m) => zonaComparable(m.zona) === suZona),
    deOtrasZonas: libres.filter((m) => zonaComparable(m.zona) !== suZona),
  };
}

/** «¿Pasar la cuenta de la mesa 3 a la mesa 7?» */
export function preguntaDelCambio(origen: number, destino: number): string {
  return `¿Pasar la cuenta de la mesa ${String(origen)} a la mesa ${String(destino)}?`;
}

/** «La cuenta pasó a la mesa 7» */
export function avisoDelCambio(destino: number): string {
  return `La cuenta pasó a la mesa ${String(destino)}`;
}

const DIRECCION: readonly string[] = ['dueno', 'administrador', 'gerente'];

/**
 * Quién ve el enlace «Unir o dividir la cuenta» (a «Mesa activa»): la dirección. Al mesero esa
 * pantalla no le da dividir (es de caja y dirección), así que el enlace no se le promete.
 */
export function puedeUnirODividir(puesto: string | null): boolean {
  return puesto !== null && DIRECCION.includes(puesto);
}
