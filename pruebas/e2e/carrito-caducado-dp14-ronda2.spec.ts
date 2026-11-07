import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import {
  abrirElQrDeLaMesa,
  CARTA,
  prepararElPortalDelComensal,
  type TelefonoDelComensal,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import { cabecerasDeEscrituraDePrueba, exigirDemostracion } from './ayudantes/sesion.ts';

/**
 * DP-14 ronda 2 · medio 9 · EL CARRITO CADUCADO, en el mapa del mesero y en los teléfonos.
 *
 * Un teléfono arma un pedido y llama al mesero; el mesero ve el globo «Pedido listo para
 * confirmar». Pasan más de 3 horas sin enviarse (se envejecen las líneas en la base DESECHABLE de
 * esta corrida):
 *   · el globo desaparece del mapa del mesero SIN que ningún teléfono sondee el carrito (el
 *     teléfono está sin red mientras tanto, para que él no lo resuelva);
 *   · «Tu pedido se borró…» lo lee el teléfono que estaba en ese carrito, y NO uno que llega después
 *     (la familia nueva).
 * Los teléfonos no llevan el vigilante de fallos: se les corta la red a propósito.
 */

const MESA = 5;
const AVISO_DEL_CADUCADO = 'Tu pedido se borró porque pasaron 3 horas sin enviarse';
const PSQL = process.env['MORPHIQPOS_PSQL'] ?? 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';

/** Envejece el carrito de la mesa 5 en la base desechable de esta corrida (nunca en otra). */
function envejecerElCarrito(): void {
  const puerto = process.env['MORPHIQPOS_BASE_DESECHABLE_PUERTO'] ?? '';
  if (puerto === '') {
    throw new Error('Esta prueba sólo corre contra la base desechable: falta su puerto.');
  }
  execFileSync(
    PSQL,
    [
      '-h',
      '127.0.0.1',
      '-p',
      puerto,
      '-U',
      'morphiqpos',
      '-d',
      'morphiqpos_desechable',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `update carrito_mesa_lineas set created_at = now() - interval '3 hours 10 minutes'
        where mesa_id in (select m.id from mesas m join organizaciones o on o.id = m.organizacion_id
                           where m.numero = ${String(MESA)} and o.slug = 'prueba-restaurante')`,
    ],
    { stdio: 'pipe' },
  );
}

function tarjetaDe(telefono: Page, nombre: string) {
  return telefono
    .locator('button.rounded-2xl')
    .filter({ has: telefono.getByText(nombre, { exact: true }) });
}

test.describe('el carrito caducado (DP-14 ronda 2, medio 9)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, 'prueba-restaurante');
  });

  // Envejece el carrito directo en la base: sólo con `psql` y la base desechable de esta PC (la CI
  // no corre esta spec). Sin ellos se omite con su motivo, no revienta.
  test.skip(
    (process.env['MORPHIQPOS_BASE_DESECHABLE_PUERTO'] ?? '') === '' || !existsSync(PSQL),
    'necesita psql y la base desechable local (MORPHIQPOS_BASE_DESECHABLE_PUERTO)',
  );

  test('el globo se va del mapa y «Tu pedido se borró…» es sólo del teléfono que lo tenía', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, 'prueba-restaurante');
    const telefonos: TelefonoDelComensal[] = [];
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

      const uno = await abrirElQrDeLaMesa(browser, info, 'prueba-restaurante', token);
      telefonos.push(uno);
      const a = uno.page;
      await tarjetaDe(a, CARTA.cerveza.nombre).click();
      await a.getByRole('button', { name: /^Agregar/ }).click();
      await expect(
        a.getByText(`${CARTA.cerveza.nombre} agregado al pedido de la mesa`),
      ).toBeVisible();
      await a.getByRole('button', { name: /^Pedido de la mesa \(1\)/ }).click();
      const hoja = a.getByRole('dialog', { name: 'El pedido de la mesa' });
      await hoja.getByRole('button', { name: 'Llamar a mi mesero para confirmar' }).click();
      await expect(
        a.getByText('Tu pedido está guardado. Tu mesero lo confirma y lo manda a cocina.').first(),
      ).toBeVisible();

      const mesero = await equipo.pagina(info, 'mesero');
      await mesero.goto('/mesero');
      const globos = mesero.locator('[data-globo-de-solicitud]');
      await expect(globos.first(), 'El mesero no ve el globo del pedido.').toBeVisible();

      await test.step('sin sondeo de teléfonos, el mapa del mesero resuelve el globo del carrito caducado', async () => {
        await uno.page.context().setOffline(true);
        envejecerElCarrito();
        // El mapa relee los avisos cada pocos segundos: la lectura del puente resuelve el globo.
        await expect(globos, 'El globo del carrito caducado sigue en el mapa.').toHaveCount(0, {
          timeout: 30_000,
        });
      });

      await test.step('el teléfono que estaba en el carrito lee que se borró; la familia nueva no', async () => {
        await uno.page.context().setOffline(false);
        await expect(a.getByText(AVISO_DEL_CADUCADO)).toBeVisible({ timeout: 30_000 });

        const dos = await abrirElQrDeLaMesa(browser, info, 'prueba-restaurante', token);
        telefonos.push(dos);
        const b = dos.page;
        await expect(tarjetaDe(b, CARTA.cerveza.nombre)).toBeVisible();
        // Un sondeo completo de la familia nueva, y el aviso no es suyo.
        await b.waitForResponse(
          (r) => new URL(r.url()).pathname.includes('/carrito') && r.request().method() === 'POST',
        );
        await expect(b.getByText(AVISO_DEL_CADUCADO)).toHaveCount(0);
      });
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      await equipo.cerrar();
    }
  });
});
