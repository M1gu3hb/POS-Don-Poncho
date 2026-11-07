import { devices, expect, test, type Page, type TestInfo } from '@playwright/test';

import { audioComoEnIos, audioCorre } from './ayudantes/audio-bloqueado.ts';
import {
  abrirLaMesa,
  armarElPedido,
  CARTA,
  cocinaDejaLista,
  comandar,
  dialogoDeLaMesa,
} from './ayudantes/mesas-heredadas.ts';
import { resetearLaDemo, SLUG } from './ayudantes/modo-espera.ts';
import { Equipo } from './ayudantes/roles.ts';
import { exigirDemostracion, vigilarFallos } from './ayudantes/sesion.ts';

/**
 * DP-14.6-8 · EL SONIDO: EL AVISO NO ESTORBA, NO SE GASTA EN VANO Y EL BOTÓN SIEMPRE ESTÁ.
 *
 *   · Con el audio sin correr (iOS «interrumpido»: `resume()` contesta pero no enciende) un aviso
 *     que debe sonar deja «Sonido apagado · toca para activar» ARRIBA, sin tapar la barra del
 *     carrito del mesero; un gesto con el audio aún sin correr NO lo quita ni gasta el timbre;
 *     cuando el audio corre, el siguiente gesto lo hace sonar y el aviso se va.
 *   · El botón «Sonido de este aparato» se ve con el menú colapsado (escritorio) y en
 *     `/cocina-telefono`, donde no hay menú.
 * Corre en serie (`--workers=1`): comanda y cancela cuentas de la demo.
 */

const AVISO = 'Sonido apagado · toca para activar';
const MESA = 3;

