import { expect, type Page, test } from '@playwright/test';

import { cancelarLaCuenta } from './ayudantes/cancelar-desde-la-mesa.ts';
import {
  abrirLaMesa,
  alMapa,
  exigirEstadoDeLaMesa,
  prepararElPortalDelComensal,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-14.6 · LO QUE EL MESERO VE EN LA SALA:
 *
 *   · un código que no es de una mesa NO cierra el escáner (dice que no es una mesa y sigue);
 *   · sin cámara, la lista de mesas dice la zona y el estado de cada una;
 *   · una mesa abierta SIN renglones se cancela desde su diálogo (antes el botón no salía);
 *   · «Nueva mesa» en Configuración siempre trae una zona elegida.
 */

const SLUG = 'prueba-restaurante';
const MESA = 4;
const CODIGO_DE_UN_PRODUCTO = '7501055300075';

test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

/** Cámara simulada que SIEMPRE lee el código de barras de un producto, no el QR de una mesa. */
async function lectorQueLeeUnProducto(pagina: Page): Promise<void> {
  await pagina.context().addInitScript((codigo) => {
    const ventana = window as unknown as { __negarCamara?: boolean };
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (pedido) => {
      if (ventana.__negarCamara === true) {
        throw new DOMException('El permiso de la cámara se negó.', 'NotAllowedError');
      }
      return original(pedido);
    };
    class DetectorFalso {
      async detect(): Promise<{ rawValue: string }[]> {
        return [{ rawValue: codigo }];
      }
    }
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = DetectorFalso;
  }, CODIGO_DE_UN_PRODUCTO);
}

test.describe('la sala del mesero (DP-14.6)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('un código que no es de mesa no cierra el escáner; sin cámara la lista dice zona y estado', async ({
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
      await prepararElPortalDelComensal(duena, {
        mesa: MESA,
        zona: 'Interior',
        mesero: null,
        pedidosDelComensal: true,
        envian: 'mesero',
      });

      const mesero = await equipo.pagina(info, 'mesero');
      await mesero.context().grantPermissions(['camera']);
      const sinFallos = vigilarFallos(mesero);
      await lectorQueLeeUnProducto(mesero);
      await mesero.goto('/mesero');

      await test.step('el código de un producto: avisa y el escáner sigue abierto', async () => {
        await mesero.getByRole('button', { name: 'Escanear QR' }).click();
        await expect(mesero.getByText('Ese código no es el QR de una mesa.').first()).toBeVisible({
          timeout: 20_000,
        });
        await expect(
          mesero.getByRole('button', { name: 'Cerrar el escáner' }),
          'El escáner se cerró con un código que no es de una mesa.',
        ).toBeVisible();
        // El aviso (toast) se repite mientras la cámara siga viendo el código y tapa el botón.
        await mesero.getByRole('button', { name: 'Cerrar el escáner' }).dispatchEvent('click');
      });

      await test.step('sin permiso de cámara, cada mesa de la lista dice su zona y su estado', async () => {
        await mesero.evaluate(() => {
          (window as unknown as { __negarCamara: boolean }).__negarCamara = true;
        });
        await mesero.getByRole('button', { name: 'Escanear QR' }).click();
        const laCuatro = mesero.locator('[data-mesa-para-elegir]').filter({ hasText: /^Mesa 4/ });
        await expect(laCuatro).toBeVisible();
        await expect(laCuatro).toContainText('Interior · Libre');
      });
      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });

  test('una mesa abierta sin renglones se cancela desde su diálogo; «Nueva mesa» trae zona', async ({
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

      const lupita = await equipo.pagina(info, 'mesero');
      const sinFallos = vigilarFallos(lupita);
      await lupita.goto('/mesero');
      await abrirLaMesa(lupita, duena, MESA, 2);
      await cancelarLaCuenta(lupita, info, MESA, 'Se abrió por error', false);
      await alMapa(lupita);
      await exigirEstadoDeLaMesa(duena, MESA, 'libre', 'La mesa vacía cancelada no quedó libre.');
      sinFallos();

      await duena.goto('/configuracion');
      await duena.getByRole('tab', { name: 'Mesas' }).click();
      await duena
        .getByRole('button', { name: /Nueva mesa|Agregar mesa/ })
        .first()
        .click();
      const zona = duena
        .getByRole('dialog')
        .getByText('Zona')
        .locator('xpath=..')
        .getByRole('combobox');
      await expect(zona).toBeVisible();
      await expect(zona, 'La zona de «Nueva mesa» quedó en blanco.').not.toHaveText('');
    } finally {
      await equipo.cerrar();
    }
  });
});
