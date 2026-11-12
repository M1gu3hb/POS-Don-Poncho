import { expect, test } from '@playwright/test';

import { contextoDe, personaDe } from './ayudantes/roles.ts';

/**
 * DP-18 · 1.1 · EL MODO DEL MENÚ NO «SE REGRESA» (lo vio Miguel en producción el 11-11).
 *
 * Portal QR → Configuración → «Cómo se ve el menú»: guardar, ir a otra pestaña y volver. La pestaña
 * invalidaba `['config_remote']`, una llave que nadie lee, así que al volver el formulario se
 * rellenaba con la configuración vieja del contexto (`['config']`) aunque la base ya tenía la nueva.
 * Aquí: guardar → otra pestaña → volver → sigue el nuevo; recargar → sigue el nuevo.
 */

const SLUG = 'prueba-restaurante';
const MODOS = { carta: 'A la carta', digital: 'Menú digital' } as const;

test('el modo del menú guardado sigue igual al volver de otra pestaña y al recargar', async ({ browser }, info) => {
  const contexto = await contextoDe(browser, info, personaDe(SLUG, 'dueno'));
  const page = await contexto.newPage();
  try {
    await page.goto('/portal-qr');
    const pestanaConfig = page.getByRole('tab', { name: 'Configuración' });
    const pestanaMesas = page.getByRole('tab', { name: 'Mesas QR' });
    const modo = page.getByRole('combobox', { name: 'Cómo se ve el menú' });
    const guardar = page.getByRole('button', { name: 'Guardar configuración' });

    await pestanaConfig.click();
    await expect(modo).toBeVisible();
    const antes = (await modo.innerText()).trim();
    const nuevo = antes === MODOS.carta ? MODOS.digital : MODOS.carta;

    await modo.click();
    await page.getByRole('option', { name: nuevo, exact: true }).click();
    await expect(modo).toHaveText(nuevo);
    await guardar.click();
    await expect(page.getByText('Configuración guardada')).toBeVisible();

    // A otra pestaña y de vuelta, sin recargar: el formulario se vuelve a montar con el contexto.
    await pestanaMesas.click();
    await expect(pestanaMesas).toHaveAttribute('aria-selected', 'true');
    await pestanaConfig.click();
    await expect(modo).toHaveText(nuevo);

    // Y recargando.
    await page.reload();
    await page.getByRole('tab', { name: 'Configuración' }).click();
    await expect(page.getByRole('combobox', { name: 'Cómo se ve el menú' })).toHaveText(nuevo);

    // Se deja como estaba.
    await page.getByRole('combobox', { name: 'Cómo se ve el menú' }).click();
    await page.getByRole('option', { name: antes, exact: true }).click();
    await page.getByRole('button', { name: 'Guardar configuración' }).click();
    await expect(page.getByText('Configuración guardada').first()).toBeVisible();
  } finally {
    await contexto.close();
  }
});
