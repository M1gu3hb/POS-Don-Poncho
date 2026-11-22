import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import {
  abrirElQrDeLaMesa,
  abrirLaMesa,
  CARTA,
  dialogoDeLaMesa,
  escapar,
  prepararElPortalDelComensal,
  yaAbierto,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import { cabecerasDeEscrituraDePrueba, exigirDemostracion } from './ayudantes/sesion.ts';
import { arrastrarYSoltar, centro } from './qa-final/toque-seguro/gestos.ts';

/**
 * DP-25 · PARTE 5 · LA BOLITA DE «AGREGADO AL PEDIDO», CON EL DEDO.
 *
 * Cada toque que agrega un platillo lanza una bolita que vuela de la ficha al pedido (el botón
 * flotante del teléfono, el panel de la tableta) y el número rebota. Se mide lo que importa:
 *  · tres toques seguidos son TRES bolitas y TRES platillos en el pedido (los platillos se cuentan
 *    en el pedido, no en las bolitas);
 *  · deslizar la rejilla no lanza ninguna y no agrega nada;
 *  · con `prefers-reduced-motion` no hay bolita y sólo rebota el número;
 *  · sin la API de animación (el motor viejo) la bolita sigue volando, con cuadros de animación, y
 *    se retira al aterrizar.
 */

const SLUG = 'prueba-restaurante';
const MESA = 5;
const FICHAS = [CARTA.guacamole.nombre, CARTA.sopa.nombre, CARTA.limonada.nombre] as const;

declare global {
  interface Window {
    __bolitas: number;
    __rebotes: number;
  }
}

/** Anota cuántas bolitas se crean y cuántas veces rebota un destino (sin cambiar nada de la página). */
async function vigilar(page: Page, sinWaapi = false): Promise<void> {
  await page.evaluate((sin) => {
    window.__bolitas = 0;
    window.__rebotes = 0;
    new MutationObserver((cambios) => {
      for (const cambio of cambios) {
        for (const nodo of cambio.addedNodes) {
          if (nodo instanceof HTMLElement && nodo.hasAttribute('data-bolita'))
            window.__bolitas += 1;
        }
      }
    }).observe(document.body, { childList: true });
    const original: (this: Element, ...args: Parameters<Element['animate']>) => Animation =
      Reflect.get(Element.prototype, 'animate');
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      if (!this.hasAttribute('data-bolita') && this.closest('[data-destino-bolita]') !== null) {
        window.__rebotes += 1;
      }
      return original.call(this, ...args);
    };
    if (sin) (Element.prototype as { animate?: unknown }).animate = undefined;
  }, sinWaapi);
}

const bolitas = (page: Page): Promise<number> => page.evaluate(() => window.__bolitas);
const rebotes = (page: Page): Promise<number> => page.evaluate(() => window.__rebotes);

/** Las piezas del pedido en armado: el panel de la tableta o el número del botón flotante del teléfono. */
function piezas(page: Page): Promise<number> {
  return page.evaluate(() => {
    const visible = (el: Element): boolean => (el as HTMLElement).offsetParent !== null;
    const delPanel = [...document.querySelectorAll('button[aria-label^="Agregar uno de "]')]
      .filter(visible)
      .reduce(
        (suma, mas) => suma + (parseInt(mas.previousElementSibling?.textContent ?? '0', 10) || 0),
        0,
      );
    const delBoton = [...document.querySelectorAll('[data-bolita-numero]')]
      .filter(visible)
      .reduce((suma, n) => suma + (parseInt(n.textContent ?? '0', 10) || 0), 0);
    return Math.max(delPanel, delBoton);
  });
}

function ficha(mesa: Locator, nombre: string): Locator {
  return mesa.getByRole('button', { name: new RegExp(`^${escapar(nombre)} \\$`) });
}

async function prepararLaMesa(
  info: TestInfo,
  equipo: Equipo,
): Promise<{ page: Page; mesa: Locator }> {
  const duena = await equipo.pagina(info, 'dueno');
  const reseteo = await duena.request.post('/api/pruebas/resetear', {
    headers: cabecerasDeEscrituraDePrueba(),
    data: { confirmacion: 'RESETEAR' },
  });
  expect(reseteo.status(), `resetear: ${await reseteo.text()}`).toBe(200);
  const page = await equipo.pagina(info, 'mesero');
  await page.goto('/mesero');
  await abrirLaMesa(page, duena, MESA, 2);
  const mesa = dialogoDeLaMesa(page, MESA);
  await yaAbierto(mesa);
  for (const nombre of FICHAS) await expect(ficha(mesa, nombre)).toBeVisible();
  return { page, mesa };
}

