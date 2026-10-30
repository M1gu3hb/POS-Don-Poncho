import { expect, test, type Page } from '@playwright/test';

import { SLUG } from './ayudantes/modo-espera.ts';
import { Equipo } from './ayudantes/roles.ts';
import { exigirDemostracion } from './ayudantes/sesion.ts';

/**
 * DP-11.4 · CLARO, OSCURO O AUTOMÁTICO, EN ESTE APARATO (Configuración → Apariencia).
 *
 * Sin nada elegido el punto de venta sigue al sistema del aparato, y lo sigue en vivo; lo elegido
 * a mano gana y sobrevive a recargar. Lo que pinta el modo sigue siendo `data-modo`
 * (`claro`/`oscuro`), así que todo lo que ya lo leía sigue igual.
 */

async function abrirApariencia(page: Page): Promise<void> {
  await page.goto('/configuracion');
  await page.getByRole('tab', { name: 'Apariencia' }).click();
  await expect(page.getByText('Claro u oscuro, en este aparato')).toBeVisible();
}

function opcion(page: Page, nombre: 'Automático' | 'Claro' | 'Oscuro') {
  return page.getByRole('radio', { name: nombre });
}

test.describe('el modo de este aparato', () => {
  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('sin elegir nada sigue al sistema, y lo sigue en vivo', async ({ browser }, info) => {
    const duena = await new Equipo(browser, SLUG).pagina(info, 'dueno');
    await duena.emulateMedia({ colorScheme: 'dark' });
    await duena.goto('/configuracion');
    await duena.evaluate(() => {
      window.localStorage.removeItem('mh_theme');
    });
    await abrirApariencia(duena);

    await expect(duena.locator('html')).toHaveAttribute('data-modo', 'oscuro');
    await expect(opcion(duena, 'Automático')).toHaveAttribute('aria-checked', 'true');

    // El aparato cambia de modo (el atardecer del teléfono): el punto de venta lo sigue.
    await duena.emulateMedia({ colorScheme: 'light' });
    await expect(duena.locator('html')).toHaveAttribute('data-modo', 'claro');
  });

  test('lo elegido a mano gana al sistema y sobrevive a recargar; Automático lo devuelve', async ({
    browser,
  }, info) => {
    const duena = await new Equipo(browser, SLUG).pagina(info, 'dueno');
    await duena.emulateMedia({ colorScheme: 'light' });
    await abrirApariencia(duena);

    await opcion(duena, 'Oscuro').click();
    await expect(duena.locator('html')).toHaveAttribute('data-modo', 'oscuro');
    await duena.reload();
    await expect(duena.locator('html')).toHaveAttribute('data-modo', 'oscuro');

    await abrirApariencia(duena);
    await opcion(duena, 'Automático').click();
    await expect(duena.locator('html')).toHaveAttribute('data-modo', 'claro');
    await expect(opcion(duena, 'Automático')).toHaveAttribute('aria-checked', 'true');
  });
});
