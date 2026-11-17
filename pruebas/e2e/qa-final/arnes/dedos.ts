import type { CDPSession, Locator, Page } from '@playwright/test';

/**
 * EL DEDO: `Input.dispatchTouchEvent` del CDP. Es lo más cerca de un dedo que se puede estar
 * desde Playwright: el evento entra por el mismo camino que el de una pantalla táctil (el motor
 * decide si es un toque, un desplazamiento, una pulsación larga o un pellizco).
 */

export interface Punto {
  readonly x: number;
  readonly y: number;
}
export type Objetivo = Locator | Punto;

type Fase = 'touchStart' | 'touchMove' | 'touchEnd';

const sesiones = new WeakMap<Page, CDPSession>();

async function cdpDe(page: Page): Promise<CDPSession> {
  const guardada = sesiones.get(page);
  if (guardada !== undefined) return guardada;
  const nueva = await page.context().newCDPSession(page);
  sesiones.set(page, nueva);
  return nueva;
}

/** El centro del blanco, en píxeles de CSS de la ventana; un localizador se trae a la vista antes. */
export async function puntoDe(objetivo: Objetivo): Promise<Punto> {
  if (!('click' in objetivo)) return objetivo;
  await objetivo.scrollIntoViewIfNeeded();
  const caja = await objetivo.boundingBox();
  if (caja === null) throw new Error('El blanco del gesto no está a la vista.');
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
}

export async function dedos(page: Page, fase: Fase, puntos: readonly Punto[]): Promise<void> {
  const cdp = await cdpDe(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: fase,
    touchPoints: fase === 'touchEnd' ? [] : puntos.map((p, id) => ({ x: p.x, y: p.y, id })),
  });
}
