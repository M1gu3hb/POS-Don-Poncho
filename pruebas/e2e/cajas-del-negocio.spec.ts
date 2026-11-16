import { expect, test, type Page } from '@playwright/test';

import { contextoDe, personaDe } from './ayudantes/roles.ts';
import { abrirCajaPorLaRuta, soltarLaCaja } from './ayudantes/sesion.ts';

/**
 * DP-18 · 1.2 · LA CAJA DICE SIEMPRE QUÉ CAJAS ESTÁN ABIERTAS EN OTROS APARATOS.
 *
 * Lo del 11-11 en producción, con dos aparatos: la tableta abre la caja; en la PC el dueño mueve el
 * cupo de cajas en Configuración y entra a Caja. Con cupo de 2, la PC decía «No hay caja abierta en
 * este aparato · Abrir caja» y callaba la de la tableta (DP-D74), y Miguel creyó que se había cerrado
 * sola. Ahora la Caja enseña cada caja abierta en otro aparato con su botón de traerla y, si cabe,
 * el de abrir otra; y se entera sin recargar cuando el otro aparato cierra la suya.
 *
 * DP-21 · Bloque 5 · LAS CAJAS CON NOMBRE FIJO (M1 y O9). «Las cajas se suman (Caja 28, Caja 32…).
 * Deben ser 1 o 2 fijas, que se trasladen, y mejor con nombre.» La caja es un lugar de la sucursal:
 * el dueño le pone nombre en Configuración → Caja, la tableta abre «Caja principal», la PC ve
 * «Caja principal · abierta en…», puede «Abrir Caja 2 aquí» o «Traer Caja principal a este
 * aparato», y al traerla sigue llamándose igual.
 */

const SLUG = 'prueba-restaurante';

async function fijarCupo(page: Page, cajas: 1 | 2): Promise<void> {
  await page.goto('/configuracion?tab=caja');
  const boton = page.getByRole('button', { name: cajas === 1 ? '1 caja' : '2 cajas', exact: true });
  await boton.click();
  await expect(boton).toHaveAttribute('aria-pressed', 'true');
}

/** En Configuración → Caja, con la pestaña ya abierta: el nombre del lugar 1 (vacío = «Caja 1»). */
async function nombrarLaPrimera(page: Page, nombre: string): Promise<void> {
  const campo = page.getByRole('textbox', { name: 'Caja 1', exact: true });
  await expect(campo).toBeVisible();
  if ((await campo.inputValue()) === nombre) return;
  await campo.fill(nombre);
  await page.getByRole('button', { name: 'Guardar nombres' }).click();
  await expect(page.getByText('Guardado.')).toBeVisible();
}

async function irALaCaja(page: Page): Promise<void> {
  // Por el menú, como la persona: sin recargar la aplicación.
  await page.getByRole('link', { name: 'Caja', exact: true }).first().click();
  await expect(page).toHaveURL(/\/caja/);
}

test('la PC ve la caja de la tableta por su nombre, la trae sin que cambie, y abre la Caja 2', async ({
  browser,
}, info) => {
  test.setTimeout(240_000);
  const tableta = await contextoDe(browser, info, personaDe(SLUG, 'cajero'));
  const pc = await contextoDe(browser, info, personaDe(SLUG, 'dueno'));
  const enTableta = await tableta.newPage();
  const enPc = await pc.newPage();
  try {
    await enTableta.goto('/caja');
    await soltarLaCaja(enTableta);
    await enPc.goto('/caja');
    await soltarLaCaja(enPc);

    // El dueño le pone nombre a la primera caja; la segunda se queda en «Caja 2».
    await fijarCupo(enPc, 2);
    await nombrarLaPrimera(enPc, 'Caja principal');

    expect(await abrirCajaPorLaRuta(enTableta, 50_000)).toBe(true);

    // Cupo de 2: la PC ve la de la tableta POR SU NOMBRE, la puede traer y puede abrir la Caja 2.
    await irALaCaja(enPc);
    const otras = enPc.getByRole('region', { name: 'Cajas abiertas en otros aparatos' });
    await expect(otras).toBeVisible();
    await expect(otras.getByText(/Caja principal · abierta en /)).toBeVisible();
    await expect(otras.getByText(/desde las \d{1,2}:\d{2}/)).toBeVisible();
    await expect(
      otras.getByRole('button', { name: 'Traer Caja principal a este aparato' }),
    ).toBeVisible();
    await expect(enPc.getByRole('button', { name: 'Abrir Caja 2 aquí' })).toBeVisible();
    // Nunca una caja con el nombre del aparato ni una tercera.
    await expect(enPc.getByRole('button', { name: /Abrir Caja 3/ })).toHaveCount(0);

    // Cupo de 1: ya no cabe otra; sólo se puede traer la que hay.
    await fijarCupo(enPc, 1);
    await irALaCaja(enPc);
    await expect(
      otras.getByRole('button', { name: 'Traer Caja principal a este aparato' }),
    ).toBeVisible();
    await expect(enPc.getByText(/Ya hay 1 caja abierta/)).toBeVisible();
    await expect(enPc.getByRole('button', { name: /^Abrir Caja/ })).toHaveCount(0);

    // La PC la trae: el nombre viaja con la caja.
    await otras.getByRole('button', { name: 'Traer Caja principal a este aparato' }).click();
    await otras.getByRole('button', { name: 'Sí, trasladarla' }).click();
    await expect(enPc.getByText(/Caja principal · /).first()).toBeVisible({ timeout: 15_000 });
    await expect(otras).toHaveCount(0, { timeout: 15_000 });

    // La PC cierra la suya: nadie tiene caja.
    await soltarLaCaja(enPc);
    await enPc.goto('/caja');
    await expect(enPc.getByText('No hay caja abierta en este aparato')).toBeVisible();
    await expect(enPc.getByRole('button', { name: 'Abrir Caja principal aquí' })).toBeVisible();
  } finally {
    await soltarLaCaja(enTableta).catch(() => 'sin caja');
    await soltarLaCaja(enPc).catch(() => 'sin caja');
    await fijarCupo(enPc, 2).catch(() => undefined);
    await nombrarLaPrimera(enPc, '').catch(() => undefined);
    await tableta.close();
    await pc.close();
  }
});
