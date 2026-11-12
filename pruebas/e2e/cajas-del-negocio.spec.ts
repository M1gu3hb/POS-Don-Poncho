import { expect, test, type Page } from '@playwright/test';

import { contextoDe, personaDe } from './ayudantes/roles.ts';
import { abrirCajaPorLaRuta, soltarLaCaja } from './ayudantes/sesion.ts';

/**
 * DP-18 · 1.2 · LA CAJA DICE SIEMPRE QUÉ CAJAS ESTÁN ABIERTAS EN OTROS APARATOS.
 *
 * Lo del 11-11 en producción, con dos aparatos: la tableta abre la caja; en la PC el dueño mueve el
 * cupo de cajas en Configuración y entra a Caja. Con cupo de 2, la PC decía «No hay caja abierta en
 * este aparato · Abrir caja» y callaba la de la tableta (DP-D74), y Miguel creyó que se había cerrado
 * sola. Ahora la Caja enseña cada caja abierta en otro aparato con «Trasladar aquí» y, si cabe,
 * «Abrir otra caja aquí»; y se entera sin recargar cuando el otro aparato cierra la suya.
 */

const SLUG = 'prueba-restaurante';

async function fijarCupo(page: Page, cajas: 1 | 2): Promise<void> {
  await page.goto('/configuracion?tab=caja');
  const boton = page.getByRole('button', { name: cajas === 1 ? '1 caja' : '2 cajas', exact: true });
  await boton.click();
  await expect(boton).toHaveAttribute('aria-pressed', 'true');
}

async function irALaCaja(page: Page): Promise<void> {
  // Por el menú, como la persona: sin recargar la aplicación.
  await page.getByRole('link', { name: 'Caja', exact: true }).first().click();
  await expect(page).toHaveURL(/\/caja/);
}

test('la PC ve la caja de la tableta, con cupo de 1 y de 2, y se entera cuando se cierra', async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const tableta = await contextoDe(browser, info, personaDe(SLUG, 'cajero'));
  const pc = await contextoDe(browser, info, personaDe(SLUG, 'dueno'));
  const enTableta = await tableta.newPage();
  const enPc = await pc.newPage();
  try {
    await enTableta.goto('/caja');
    await soltarLaCaja(enTableta);
    await enPc.goto('/caja');
    await soltarLaCaja(enPc);
    expect(await abrirCajaPorLaRuta(enTableta, 50_000)).toBe(true);

    // Cupo de 2: la PC puede abrir otra, y aun así ve la de la tableta y la puede traer.
    await fijarCupo(enPc, 2);
    await irALaCaja(enPc);
    const otras = enPc.getByRole('region', { name: 'Cajas abiertas en otros aparatos' });
    await expect(otras).toBeVisible();
    await expect(otras.getByText(/desde las \d{1,2}:\d{2}/)).toBeVisible();
    await expect(otras.getByRole('button', { name: 'Trasladar aquí' })).toBeVisible();
    await expect(
      enPc.getByRole('button', { name: /Abrir otra caja aquí \(2 de 2\)/ }),
    ).toBeVisible();

    // Cupo de 1: ya no cabe otra, la de la tableta sigue a la vista con «Trasladar aquí».
    await fijarCupo(enPc, 1);
    await irALaCaja(enPc);
    await expect(otras.getByRole('button', { name: 'Trasladar aquí' })).toBeVisible();
    await expect(enPc.getByText(/Ya hay 1 caja abierta/)).toBeVisible();
    await expect(enPc.getByRole('button', { name: /Abrir otra caja aquí/ })).toHaveCount(0);

    // La tableta cierra la suya: la PC se entera sola, sin recargar.
    await soltarLaCaja(enTableta);
    await expect(otras).toHaveCount(0, { timeout: 15_000 });
    await expect(enPc.getByText('No hay caja abierta en este aparato')).toBeVisible();
  } finally {
    await soltarLaCaja(enTableta).catch(() => 'sin caja');
    await soltarLaCaja(enPc).catch(() => 'sin caja');
    await fijarCupo(enPc, 2).catch(() => undefined);
    await tableta.close();
    await pc.close();
  }
});
