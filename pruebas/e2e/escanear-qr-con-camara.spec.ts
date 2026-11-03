import { expect, type Page, test } from '@playwright/test';

import { prepararElPortalDelComensal } from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';
import { mantenerPresionada } from './ayudantes/tacto.ts';

/**
 * DP-13.2 · «ESCANEAR QR» CON CÁMARA DE VERDAD (simulada por Chromium), Y SIN ELLA.
 *
 * Con `camera=()` en todo el sitio el navegador negaba la cámara sin preguntar: aquí la cámara
 * simulada (`--use-fake-device-for-media-stream`) tiene que ENCENDERSE en el mesero, y apagarse al
 * cerrar el escáner, también si se cierra mientras arranca. Con el permiso negado, el respaldo es
 * la lista de mesas, no un campo numérico. Y el globo de la mesa entra al pedido sin escanear.
 */

const SLUG = 'prueba-restaurante';
const MESA = 4;

test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

/** Registra cada cámara que la página enciende; con `__negarCamara`, el navegador la niega. */
async function espiarLaCamara(pagina: Page): Promise<void> {
  await pagina.context().addInitScript(() => {
    const camaras: MediaStream[] = [];
    const ventana = window as unknown as {
      __camaras: MediaStream[];
      __retrasoCamara?: number;
      __negarCamara?: boolean;
    };
    ventana.__camaras = camaras;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (pedido) => {
      if (ventana.__negarCamara === true) {
        throw new DOMException('El permiso de la cámara se negó.', 'NotAllowedError');
      }
      const flujo = await original(pedido);
      camaras.push(flujo);
      const retraso = ventana.__retrasoCamara ?? 0;
      if (retraso > 0) await new Promise((listo) => setTimeout(listo, retraso));
      return flujo;
    };
  });
}

/** Cuántas cámaras encendidas siguen vivas. */
const vivas = (pagina: Page): Promise<number> =>
  pagina.evaluate(
    () =>
      (window as unknown as { __camaras: MediaStream[] }).__camaras
        .flatMap((f) => f.getTracks())
        .filter((t) => t.readyState === 'live').length,
  );
const encendidas = (pagina: Page): Promise<number> =>
  pagina.evaluate(() => (window as unknown as { __camaras: MediaStream[] }).__camaras.length);

test.describe('escanear el QR con cámara (DP-13.2)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la cámara enciende en el mesero y se apaga al cerrar; sin permiso, la lista de mesas; el globo entra al pedido', async ({
    browser,
  }, info) => {
    test.setTimeout(5 * 60_000);
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

      await test.step('la cabecera: cámara en el mesero, ninguna en el portal del comensal', async () => {
        const delMesero = await duena.request.get('/mesero', { maxRedirects: 0 });
        expect(delMesero.headers()['permissions-policy']).toContain('camera=(self)');
        const delPortal = await duena.request.get(`/qr/${token}`, { maxRedirects: 0 });
        expect(delPortal.headers()['permissions-policy']).toContain('camera=()');
      });

      const mesero = await equipo.pagina(info, 'mesero');
      await mesero.context().grantPermissions(['camera']);
      const sinFallos = vigilarFallos(mesero);
      await espiarLaCamara(mesero);
      const escanear = mesero.getByRole('button', { name: 'Escanear QR' });
      const cerrar = mesero.getByRole('button', { name: 'Cerrar el escáner' });

      await test.step('entrando SIN recargar (la caja la manda a sus mesas), «Escanear QR» recarga una vez y enciende', async () => {
        await mesero.goto('/caja');
        await mesero.waitForURL(/\/mesero$/);
        const cargadoEn = await mesero.evaluate(
          () => performance.getEntriesByType('navigation')[0]?.name ?? '',
        );
        expect(cargadoEn, 'El documento ya es del mesero: la prueba no cruzó pantallas.').toMatch(
          /\/caja$/,
        );
        await escanear.click();
        await expect
          .poll(() => vivas(mesero), { message: 'La cámara no encendió al recargar.' })
          .toBe(1);
        await expect(mesero, 'La marca de escanear se quedó en la dirección.').toHaveURL(
          /\/mesero$/,
        );
        await cerrar.click();
        await expect.poll(() => vivas(mesero)).toBe(0);
      });

      await mesero.goto('/mesero');

      await test.step('«Escanear QR» enciende la cámara y cerrar el escáner la apaga', async () => {
        await escanear.click();
        await expect.poll(() => vivas(mesero), { message: 'La cámara no encendió.' }).toBe(1);
        await cerrar.click();
        await expect.poll(() => vivas(mesero), { message: 'La cámara quedó prendida.' }).toBe(0);
      });

      await test.step('cerrado MIENTRAS arranca, la cámara que llega tarde se apaga', async () => {
        const antes = await encendidas(mesero);
        await mesero.evaluate(() => {
          (window as unknown as { __retrasoCamara: number }).__retrasoCamara = 1200;
        });
        await escanear.click();
        await expect.poll(() => encendidas(mesero)).toBe(antes + 1);
        await cerrar.click();
        // El flujo llega después del cierre: tiene que apagarse solo.
        await expect
          .poll(() => vivas(mesero), { message: 'La cámara que llegó tarde quedó prendida.' })
          .toBe(0);
        await mesero.evaluate(() => {
          (window as unknown as { __retrasoCamara: number }).__retrasoCamara = 0;
        });
      });

      await test.step('con el permiso negado, se elige la mesa de una lista y se entra a su pedido', async () => {
        await mesero.evaluate(() => {
          (window as unknown as { __negarCamara: boolean }).__negarCamara = true;
        });
        await escanear.click();
        await expect(
          mesero.getByText('Permiso de cámara denegado', { exact: false }),
        ).toBeVisible();
        await expect(mesero.getByText('Código de barras')).toHaveCount(0);
        await mesero.getByRole('button', { name: `Mesa ${String(MESA)}`, exact: true }).click();
        const portal = mesero.getByRole('dialog', { name: 'Portal de la mesa · modo mesero' });
        await expect(portal).toBeVisible();
        await portal.press('Escape');
        await expect(portal).toBeHidden();
      });

      await test.step('mantener presionada la mesa: «Pedido del portal» entra sin escanear', async () => {
        // El número va PRIMERO en la mesa del mapa («4 · Libre · 6»): «4» a secas también es la
        // capacidad de otras mesas.
        const laMesa = mesero
          .locator('[data-mesa-id]')
          .filter({ hasText: new RegExp(`^\\s*${String(MESA)}(?!\\d)`) })
          .first();
        await mantenerPresionada(mesero, info, laMesa);
        const globo = mesero.getByRole('menu', { name: `Mesa ${String(MESA)}` });
        await globo.getByRole('menuitem', { name: 'Pedido del portal' }).click();
        await expect(
          mesero.getByRole('dialog', { name: 'Portal de la mesa · modo mesero' }),
        ).toBeVisible();
      });
      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });
});
