import type { Page } from '@playwright/test';

/**
 * ESPERAR A QUE LA PÁGINA SE AQUIETE, no a que pase un tiempo.
 *
 * Lo que sigue a un gesto (un desplazamiento con inercia, el campo que se lleva al centro, el
 * `visualViewport` que cambia con el teclado) no tiene un evento que diga «terminé». La condición
 * es la ausencia de eventos: se espera a que `scroll` y `resize` callen durante `silencioMs`, con un
 * tope para no colgarse. El temporizador vive en la página: mide el silencio del propio navegador.
 */
export const SILENCIO_MS = 250;
export const TOPE_MS = 4_000;

export async function esperarQuietud(
  page: Page,
  silencioMs: number = SILENCIO_MS,
  topeMs: number = TOPE_MS,
): Promise<void> {
  await page.evaluate(
    ({ silencio, tope }) =>
      new Promise<void>((listo) => {
        let reloj = 0;
        const fin = (): void => {
          window.clearTimeout(reloj);
          window.clearTimeout(limite);
          document.removeEventListener('scroll', reiniciar, true);
          window.removeEventListener('resize', reiniciar);
          window.visualViewport?.removeEventListener('resize', reiniciar);
          window.visualViewport?.removeEventListener('scroll', reiniciar);
          listo();
        };
        const reiniciar = (): void => {
          window.clearTimeout(reloj);
          reloj = window.setTimeout(fin, silencio);
        };
        const limite = window.setTimeout(fin, tope);
        document.addEventListener('scroll', reiniciar, true);
        window.addEventListener('resize', reiniciar);
        window.visualViewport?.addEventListener('resize', reiniciar);
        window.visualViewport?.addEventListener('scroll', reiniciar);
        reiniciar();
      }),
    { silencio: silencioMs, tope: topeMs },
  );
}

/** Dos cuadros de animación: lo que pinta el navegador entre un paso del dedo y el siguiente. */
export function dosCuadros(page: Page): Promise<void> {
  return page.evaluate(
    () =>
      new Promise<void>((listo) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            listo();
          });
        });
      }),
  );
}
