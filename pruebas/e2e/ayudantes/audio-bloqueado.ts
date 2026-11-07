import type { Page } from '@playwright/test';

/**
 * EL AUDIO QUE NO CORRE (DP-14.6-8), para la prueba de navegador.
 *
 * iOS deja el `AudioContext` «interrumpido» (bloqueo de pantalla, llamada) y `resume()` se RESUELVE
 * sin que el audio corra. Esta página se porta así: su contexto de audio dice `suspended`, y
 * `resume()` contesta sin encenderlo, hasta que la prueba pone `window.__audioCorre = true`
 * (`audioCorre`). La voz se cambia por una instantánea. Hay que llamarlo ANTES de navegar: es un script de inicio.
 */
export async function audioComoEnIos(pagina: Page): Promise<void> {
  await pagina.addInitScript(() => {
    const Real = window.AudioContext;
    const w = window as unknown as { __audioCorre?: boolean };
    class AudioQueNoCorre extends Real {
      override get state(): AudioContextState {
        return w.__audioCorre === true ? 'running' : 'suspended';
      }
      override resume(): Promise<void> {
        return w.__audioCorre === true ? super.resume().catch(() => undefined) : Promise.resolve();
      }
    }
    window.AudioContext = AudioQueNoCorre;
    // La voz del navegador (sin voces en Chromium sin pantalla) no se le encima al timbre: la
    // prueba la cambia por una que «dice» la frase al instante.
    window.speechSynthesis.speak = (frase: SpeechSynthesisUtterance) => {
      setTimeout(() => {
        frase.dispatchEvent(new Event('end'));
      }, 0);
    };
  });
}

/** Desde ahora el audio corre de verdad (como tras reanudarlo dentro de un gesto). */
export async function audioCorre(pagina: Page): Promise<void> {
  await pagina.evaluate(() => {
    (window as unknown as { __audioCorre?: boolean }).__audioCorre = true;
  });
}
