import { useSyncExternalStore } from 'react';

/** Cada cuánto se repinta el reloj de las tarjetas: los minutos cambian cada 60 s, 15 s basta. */
const CADA_MS = 15_000;

/**
 * DP-16 · 2.2 · EL «AHORA» DE LA PANTALLA, como un reloj externo que todas las tarjetas comparten.
 *
 * Nace en 0 y no en `Date.now()`: un reloj sembrado en el servidor es un desajuste de hidratación
 * garantizado (`getServerSnapshot` es 0). Con 0 las tarjetas no dicen minutos hasta que el reloj
 * arranca (un instante). El reloj sólo corre mientras haya una pantalla que lo mire.
 */
let ahora = 0;
let reloj: ReturnType<typeof setInterval> | null = null;
const oyentes = new Set<() => void>();

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  if (reloj === null) {
    ahora = Date.now();
    reloj = setInterval(() => {
      ahora = Date.now();
      oyentes.forEach((oyente) => {
        oyente();
      });
    }, CADA_MS);
  }
  return () => {
    oyentes.delete(avisar);
    if (oyentes.size === 0 && reloj !== null) {
      clearInterval(reloj);
      reloj = null;
    }
  };
}

export function useAhora(): number {
  return useSyncExternalStore(
    suscribir,
    () => ahora,
    () => 0,
  );
}
