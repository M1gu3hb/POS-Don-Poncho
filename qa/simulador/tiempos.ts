/**
 * LOS TIEMPOS DE CADA ACCIÓN: cuánto tarda (en milisegundos REALES: lo que espera la persona) y
 * p50/p95 por acción para el informe del día. Una acción de más de 3 s, o una pantalla que tarda
 * más de 15 s en enterarse de un cambio, también es un incidente (de rendimiento).
 */
export const UMBRAL_ACCION_MS = 3_000;
export const UMBRAL_ENTERARSE_MS = 15_000;

export interface Medicion {
  readonly accion: string;
  readonly ms: number;
}

export interface Tiempos {
  medir<T>(
    accion: string,
    fn: () => Promise<T>,
    alPasarse?: (ms: number) => Promise<void>,
  ): Promise<T>;
  anotar(accion: string, ms: number): void;
  resumen(): readonly { accion: string; n: number; p50: number; p95: number; max: number }[];
}

export function percentil(ordenados: readonly number[], p: number): number {
  if (ordenados.length === 0) return 0;
  const i = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[Math.max(0, i)] ?? 0;
}

export function crearTiempos(): Tiempos {
  const por = new Map<string, number[]>();
  const anotar = (accion: string, ms: number) => {
    const lista = por.get(accion) ?? [];
    lista.push(ms);
    por.set(accion, lista);
  };
  return {
    anotar,
    async medir(accion, fn, alPasarse) {
      const inicio = performance.now();
      const r = await fn();
      const ms = Math.round(performance.now() - inicio);
      anotar(accion, ms);
      if (ms > UMBRAL_ACCION_MS && alPasarse !== undefined) await alPasarse(ms);
      return r;
    },
    resumen() {
      return [...por.entries()]
        .map(([accion, ms]) => {
          const o = [...ms].sort((a, b) => a - b);
          return {
            accion,
            n: o.length,
            p50: percentil(o, 50),
            p95: percentil(o, 95),
            max: o[o.length - 1] ?? 0,
          };
        })
        .sort((a, b) => a.accion.localeCompare(b.accion));
    },
  };
}
