/**
 * LAS MESAS ENCIMADAS, A UNA CUADRÍCULA (DP-11.0). Puro.
 *
 * Una mesa sin posición se pinta en el punto de omisión del mapa (100, 100), así que «encimada»
 * es: sin posición, o en el mismo punto que otra. Ésas van a la cuadrícula por su número (la 1 en
 * la primera columna de la primera fila); las demás —lo que el dueño ya acomodó— no se tocan.
 */
const OMISION = { x: 100, y: 100 };

/**
 * @param {readonly { id: string, numero: number, posicion_x: number | null, posicion_y: number | null }[]} mesas
 * @param {{ columnas: number, x: number, y: number, pasoX: number, pasoY: number }} plano
 * @returns {{ id: string, numero: number, x: number, y: number }[]}
 */
export function planoDeLasMesas(mesas, plano) {
  const punto = (m) => `${String(m.posicion_x ?? OMISION.x)},${String(m.posicion_y ?? OMISION.y)}`;
  const cuantas = new Map();
  for (const m of mesas) cuantas.set(punto(m), (cuantas.get(punto(m)) ?? 0) + 1);
  return mesas
    .filter((m) => (cuantas.get(punto(m)) ?? 0) > 1)
    .sort((a, b) => a.numero - b.numero)
    .map((m) => {
      const lugar = m.numero - 1;
      return {
        id: m.id,
        numero: m.numero,
        x: plano.x + (lugar % plano.columnas) * plano.pasoX,
        y: plano.y + Math.floor(lugar / plano.columnas) * plano.pasoY,
      };
    });
}
