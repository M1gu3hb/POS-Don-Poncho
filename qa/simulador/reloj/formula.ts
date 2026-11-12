/**
 * EL RELOJ DE QA: la misma fórmula en el servidor, en la base y en cada navegador.
 *
 * La hora simulada avanza desde `baseSim` a `factor` veces la velocidad real, contando desde
 * `baseReal` (la hora real del instante en que se fijó). Los tres relojes leen los mismos
 * parámetros y el mismo reloj real de esta máquina, así que coinciden al milisegundo.
 */
export interface ParametrosDelReloj {
  /** Milisegundos reales (época) del instante en que se fijó el reloj. */
  readonly baseReal: number;
  /** Milisegundos simulados (época) que corresponden a `baseReal`. */
  readonly baseSim: number;
  /** Cuántos segundos simulados pasan por segundo real (1 = tiempo real). */
  readonly factor: number;
}

export const FACTOR_MAXIMO = 60;

export function horaSimulada(p: ParametrosDelReloj, real: number): number {
  return Math.floor(p.baseSim + (real - p.baseReal) * p.factor);
}

/** Los parámetros, si son válidos; si no, `null` (un archivo a medio escribir no mueve el reloj). */
export function parametrosValidos(valor: unknown): ParametrosDelReloj | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const { baseReal, baseSim, factor } = valor as Record<string, unknown>;
  if (typeof baseReal !== 'number' || !Number.isFinite(baseReal)) return null;
  if (typeof baseSim !== 'number' || !Number.isFinite(baseSim)) return null;
  if (typeof factor !== 'number' || !(factor > 0) || factor > FACTOR_MAXIMO) return null;
  return { baseReal, baseSim, factor };
}

/**
 * El código que se inyecta en cada página (Playwright `addInitScript`): reemplaza `Date` por uno
 * que cuenta la hora simulada. Sin argumentos y `Date.now()` dan la simulada; con argumentos, igual
 * que siempre. Los parámetros viven en `globalThis.__relojQA` para poder moverlos sin recargar.
 */
export function guionDelNavegador(p: ParametrosDelReloj): string {
  return `(() => {
  globalThis.__relojQA = ${JSON.stringify(p)};
  if (globalThis.__relojQAInstalado) return;
  globalThis.__relojQAInstalado = true;
  const Real = Date;
  const ahora = () => {
    const r = globalThis.__relojQA;
    return Math.floor(r.baseSim + (Real.now() - r.baseReal) * r.factor);
  };
  function DateQA(...a) {
    if (!new.target) return new Real(ahora()).toString();
    return Reflect.construct(Real, a.length === 0 ? [ahora()] : a, new.target);
  }
  Object.setPrototypeOf(DateQA, Real);
  for (const k of ['parse', 'UTC']) Object.defineProperty(DateQA, k, { value: Real[k], writable: true, configurable: true });
  DateQA.prototype = Real.prototype;
  DateQA.now = ahora;
  globalThis.Date = DateQA;
})();`;
}
