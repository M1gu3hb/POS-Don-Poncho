import { expect, test } from '@playwright/test';

import { abrirElQrDeLaMesa, prepararElPortalDelComensal } from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-14.6 · EL TELÉFONO DEL COMENSAL (teléfono, tableta y escritorio):
 *
 *   · si el carrito caducó (3 h sin enviarse) el comensal lee «Tu pedido se borró porque pasaron
 *     3 horas sin enviarse», no un carrito vacío sin explicación. La caducidad misma y la
 *     resolución del aviso se prueban contra Postgres (`carrito-fantasma.integracion.test.ts`):
 *     aquí el sondeo se contesta con el estado que el servidor da al caducar;
 *   · «Tu mesero vació el pedido» se queda fijo hasta que el comensal lo cierra
 *     (`portal-dp13.spec.ts` recorre el vaciado de punta a punta).
 */

const SLUG = 'prueba-restaurante';
const MESA = 5;

test.describe('el carrito caducado en el teléfono (DP-14.6)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('el comensal lee por qué se borró su pedido', async ({ browser }, info) => {
    test.setTimeout(5 * 60_000);
    const equipo = new Equipo(browser, SLUG);
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
    const telefono = await abrirElQrDeLaMesa(browser, info, SLUG, token);
    try {
      const sinFallos = vigilarFallos(telefono.page);
      const aviso = telefono.page.getByText(
        'Tu pedido se borró porque pasaron 3 horas sin enviarse',
      );
      await expect(aviso, 'El aviso salió sin que el carrito hubiera caducado.').toHaveCount(0);

      // El servidor, al encontrar el carrito caducado, contesta sin líneas y con `caducado`.
      await telefono.page.route('**/api/publico/qr/*/carrito', async (ruta) => {
        if (ruta.request().method() !== 'POST') return ruta.continue();
        const original = await ruta.fetch();
        const cuerpo = (await original.json()) as { datos?: Record<string, unknown> | null };
        if (cuerpo.datos) cuerpo.datos = { ...cuerpo.datos, lineas: [], caducado: true };
        return ruta.fulfill({ response: original, json: cuerpo });
      });
      await telefono.page.reload();
      await expect(aviso).toBeVisible({ timeout: 20_000 });
      sinFallos();
    } finally {
      await telefono.cerrar();
      await equipo.cerrar();
    }
  });
});
