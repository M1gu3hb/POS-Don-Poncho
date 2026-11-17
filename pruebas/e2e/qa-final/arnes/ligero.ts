import type { Browser, BrowserContext } from '@playwright/test';

import type { Aparato } from './aparatos.ts';

/**
 * LO QUE LA APP DE ANDROID LE DICE A LA PÁGINA EN EL iMin: `<html data-ligero>` (ver
 * `apps/web/src/impresion/modo-ligero.ts`). La app de Android decide, por la RAM y el procesador del
 * aparato, si va en modo ligero y se lo pone a la página; aquí se pone en cuanto existe el `<html>` y
 * se vuelve a poner si algo lo quita, porque la app lo deja fijo mientras el aparato es «justo».
 *
 * Vive aparte de `aparatos.ts` porque corre dentro de la página (usa el DOM) y `aparatos.ts` lo lee
 * también el config de Playwright, que no tiene DOM.
 */
export async function prepararContexto(contexto: BrowserContext, aparato: Aparato): Promise<void> {
  if (!aparato.ligero) return;
  await contexto.addInitScript(() => {
    const poner = (): void => {
      // Al empezar el documento el `<html>` puede no existir todavía.
      const raiz = document.documentElement as HTMLElement | null;
      if (raiz !== null && !raiz.hasAttribute('data-ligero')) raiz.setAttribute('data-ligero', '');
    };
    poner();
    new MutationObserver(poner).observe(document, {
      childList: true,
      subtree: false,
      attributes: true,
    });
    document.addEventListener('readystatechange', poner);
  });
}

/**
 * EL CACHÉ HTTP DEL CHROMIUM VIEJO SE CUELGA tras entrar con PIN (medido en DP-20.1 y otra vez aquí:
 * el humo del iMin se quedaba esperando para siempre). Cualquier `route` apaga el caché de la
 * pestaña, y es lo que ya hace `motor-viejo.spec.ts`. Es un arreglo del arnés, no de la app: el
 * iMin de verdad no pasa por Playwright.
 */
export async function sinCacheHttp(contexto: BrowserContext): Promise<void> {
  await contexto.route('**/*', (ruta) => ruta.continue());
}

/**
 * El navegador que hay que darle a `Equipo` (o a `contextoDe`) para el iMin: cada contexto que crea
 * nace con el caché apagado, ANTES de entrar con PIN, que es cuando se cuelga. Los demás aparatos
 * reciben el navegador tal cual.
 */
export function navegadorDe(browser: Browser, aparato: Aparato): Browser {
  if (aparato.familia !== 'imin') return browser;
  return new Proxy(browser, {
    get(objetivo, propiedad) {
      if (propiedad === 'newContext') {
        return async (opciones?: Parameters<Browser['newContext']>[0]) => {
          const contexto = await objetivo.newContext(opciones);
          await sinCacheHttp(contexto);
          return contexto;
        };
      }
      const valor = Reflect.get(objetivo, propiedad) as unknown;
      return typeof valor === 'function'
        ? (valor as (...argumentos: unknown[]) => unknown).bind(objetivo)
        : valor;
    },
  });
}