interface Caja {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const seCruzan = (a: Caja, b: Caja): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function lupitaConElAudioApagado(equipo: Equipo, info: TestInfo): Promise<Page> {
  const lupita = await equipo.pagina(info, 'mesero');
  await audioComoEnIos(lupita);
  await lupita.goto('/mesero');
  await lupita.waitForURL(/\/mesero$/);
  return lupita;
}

test.describe('el sonido (DP-14.6-8)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('«Sonido apagado» va arriba y no tapa el carrito; un gesto sin audio no lo gasta; con audio, suena y se va', async ({
    browser,
  }, info) => {
    test.skip(info.project.name === 'escritorio', 'el carrito del mesero: tableta y teléfono');
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const duena = await equipo.pagina(info, 'dueno');
    await resetearLaDemo(duena);
    const tono = await equipo.pagina(info, 'cocina');
    await tono.goto('/');
    await tono.waitForURL(/\/cocina$/);
    const lupita = await lupitaConElAudioApagado(equipo, info);
    const fallos = [duena, tono, lupita].map((p) => vigilarFallos(p));

    const { ordenId } = await abrirLaMesa(lupita, duena, MESA, 2);
    await comandar(lupita, MESA, [{ nombre: CARTA.pastor.nombre, veces: 1 }]);
    // Un platillo más en el carrito, sin enviar: la barra del carrito queda a la vista.
    await armarElPedido(lupita, MESA, [{ nombre: CARTA.guacamole.nombre, veces: 1 }]);
    const barra = dialogoDeLaMesa(lupita, MESA)
      .getByRole('button', { name: 'Enviar a Cocina', exact: true })
      .or(lupita.getByRole('button', { name: /\d+ productos? .*Ver pedido/ }))
      .filter({ visible: true })
      .first();
    await expect(barra).toBeVisible();
    const aviso = lupita.getByRole('button', { name: AVISO });

    await test.step('cocina deja lista la comanda: el aviso sale ARRIBA y no tapa la barra del carrito', async () => {
      await cocinaDejaLista(tono, duena, ordenId, 1);
      await expect(lupita.getByText('Pedido listo').first()).toBeVisible({ timeout: 30_000 });
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      const delAviso = await aviso.boundingBox();
      const delCarrito = await barra.boundingBox();
      const alto = lupita.viewportSize()?.height ?? 0;
      expect(delAviso, 'El aviso no tiene caja.').not.toBeNull();
      expect(delCarrito, 'La barra del carrito no tiene caja.').not.toBeNull();
      if (delAviso === null || delCarrito === null) return;
      expect(delAviso.y, 'El aviso no está arriba.').toBeLessThan(alto / 4);
      expect(seCruzan(delAviso, delCarrito), 'El aviso tapa la barra del carrito.').toBe(false);
      // Y la barra recibe el toque en su centro: nada encima.
      const libre = await barra.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const encima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return encima !== null && el.contains(encima);
      });
      expect(libre, 'Algo está encima de la barra del carrito.').toBe(true);
    });

    await test.step('un gesto con el audio SIN correr no quita el aviso ni gasta el timbre', async () => {
      await lupita.keyboard.press('Shift');
      await lupita.waitForTimeout(1500);
      await expect(aviso, 'El aviso se fue sin que el audio corriera.').toBeVisible();
      await expect(lupita.locator('html')).not.toHaveAttribute('data-ultimo-sonido', 'check');
    });

    await test.step('con el audio corriendo, el siguiente gesto lo hace sonar y el aviso se va', async () => {
      await audioCorre(lupita);
      await lupita.keyboard.press('Shift');
      await expect(lupita.locator('html')).toHaveAttribute('data-ultimo-sonido', 'check', {
        timeout: 10_000,
      });
      await expect(aviso).toHaveCount(0);
    });
    for (const exigir of fallos) exigir();
  });

  test('el botón de sonido se ve con el menú colapsado (escritorio)', async ({ browser }, info) => {
    test.skip(info.project.name !== 'escritorio', 'el menú lateral sólo existe en la PC');
    const duena = await new Equipo(browser, SLUG).pagina(info, 'dueno');
    const fallos = vigilarFallos(duena);
    await duena.goto('/');
    const boton = duena
      .getByRole('button', { name: 'Sonido de este aparato' })
      .filter({ visible: true });
    await expect(boton.first()).toBeVisible();
    await duena.getByRole('button', { name: 'Colapsar' }).click();
    await expect(duena.getByRole('button', { name: 'Expandir' })).toBeVisible();
    await expect(
      boton.first(),
      'Con el menú colapsado el botón de sonido desapareció.',
    ).toBeVisible();
    await boton.first().click();
    await expect(duena.getByRole('dialog', { name: 'Sonido de este aparato' })).toBeVisible();
    fallos();
  });

  test('el teléfono de cocina trae el botón de sonido', async ({ browser }, info) => {
    test.setTimeout(3 * 60_000);
    const tono = await new Equipo(browser, SLUG).pagina(info, 'cocina');
    await tono.goto('/');
    await tono.waitForURL(/\/cocina$/);
    await tono.getByRole('button', { name: 'Conectar teléfono' }).click();
    const conectar = tono.getByRole('dialog', { name: 'Conectar teléfono' });
    await conectar.getByRole('button', { name: 'Cocina general', exact: true }).click();
    const enlace = await conectar.getByRole('link').getAttribute('href');
    expect(enlace).toMatch(/\/cocina-telefono\//);
    const uso = info.project.use;
    const contexto = await browser.newContext({
      ...devices['Pixel 7'],
      ...(uso.baseURL === undefined ? {} : { baseURL: uso.baseURL }),
      ...(uso.extraHTTPHeaders === undefined ? {} : { extraHTTPHeaders: uso.extraHTTPHeaders }),
      locale: 'es-MX',
    });
    try {
      const telefono = await contexto.newPage();
      await telefono.goto(new URL(enlace ?? '').pathname);
      await telefono.getByRole('button', { name: 'Toca para activar el sonido' }).click();
      const boton = telefono.getByRole('button', { name: 'Sonido de este aparato' });
      await expect(boton).toBeVisible();
      await boton.click();
      await expect(telefono.getByRole('dialog', { name: 'Sonido de este aparato' })).toBeVisible();
    } finally {
      await contexto.close();
    }
  });
});
