import { expect, test, type Page } from '@playwright/test';

import { SLUG } from './ayudantes/modo-espera.ts';
import { Equipo } from './ayudantes/roles.ts';
import { exigirDemostracion } from './ayudantes/sesion.ts';

/**
 * DP-11.4 · LA NAVEGACIÓN: el dock en táctil, la barra lateral con ratón.
 *
 * Táctil es un puntero grueso o menos de 64rem (la tableta del local mide 1280 px en horizontal):
 * ahí se ve el dock de abajo con las secciones del puesto y «Abrir menú», que abre el cajón de
 * siempre; la barra lateral no. Con ratón es al revés. La prueba le pregunta al navegador cuál es
 * y exige lo suyo, en los tres aparatos.
 */

async function esTactil(page: Page): Promise<boolean> {
  return page.evaluate(() => matchMedia('(pointer: coarse), (max-width: 63.999rem)').matches);
}

test.describe('la navegación del puesto', () => {
  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la dueña: en táctil, el dock con sus secciones y el menú completo detrás de «Abrir menú»', async ({
    browser,
  }, info) => {
    const duena = await new Equipo(browser, SLUG).pagina(info, 'dueno');
    await duena.goto('/');
    await expect(duena.getByRole('heading', { level: 1 })).toBeVisible();
    const dock = duena.getByRole('navigation', { name: 'Secciones' });
    const menu = duena
      .getByRole('navigation', { name: 'Menú principal' })
      .filter({ visible: true });

    if (!(await esTactil(duena))) {
      // Con ratón: la barra lateral, y ni el dock ni su botón.
      await expect(menu).toBeVisible();
      await expect(dock).toBeHidden();
      await expect(duena.getByRole('button', { name: 'Abrir menú' })).toBeHidden();
      return;
    }

    await expect(dock).toBeVisible();
    await expect(menu).toHaveCount(0);
    await expect(dock.getByRole('link')).toHaveText(['Inicio', 'Mesas', 'Cocina', 'Caja']);

    await dock.getByRole('link', { name: 'Caja' }).click();
    await expect(duena).toHaveURL(/\/caja$/);
    await expect(dock.getByRole('link', { name: 'Caja' })).toHaveAttribute('aria-current', 'page');

    // «Más»: el cajón de siempre, con el menú completo; el dock queda inerte detrás.
    await dock.getByRole('button', { name: 'Abrir menú' }).click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Configuración', exact: true })).toBeVisible();
    await expect(dock).toHaveCount(0);
    await duena.getByRole('button', { name: 'Cerrar menú' }).click();
    await expect(menu).toHaveCount(0);
    await expect(dock).toBeVisible();
  });

  test('la mesera: en táctil, el dock sólo con sus mesas', async ({ browser }, info) => {
    const mesera = await new Equipo(browser, SLUG).pagina(info, 'mesero');
    await mesera.goto('/mesero');
    await expect(mesera.getByRole('heading', { name: 'Mesero', level: 1 })).toBeVisible();
    test.skip(!(await esTactil(mesera)), 'con ratón no hay dock');

    const dock = mesera.getByRole('navigation', { name: 'Secciones' });
    await expect(dock.getByRole('link')).toHaveText(['Mesas']);
    await expect(dock.getByRole('link', { name: 'Mesas' })).toHaveAttribute('aria-current', 'page');
  });
});
