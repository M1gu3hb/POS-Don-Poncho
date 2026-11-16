import { expect, test } from '@playwright/test';

import {
  abrirLaMesa,
  CARTA,
  comandar,
  dialogoDeLaMesa,
  mesaEnElServidor,
  type PlatilloPedido,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-21 · Bloque 10 · CAMBIAR DE MESA, DE VERDAD (M24).
 *
 * Lo que vio Miguel: «Cambiar de mesa» sacaba al mesero del mapa a otra pantalla. Ahora, en el
 * panel de la mesa, «Cambiar de mesa» abre ahí mismo las mesas libres de la zona en botones
 * grandes; al tocar una pregunta «¿Pasar la cuenta de la mesa 3 a la mesa 5?», y al pasar avisa
 * «La cuenta pasó a la mesa 5». Todo sin salir de `/mesero`. Corre en serie (`--workers=1`):
 * resetea la demo.
 */

const SLUG = 'prueba-restaurante';
const ORIGEN = 3;
const DESTINO = 5;
const PEDIDO: readonly PlatilloPedido[] = [{ nombre: CARTA.cerveza.nombre, veces: 2 }];

test.describe('cambiar de mesa sin salir del mapa (DP-21 · Bloque 10)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la mesera pasa la cuenta de la mesa 3 a la 5 desde el panel de la mesa, y sigue en /mesero', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const duena = await equipo.pagina(info, 'dueno');
    const reseteo = await duena.request.post('/api/pruebas/resetear', {
      headers: cabecerasDeEscrituraDePrueba(),
      data: { confirmacion: 'RESETEAR' },
      timeout: 120_000,
    });
    expect(reseteo.status(), await reseteo.text()).toBe(200);
    const lupita = await equipo.pagina(info, 'mesero');
    const fallos = [vigilarFallos(lupita), vigilarFallos(duena)];
    await lupita.goto('/');
    await lupita.waitForURL(/\/mesero$/);

    const { ordenId } = await abrirLaMesa(lupita, duena, ORIGEN, 2);
    await comandar(lupita, ORIGEN, PEDIDO);
    // Las navegaciones de página entera, para probar que NINGUNA ocurre al cambiar de mesa.
    const navegaciones: string[] = [];
    lupita.on('framenavigated', (marco) => {
      if (marco === lupita.mainFrame()) navegaciones.push(new URL(marco.url()).pathname);
    });

    await test.step('«Cambiar de mesa» abre ahí mismo las mesas libres, sin la propia ni las ocupadas', async () => {
      await dialogoDeLaMesa(lupita, ORIGEN)
        .getByRole('button', { name: 'Cambiar de mesa', exact: true })
        .click();
      const panel = lupita.getByRole('dialog', { name: 'Cambiar de mesa' });
      await expect(panel).toBeVisible();
      await expect(lupita).toHaveURL(/\/mesero$/);
      await expect(
        panel.getByRole('button', { name: new RegExp(`^Mesa ${String(DESTINO)}\\b`) }),
      ).toBeVisible();
      await expect(
        panel.getByRole('button', { name: new RegExp(`^Mesa ${String(ORIGEN)}\\b`) }),
      ).toHaveCount(0);
    });

    await test.step('tocar una mesa pregunta antes de pasar; «Pasar» mueve la cuenta y avisa', async () => {
      const panel = lupita.getByRole('dialog', { name: 'Cambiar de mesa' });
      await panel.getByRole('button', { name: new RegExp(`^Mesa ${String(DESTINO)}\\b`) }).click();
      await expect(
        panel.getByText(
          `¿Pasar la cuenta de la mesa ${String(ORIGEN)} a la mesa ${String(DESTINO)}?`,
        ),
      ).toBeVisible();
      // Tocar la mesa sólo la elige: la cuenta sigue donde estaba hasta decir «Pasar».
      expect((await mesaEnElServidor(duena, ORIGEN)).ordenId).toBe(ordenId);
      const movida = lupita.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/restaurante/cambiar-mesa',
      );
      await panel.getByRole('button', { name: 'Pasar', exact: true }).click();
      expect((await movida).status()).toBe(200);
      await expect(lupita.getByText(`La cuenta pasó a la mesa ${String(DESTINO)}`)).toBeVisible();
    });

    await test.step('no salió del mapa: sigue en /mesero, sin diálogos, y el servidor tiene la cuenta en la 5', async () => {
      await expect(lupita.getByRole('dialog')).toHaveCount(0);
      await expect(lupita).toHaveURL(/\/mesero$/);
      expect(navegaciones, 'Cambiar de mesa no debe navegar a otra pantalla.').toEqual([]);
      await expect.poll(async () => (await mesaEnElServidor(duena, DESTINO)).ordenId).toBe(ordenId);
      await expect.poll(async () => (await mesaEnElServidor(duena, ORIGEN)).ordenId).toBeNull();
      expect((await mesaEnElServidor(duena, DESTINO)).estado).not.toBe('libre');
    });

    for (const exigir of fallos) exigir();
  });
});
