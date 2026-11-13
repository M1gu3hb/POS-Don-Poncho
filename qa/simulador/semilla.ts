/**
 * LA SUERTE CON SEMILLA: misma semilla, mismo día. Nada del simulador usa `Math.random()`.
 *
 * mulberry32 (32 bits, rápido y suficiente para repartir llegadas y antojos). Cada bot recibe su
 * propio hijo (`azar.hijo('mesero-3')`): lo que haga un bot no le cambia la suerte a otro, así que
 * repetir un día con un bot de más no reacomoda a los demás.
 */
export interface Azar {
  /** [0, 1). */
  real(): number;
  /** Entero en [min, max], los dos incluidos. */
  entero(min: number, max: number): number;
  probabilidad(p: number): boolean;
  elegir<T>(xs: readonly T[]): T;
  barajar<T>(xs: readonly T[]): T[];
  /** Una suerte nueva, derivada de ésta y de la etiqueta (estable). */
  hijo(etiqueta: string): Azar;
}

function hash32(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function crearAzar(semilla: number | string): Azar {
  const base = typeof semilla === 'number' ? semilla >>> 0 : hash32(semilla);
  let estado = base;
  const real = (): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const azar: Azar = {
    real,
    entero: (min, max) => min + Math.floor(real() * (max - min + 1)),
    probabilidad: (p) => real() < p,
    elegir: <T>(xs: readonly T[]): T => {
      if (xs.length === 0) throw new Error('elegir de una lista vacía');
      return xs[Math.floor(real() * xs.length)] as T;
    },
    barajar: <T>(xs: readonly T[]): T[] => {
      const copia = [...xs];
      for (let i = copia.length - 1; i > 0; i -= 1) {
        const j = Math.floor(real() * (i + 1));
        [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
      }
      return copia;
    },
    hijo: (etiqueta) => crearAzar(hash32(`${String(base)}:${etiqueta}`)),
  };
  return azar;
}
