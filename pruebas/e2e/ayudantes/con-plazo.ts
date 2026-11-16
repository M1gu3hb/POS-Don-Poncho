/** Lo que devuelve `conPlazo` cuando el trabajo no terminó a tiempo. */
export const AGOTADO = Symbol('plazo agotado');

/**
 * Espera un trabajo a lo más `ms`. Una pestaña congelada no contesta nunca —ni con un error—, y
 * un `await` sin plazo sobre ella detiene toda la prueba hasta que vence el tiempo de la prueba.
 */
export async function conPlazo<T>(trabajo: Promise<T>, ms: number): Promise<T | typeof AGOTADO> {
  let reloj: NodeJS.Timeout | undefined;
  const plazo = new Promise<typeof AGOTADO>((resolver) => {
    reloj = setTimeout(() => {
      resolver(AGOTADO);
    }, ms);
  });
  try {
    return await Promise.race([trabajo, plazo]);
  } finally {
    clearTimeout(reloj);
  }
}
