import { dedos, type Punto } from '../arnes/dedos.ts';
import { dosCuadros } from '../arnes/quietud.ts';

import type { CDPSession, Locator, Page } from '@playwright/test';

/**
 * DP-23 · LOS GESTOS DEL TOQUE SEGURO, a bajo nivel (CDP), y lo que se mide después de cada uno.
 *
 * Dos caminos de entrada, porque los POS de Don Poncho tienen los dos:
 *  · el DEDO de verdad (`Input.dispatchTouchEvent`): lo que hace una tableta o un teléfono;
 *  · el RATÓN QUE LLEGA DE UN DEDO (`Input.dispatchMouseEvent`): lo que hace una pantalla táctil de
 *    Windows (o un WebView viejo) cuando promueve el dedo a ratón. Ahí bajar, arrastrar dentro de la
 *    misma tarjeta y soltar SÍ produce un clic en Chromium: es la sospecha principal de la falla.
 */

export type Entrada = 'dedo' | 'raton-del-dedo';

const sesiones = new WeakMap<Page, CDPSession>();
async function cdp(page: Page): Promise<CDPSession> {
  const guardada = sesiones.get(page);
  if (guardada !== undefined) return guardada;
  const nueva = await page.context().newCDPSession(page);
  sesiones.set(page, nueva);
  return nueva;
}

async function raton(
  page: Page,
  type: 'mousePressed' | 'mouseMoved' | 'mouseReleased',
  p: Punto,
): Promise<void> {
  await (
    await cdp(page)
  ).send('Input.dispatchMouseEvent', {
    type,
    x: p.x,
    y: p.y,
    button: type === 'mouseMoved' ? 'none' : 'left',
    buttons: type === 'mouseReleased' ? 0 : 1,
    clickCount: type === 'mouseMoved' ? 0 : 1,
    pointerType: 'mouse',
  });
}

export async function bajar(page: Page, entrada: Entrada, p: Punto): Promise<void> {
  if (entrada === 'dedo') await dedos(page, 'touchStart', [p]);
  else {
    await raton(page, 'mouseMoved', p);
    await raton(page, 'mousePressed', p);
  }
}

export async function mover(page: Page, entrada: Entrada, p: Punto): Promise<void> {
  if (entrada === 'dedo') await dedos(page, 'touchMove', [p]);
  else await raton(page, 'mouseMoved', { x: p.x, y: p.y });
}

export async function soltar(page: Page, entrada: Entrada, p: Punto): Promise<void> {
  if (entrada === 'dedo') await dedos(page, 'touchEnd', []);
  else await raton(page, 'mouseReleased', p);
}

export async function centro(l: Locator): Promise<Punto> {
  await l.scrollIntoViewIfNeeded();
  const caja = await l.boundingBox();
  if (caja === null) throw new Error('El blanco no tiene caja.');
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
}

export async function tocar(page: Page, entrada: Entrada, p: Punto): Promise<void> {
  await bajar(page, entrada, p);
  await dosCuadros(page);
  await soltar(page, entrada, p);
  await dosCuadros(page);
}

/** Baja sobre `p`, arrastra `dy` píxeles en 10 pasos y suelta (sin levantar antes). */
export async function arrastrarYSoltar(
  page: Page,
  entrada: Entrada,
  p: Punto,
  dy: number,
): Promise<void> {
  await bajar(page, entrada, p);
  await dosCuadros(page);
  let ultimo = p;
  for (let paso = 1; paso <= 10; paso += 1) {
    ultimo = { x: p.x, y: p.y + (dy * paso) / 10 };
    await mover(page, entrada, ultimo);
    await dosCuadros(page);
  }
  await soltar(page, entrada, ultimo);
  await dosCuadros(page);
}

export async function mantener(page: Page, entrada: Entrada, p: Punto, ms: number): Promise<void> {
  await bajar(page, entrada, p);
  await page.waitForTimeout(ms);
  await soltar(page, entrada, p);
  await dosCuadros(page);
}

/** Lo que cuenta el pedido en armado y lo que se abrió sin que nadie lo pidiera. */
export interface Estado {
  readonly unidades: number;
  readonly dialogosDeMas: number;
}

/** Las unidades del pedido en armado (los «Agregar uno de …» visibles) y los diálogos de más. */
export function leerEstado(page: Page): Promise<Estado> {
  return page.evaluate(() => {
    const visibles = (el: Element): boolean => (el as HTMLElement).offsetParent !== null;
    const unidades = [...document.querySelectorAll('button[aria-label^="Agregar uno de "]')]
      .filter(visibles)
      .reduce(
        (suma, mas) => suma + (parseInt(mas.previousElementSibling?.textContent ?? '0', 10) || 0),
        0,
      );
    const dialogos = [...document.querySelectorAll('[role="dialog"]')].filter(visibles).length;
    return { unidades, dialogosDeMas: Math.max(0, dialogos - 1) };
  });
}
