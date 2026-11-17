/**
 * EL PLAZO DE UNA PRUEBA DEL LABORATORIO (DP-22, sobra del lote 1). Puro.
 *
 * `imprimirElementoDePrueba` esperaba a la app sin límite: con la app colgada el botón se quedaba
 * en «Enviando…» para siempre y la persona no sabía si la impresora, el cable o el aparato fallaba.
 * Los trabajos de la Caja ya tenían plazo (`PLAZO_PARA_ENVIAR_MS`, `trabajos.ts`): de SILENCIO, cada
 * aviso de avance de la app lo renueva, y lo que conteste después de vencido ya no cuenta. La
 * prueba usa ese mismo número y esa misma regla; no inventa otro.
 */
import { PLAZO_PARA_ENVIAR_MS } from '../trabajos.ts';
import type { ResultadoDePrueba } from './resultado-de-prueba.ts';

/** Lo que dice la prueba cuando la app no contestó a tiempo: qué pasó y qué hacer. */
export const RESULTADO_SIN_RESPUESTA: ResultadoDePrueba = {
  ok: false,
  texto:
    `La impresora no contestó en ${String(PLAZO_PARA_ENVIAR_MS / 1000)} s. ` +
    'Revisa que esté encendida y conectada y reintenta; si la primera prueba llega tarde, saldrá dos veces.',
};

/**
 * Espera a que `arrancar` termine, pero no más de `plazoMs` SIN que la app diga nada. `arrancar`
 * recibe `renovar`, que reinicia la cuenta (cada aviso de avance de la app). Si el plazo vence gana
 * `alVencer()`; si la app rechaza, el error pasa tal cual. Al terminar no deja ningún reloj vivo.
 */
export function conPlazoDeSilencio<T, V>(
  arrancar: (renovar: () => void) => Promise<T>,
  plazoMs: number,
  alVencer: () => V,
): Promise<T | V> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  let cerrado = false;
  let vencer: (resultado: V) => void = () => undefined;
  const sinRespuesta = new Promise<V>((resolver) => {
    vencer = resolver;
  });
  const armar = (): void => {
    // Un aviso que llega después de terminar no debe dejar un reloj vivo.
    if (cerrado) return;
    clearTimeout(reloj);
    reloj = setTimeout(() => {
      vencer(alVencer());
    }, plazoMs);
  };
  armar();
  return Promise.race([arrancar(armar), sinRespuesta]).finally(() => {
    cerrado = true;
    clearTimeout(reloj);
  });
}
