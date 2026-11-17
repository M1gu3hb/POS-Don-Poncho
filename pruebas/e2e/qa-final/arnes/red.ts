import type { BrowserContext, CDPSession, Page, Route } from '@playwright/test';

/**
 * LA RED DEL RESTAURANTE (DP-22): lo que pasa cuando el WiFi del local se cae, tarda o se va a media
 * operación.
 *
 *  · `conRedCortada` — `context.setOffline(true)` durante 5 a 30 s (la espera ES el corte) y la red
 *    vuelve aunque la operación falle;
 *  · `conLatencia` — 800 ms de ida y vuelta en cada petición (CDP `Network.emulateNetworkConditions`);
 *  · `recargarAMediaOperacion` — la página se recarga justo después de que la operación mandó algo.
 *
 * Lo que NO emula: una red que pierde paquetes a medias ni un `WebSocket` que se cae sin cerrar
 * (Playwright corta todo). `setOffline` y la latencia usan el mismo mando del CDP: si se combinan,
 * la última orden gana. Para ambas a la vez, `conLatencia` y el corte se piden por separado y en ese orden.
 */

export const CORTE_MINIMO_S = 5;
export const CORTE_MAXIMO_S = 30;
export const LATENCIA_POR_OMISION_MS = 800;

export async function conRedCortada<T>(
  contexto: BrowserContext,
  segundos: number,
  durante: () => Promise<T>,
): Promise<T> {
  if (segundos < CORTE_MINIMO_S || segundos > CORTE_MAXIMO_S) {
    throw new Error(
      `El corte de red va de ${String(CORTE_MINIMO_S)} a ${String(CORTE_MAXIMO_S)} s, no ${String(segundos)}.`,
    );
  }
  const inicio = Date.now();
  await contexto.setOffline(true);
  try {
    const resultado = await durante();
    // El corte dura lo que se pidió, haya tardado o no la operación en intentar y fallar.
    const falta = segundos * 1000 - (Date.now() - inicio);
    if (falta > 0) await new Promise<void>((listo) => setTimeout(listo, falta));
    return resultado;
  } finally {
    await contexto.setOffline(false);
  }
}

const sesiones = new WeakMap<Page, CDPSession>();

async function mando(page: Page): Promise<CDPSession> {
  const guardada = sesiones.get(page);
  if (guardada !== undefined) return guardada;
  const nueva = await page.context().newCDPSession(page);
  await nueva.send('Network.enable');
  sesiones.set(page, nueva);
  return nueva;
}

export type ViaDeLaLatencia = 'ruta' | 'cdp';

/**
 * Aplica la latencia a esta pestaña. Devuelve cómo quitarla.
 *
 *  · 'ruta' (por omisión) — cada petición espera `latenciaMs` antes de salir (`page.route`): sirve
 *    igual en los tres motores. Apaga el caché HTTP de la pestaña (como cualquier `route`) y no
 *    retrasa WebSocket ni EventSource.
 *  · 'cdp' — `Network.emulateNetworkConditions` con latencia: más fiel, pero en el Chromium 99 la
 *    petición se queda colgada (medido en el arnés, DP-22), así que no es el valor por omisión.
 */
export async function conLatencia(
  page: Page,
  latenciaMs: number = LATENCIA_POR_OMISION_MS,
  via: ViaDeLaLatencia = 'ruta',
): Promise<() => Promise<void>> {
  if (via === 'cdp') {
    const cdp = await mando(page);
    const fijar = async (ms: number): Promise<void> => {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: ms,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
    };
    await fijar(latenciaMs);
    return () => fijar(0);
  }
  const demorar = async (ruta: Route): Promise<void> => {
    await new Promise<void>((listo) => setTimeout(listo, latenciaMs));
    try {
      await ruta.continue();
    } catch (error: unknown) {
      // Una pestaña que se cerró o recargó mientras la petición esperaba no es un fallo del arnés.
      if (!/closed|detached|aborted|already handled/i.test(String(error))) throw error;
    }
  };
  await page.route('**/*', demorar);
  return () => page.unroute('**/*', demorar);
}

/**
 * Hace la operación y, en cuanto sale la petición, recarga la página: el corte de luz del router, el
 * mesero que cierra la pestaña, el WebView que se reinicia. Devuelve las peticiones que habían
 * salido de la app y no habían terminado cuando se recargó.
 */
export async function recargarAMediaOperacion(
  page: Page,
  operacion: () => Promise<unknown>,
  esLaPeticion: (url: string, metodo: string) => boolean,
): Promise<string[]> {
  const enVuelo = new Set<string>();
  const alSalir = (peticion: { url(): string; method(): string }): void => {
    if (esLaPeticion(peticion.url(), peticion.method())) {
      enVuelo.add(`${peticion.method()} ${peticion.url()}`);
    }
  };
  const alTerminar = (peticion: { url(): string; method(): string }): void => {
    enVuelo.delete(`${peticion.method()} ${peticion.url()}`);
  };
  page.on('request', alSalir);
  page.on('requestfinished', alTerminar);
  page.on('requestfailed', alTerminar);
  try {
    const salio = page.waitForRequest((p) => esLaPeticion(p.url(), p.method()));
    const hecha = operacion();
    await salio;
    const sinTerminar = [...enVuelo];
    await page.reload({ waitUntil: 'domcontentloaded' });
    await hecha.catch((error: unknown) => {
      // Una operación cortada por la recarga puede fallar: lo que importa es lo que quedó en el servidor.
      process.stderr.write(
        `[qa-final] la operación cortada por la recarga terminó con: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    });
    return sinTerminar;
  } finally {
    page.off('request', alSalir);
    page.off('requestfinished', alTerminar);
    page.off('requestfailed', alTerminar);
  }
}
