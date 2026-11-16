import { expect, type Page, test } from '@playwright/test';

import { prepararElPortalDelComensal } from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import { cabecerasDeEscrituraDePrueba, exigirDemostracion } from './ayudantes/sesion.ts';

/**
 * DP-21 · NADA DE APP INSTALABLE.
 *
 * El personal usa las apps de Morphiq (.exe y .apk) y los comensales, sólo el navegador. Chrome
 * ofrece «Instalar» cuando la página enlaza un manifiesto, así que el `<head>` de la entrada del
 * personal y el del portal del comensal no pueden traer `link[rel=manifest]`; el manifiesto no
 * existe en el servidor y ningún service worker queda registrado.
 */

const SLUG = 'prueba-restaurante';
const MESA = 7;

async function exigirSinManifiesto(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveCount(0);
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveCount(0);
  const registros = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 0;
    return (await navigator.serviceWorker.getRegistrations()).length;
  });
  expect(registros, `${ruta}: hay un service worker registrado`).toBe(0);
}

test.describe('el sitio no se instala', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('ni la entrada del personal ni el portal del comensal ofrecen «Instalar»', async ({
    browser,
  }, info) => {
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear_demo: ${await reseteo.text()}`).toBe(200);
      const token = await prepararElPortalDelComensal(duena, {
        mesa: MESA,
        zona: 'Interior',
        mesero: null,
        pedidosDelComensal: true,
        envian: 'mesero',
      });

      // Sin sesión: lo que ve alguien que sólo tiene la liga.
      const contexto = await browser.newContext({
        ...(info.project.use.baseURL === undefined ? {} : { baseURL: info.project.use.baseURL }),
      });
      try {
        const page = await contexto.newPage();
        await exigirSinManifiesto(page, '/login-pos');
        await exigirSinManifiesto(page, `/n/${SLUG}/login-pos`);
        await exigirSinManifiesto(page, `/qr/${token}`);
        for (const ruta of ['/manifest.webmanifest', '/manifest.json', '/sw.js']) {
          const r = await page.request.get(ruta);
          // Puede ser un 404 o la pantalla de acceso (una redirección): lo que no puede ser es el
          // manifiesto ni un script.
          expect(r.headers()['content-type'] ?? '', `${ruta} no debe existir`).not.toMatch(
            /manifest\+json|application\/json|javascript/,
          );
        }
      } finally {
        await contexto.close();
      }
    } finally {
      await equipo.cerrar();
    }
  });
});
