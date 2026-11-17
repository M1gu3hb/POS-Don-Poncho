/**
 * EL DEDO: con un aparato táctil, todo «clic» de las pantallas del simulador se convierte en un TOQUE
 * (`tap`: eventos táctiles de verdad, como un dedo) y no en un clic de ratón. Así las pantallas que ya
 * escribió el simulador (Compras, Inventario, Recetas, Caja…) se recorren con el dedo sin reescribirlas.
 *
 * Sólo se toca `Locator.click` cuando se llama sin botón, modificadores, doble clic ni retardo (lo que
 * un dedo no puede hacer se queda como clic). Se pone UNA vez por proceso. Un aparato sin `hasTouch`
 * lanzaría en `tap`: por eso es una decisión del lanzador (`--aparato tableta-1024`), no un valor por
 * omisión.
 */
import type { Locator, Page } from '@playwright/test';

interface Opciones {
  readonly button?: unknown;
  readonly modifiers?: unknown;
  readonly clickCount?: unknown;
  readonly delay?: unknown;
  readonly force?: boolean;
  readonly noWaitAfter?: boolean;
  readonly position?: { x: number; y: number };
  readonly timeout?: number;
  readonly trial?: boolean;
}

interface PrototipoDeLocator {
  click: (this: Locator, opciones?: Opciones) => Promise<void>;
  __dedoPuesto?: boolean;
}

/** Cuántos toques dio el dedo en este proceso (el informe lo dice). */
export const CUENTA_DE_TOQUES = { toques: 0, clicsQueSeQuedaron: 0 };

export function ponerElDedo(pagina: Page): void {
  const prototipo = Object.getPrototypeOf(pagina.locator('html')) as PrototipoDeLocator;
  if (prototipo.__dedoPuesto === true) return;
  const clicDeRaton = prototipo.click;
  prototipo.click = function (this: Locator, opciones?: Opciones): Promise<void> {
    const o = opciones ?? {};
    if (
      o.button !== undefined ||
      o.modifiers !== undefined ||
      o.clickCount !== undefined ||
      o.delay !== undefined
    ) {
      CUENTA_DE_TOQUES.clicsQueSeQuedaron += 1;
      return clicDeRaton.call(this, opciones);
    }
    CUENTA_DE_TOQUES.toques += 1;
    const { force, noWaitAfter, position, timeout, trial } = o;
    return this.tap({
      ...(force === undefined ? {} : { force }),
      ...(noWaitAfter === undefined ? {} : { noWaitAfter }),
      ...(position === undefined ? {} : { position }),
      ...(timeout === undefined ? {} : { timeout }),
      ...(trial === undefined ? {} : { trial }),
    });
  };
  prototipo.__dedoPuesto = true;
}

/** El aparato pedido en la línea de comandos (`--aparato tableta-1024`), o el de la PC por omisión. */
export function aparatoPedido(): 'pc-1920' | 'tableta-1024' | 'tableta-768' {
  const i = process.argv.indexOf('--aparato');
  const v = i === -1 ? undefined : process.argv[i + 1];
  if (v === 'tableta-1024' || v === 'tableta-768') return v;
  if (v === undefined || v === 'pc-1920') return 'pc-1920';
  throw new Error(`Aparato desconocido para el día 0: ${v}.`);
}
