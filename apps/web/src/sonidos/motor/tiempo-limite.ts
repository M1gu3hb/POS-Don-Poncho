/**
 * ENCENDER EL AUDIO CON TIEMPO LÍMITE (DP-13.2).
 *
 * `AudioContext.resume()` sin un gesto del usuario puede no resolverse nunca. Quien lo esperaba
 * —el sonido de la comanda nueva, y detrás de él la voz (`sonarAntesDeHablar`)— se quedaba
 * esperando para siempre: el aparato mudo y la voz callada. Con el límite, se rinde con un error
 * (el gestor lo anota) y la voz sigue.
 */

/** Lo que se espera a que el navegador encienda el audio. */
export const MS_PARA_ENCENDER = 1500;

export function conTiempoLimite<T>(promesa: Promise<T>, ms: number, motivo: string): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    const reloj = setTimeout(() => {
      rechazar(new Error(motivo));
    }, ms);
    promesa.then(
      (valor) => {
        clearTimeout(reloj);
        resolver(valor);
      },
      (error: unknown) => {
        clearTimeout(reloj);
        rechazar(error instanceof Error ? error : new Error(motivo));
      },
    );
  });
}