test.describe('la bolita de «agregado al pedido» (DP-25 · P5)', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000, hasTouch: true });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('tres toques seguidos son tres bolitas y tres platillos; deslizar no lanza ninguna', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const { page, mesa } = await prepararLaMesa(info, equipo);
      await vigilar(page);
      const antes = await piezas(page);

      await test.step('deslizar la rejilla sobre un platillo', async () => {
        const rejilla = mesa.locator('[data-rejilla-de-platillos]').first();
        await expect(rejilla).toBeVisible();
        await arrastrarYSoltar(page, 'dedo', await centro(ficha(mesa, FICHAS[0])), -120);
        await page.waitForTimeout(700);
        expect(await bolitas(page), 'deslizar lanzó una bolita.').toBe(0);
        expect(await piezas(page), 'deslizar agregó un platillo.').toBe(antes);
      });

      await test.step('tres toques seguidos en tres platillos', async () => {
        for (const nombre of FICHAS) await ficha(mesa, nombre).tap();
        await expect.poll(() => piezas(page), { timeout: 15_000 }).toBe(antes + 3);
        await expect.poll(() => bolitas(page), { timeout: 5_000 }).toBe(3);
        await expect.poll(() => rebotes(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(3);
        // Las bolitas se retiran al aterrizar: no queda basura en la página.
        await expect.poll(() => page.locator('[data-bolita]').count(), { timeout: 5_000 }).toBe(0);
      });
    } finally {
      await equipo.cerrar();
    }
  });

  test.describe('con movimiento reducido', () => {
    test.use({ reducedMotion: 'reduce' });

    test('no hay bolita y el número rebota', async ({ browser }, info) => {
      test.setTimeout(6 * 60_000);
      const equipo = new Equipo(browser, SLUG);
      try {
        const { page, mesa } = await prepararLaMesa(info, equipo);
        await vigilar(page);
        const antes = await piezas(page);
        await ficha(mesa, FICHAS[0]).tap();
        await expect.poll(() => piezas(page), { timeout: 15_000 }).toBe(antes + 1);
        await expect.poll(() => rebotes(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
        await page.waitForTimeout(600);
        expect(await bolitas(page), 'con movimiento reducido salió una bolita.').toBe(0);
      } finally {
        await equipo.cerrar();
      }
    });
  });

  test('sin la API de animación la bolita sigue volando con cuadros de animación', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const { page, mesa } = await prepararLaMesa(info, equipo);
      await vigilar(page, true);
      const antes = await piezas(page);
      await ficha(mesa, FICHAS[0]).tap();
      await expect.poll(() => piezas(page), { timeout: 15_000 }).toBe(antes + 1);
      await expect.poll(() => bolitas(page), { timeout: 5_000 }).toBe(1);
      await expect.poll(() => page.locator('[data-bolita]').count(), { timeout: 5_000 }).toBe(0);
    } finally {
      await equipo.cerrar();
    }
  });

  test('en el portal del comensal, «Agregar» lanza una bolita al carrito y el platillo queda en el pedido', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear: ${await reseteo.text()}`).toBe(200);
      const token = await prepararElPortalDelComensal(duena, {
        mesa: 4,
        zona: 'Interior',
        mesero: null,
        pedidosDelComensal: true,
      });
      const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, token);
      try {
        const { page } = comensal;
        await vigilar(page);
        const tarjeta = page
          .locator('button.menu-tarjeta')
          .filter({ has: page.getByText(CARTA.cerveza.nombre, { exact: true }) });
        await tarjeta.tap();
        await page.getByRole('button', { name: /^Agregar/ }).tap();
        await expect(
          page.getByText(`${CARTA.cerveza.nombre} agregado al pedido de la mesa`),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: /^Pedido de la mesa \(1\)/ })).toBeVisible();
        await expect.poll(() => bolitas(page), { timeout: 5_000 }).toBe(1);
        await expect.poll(() => rebotes(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
      } finally {
        await comensal.cerrar();
      }
    } finally {
      await equipo.cerrar();
    }
  });
});
