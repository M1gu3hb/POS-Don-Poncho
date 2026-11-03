import { expect, test } from '@playwright/test';

import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import {
  abrirElCobro,
  abrirLaCaja,
  abrirLaMesa,
  alMapa,
  CARTA,
  cocinaDejaLista,
  comandar,
  cuentaEnElServidor,
  entregar,
  importeDe,
  pedirLaCuenta,
  type PlatilloPedido,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * QA1-5 y QA1-6 (DP-13.5) · LA CUENTA SE DIVIDE DONDE SE COBRA, Y CADA PARTE SE LLAMA POR SU NOMBRE.
 *
 * El botón «Dividir» vivía sólo en `/restaurante/cobro`, que ninguna pantalla enlaza: la cajera,
 * en su caja (`/caja`), no tenía por dónde dividir la cuenta de una mesa. Y las partes, que nacen
 * sin mesa, salían en Pendientes como «Mesa —».
 */

const SLUG = 'prueba-restaurante';
const MESA = 4;
const PEDIDO: readonly PlatilloPedido[] = [
  { nombre: CARTA.arrachera.nombre, veces: 1 },
  { nombre: CARTA.cerveza.nombre, veces: 1 },
];

test.describe('dividir la cuenta en la caja', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la cajera divide la cuenta de la mesa desde su cobro y cobra cada parte por su nombre', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const duena = await equipo.pagina(info, 'dueno');
    const resetear = async () => {
      const respuesta = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(respuesta.status(), `resetear: ${await respuesta.text()}`).toBe(200);
    };
    await resetear();

    const rosa = await equipo.pagina(info, 'cajero');
    const lupita = await equipo.pagina(info, 'mesero');
    const tono = await equipo.pagina(info, 'cocina');
    const fallos = [rosa, lupita, tono].map((p) => vigilarFallos(p));
    await rosa.goto('/');
    await rosa.waitForURL(/\/caja$/);
    await lupita.goto('/');
    await lupita.waitForURL(/\/mesero$/);
    await tono.goto('/');
    await tono.waitForURL(/\/cocina$/);
    if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);

    let ordenId = '';
    await test.step('Lupita sirve la mesa y pide la cuenta', async () => {
      ordenId = (await abrirLaMesa(lupita, duena, MESA, 2)).ordenId;
      await comandar(lupita, MESA, PEDIDO);
      await alMapa(lupita);
      await cocinaDejaLista(tono, duena, ordenId, 2);
      await entregar(lupita, MESA);
      await pedirLaCuenta(lupita, MESA, 'Sin propina', importeDe(PEDIDO));
      await alMapa(lupita);
      await expect
        .poll(async () => (await cuentaEnElServidor(duena, ordenId)).estado)
        .toBe('cuenta_solicitada');
    });

    await test.step('Rosa divide la cuenta en dos desde el cobro de su caja', async () => {
      const cobro = await abrirElCobro(rosa, MESA);
      await cobro.getByRole('button', { name: /^Dividir\b/ }).click();
      const dialogo = rosa.getByRole('dialog', { name: 'Dividir la cuenta' });
      for (const [cuenta, platillo] of [CARTA.arrachera.nombre, CARTA.cerveza.nombre].entries()) {
        await dialogo
          .getByRole('button', {
            name: `Añadir ${platillo} a la cuenta ${String(cuenta + 1)}`,
            exact: true,
          })
          .click();
      }
      const [respuesta] = await Promise.all([
        rosa.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/dividir-cuenta' &&
            r.request().method() === 'POST',
        ),
        dialogo.getByRole('button', { name: /^Dividir en 2 cuentas/ }).click(),
      ]);
      expect(respuesta.status(), await respuesta.text()).toBe(200);
      await expect(dialogo).toHaveCount(0);
      await expect(cobro, 'El cobro de la cuenta madre siguió abierto.').toBeHidden();
    });

    await test.step('en Pendientes, cada parte con su nombre y la madre ya no se cobra', async () => {
      for (const n of [1, 2]) {
        await expect(
          rosa
            .getByRole('button', {
              name: new RegExp(`^Mesa ${String(MESA)} · cuenta ${String(n)} de 2 `),
            })
            .first(),
          `La parte ${String(n)} no salió con su nombre en Pendientes.`,
        ).toBeVisible({ timeout: 30_000 });
      }
      await expect(rosa.getByText('Mesa —', { exact: true })).toHaveCount(0);
      expect((await cuentaEnElServidor(duena, ordenId)).estado).toBe('dividida');
    });

    for (const exigirSinFallos of fallos) exigirSinFallos();
    await resetear();
  });
});
