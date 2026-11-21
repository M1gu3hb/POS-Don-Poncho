import type { Browser, Locator, Page, TestInfo } from '@playwright/test';

import { yaAbierto } from './mesas-heredadas.ts';
import { conElPinTecleado, opcionesDelProyecto } from './roles.ts';

/**
 * DP-24 · LA CAJA EN UNA PANTALLA TÁCTIL, y su tarjeta de cobro: lo que comparten las pruebas que
 * cobran con el dedo (`tap`, nunca el ratón) en los tamaños de las cajas de Don Poncho.
 */

export interface Tamano {
  readonly nombre: string;
  readonly width: number;
  readonly height: number;
}
export const CHICA: Tamano = { nombre: '800x600', width: 800, height: 600 };
export const MEDIANA: Tamano = { nombre: '1024x768', width: 1024, height: 768 };
export const ANCHA: Tamano = { nombre: '1280x800', width: 1280, height: 800 };

/** La caja de Rosa en una pantalla táctil de ese tamaño: su misma sesión, otro navegador. */
export async function cajaTactil(
  browser: Browser,
  info: TestInfo,
  rosa: Page,
  tamano: Tamano,
): Promise<Page> {
  const contexto = await conElPinTecleado(
    await browser.newContext({
      ...opcionesDelProyecto(info),
      viewport: { width: tamano.width, height: tamano.height },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: true,
      storageState: await rosa.context().storageState(),
    }),
  );
  const pagina = await contexto.newPage();
  await pagina.goto('/caja');
  await pagina.waitForURL(/\/caja$/);
  return pagina;
}

/** Abre con el dedo la cuenta de la mesa y espera su tarjeta de cobro. */
export async function abrirLaTarjeta(caja: Page, mesa: number): Promise<Locator> {
  await caja.getByRole('tab', { name: /^Pendientes/ }).tap();
  await caja.getByRole('button', { name: new RegExp(`^Mesa ${String(mesa)} Cuenta`) }).tap();
  const tarjeta = caja.getByRole('dialog').filter({ hasText: `Cobrar — Mesa ${String(mesa)}` });
  await yaAbierto(tarjeta);
  return tarjeta;
}

/** Toca «Cobrar $…» y devuelve lo que contestó el servidor. */
export async function cobrarConElDedo(
  caja: Page,
  tarjeta: Locator,
): Promise<{ readonly ok: boolean }> {
  const respuesta = caja.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/venta/cobrar' && r.request().method() === 'POST',
  );
  await tarjeta.getByRole('button', { name: /^Cobrar \$/ }).tap();
  return (await (await respuesta).json()) as { readonly ok: boolean };
}

export const totalACobrar = (tarjeta: Locator): Locator => tarjeta.locator('[data-total-a-cobrar]');
export const cambio = (tarjeta: Locator): Locator => tarjeta.locator('[data-cambio]');
