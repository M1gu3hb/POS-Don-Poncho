/**
 * Las zonas del salón de Don Poncho, sin pantalla: el Salón lleva las mesas 1 a 10 y la Terraza, de la
 * 11 a la 20. El plano de «Unir mesas» y el editor enseñan UNA zona a la vez, así que lo que se junta
 * (o se mueve) se elige dentro de la misma zona.
 */
const MESAS_POR_ZONA = 10;

export function zonaDeLaMesa(numero: number): number {
  return Math.floor((numero - 1) / MESAS_POR_ZONA);
}

export function mismaZona(a: number, b: number): boolean {
  return zonaDeLaMesa(a) === zonaDeLaMesa(b);
}

/** La primera mesa libre, que nadie atiende y es de la zona de `mesaGrande`; `undefined` si no hay. */
export function elegirMesaDeLaMismaZona<T extends { numero: number; estado: string }>(
  mesas: readonly T[],
  mesaGrande: number,
  atendidas: { has(numero: number): boolean },
): T | undefined {
  return mesas.find(
    (m) => m.estado === 'Libre' && !atendidas.has(m.numero) && mismaZona(m.numero, mesaGrande),
  );
}
