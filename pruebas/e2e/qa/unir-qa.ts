import { expect, type Page } from '@playwright/test';

/** QA-1 · UNIR Y SEPARAR mesas desde el mapa del mesero («Unir mesas»). */

/** «Unir mesas» en el mapa del mesero: toca las dos mesas, elige cuál número queda y une. */
export async function unirMesas(page: Page, principal: number, otra: number): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/mesero');
  await page.getByRole('button', { name: 'Unir mesas' }).click();
  const plano = page.getByRole('region', { name: 'Unir mesas' });
  const enElPlano = (n: number) =>
    plano.getByRole('button', { name: `Mesa ${String(n)}`, exact: true });
  await enElPlano(principal).click();
  await enElPlano(otra).click();
  await plano.getByRole('button', { name: /^Unir 2 mesas/ }).click();
  const numero = page.getByRole('alertdialog', { name: '¿Qué número queda?' });
  // Con gente en las mesas primero pregunta «¿Unir de todos modos?» (las cuentas se juntan).
  const todosModos = page.getByRole('alertdialog', { name: '¿Unir de todos modos?' });
  await expect(todosModos.or(numero)).toBeVisible();
  if (await todosModos.isVisible()) {
    await todosModos.getByRole('button', { name: 'Unir', exact: true }).click();
    await expect(todosModos).toBeHidden();
  }
  if (await numero.isVisible().catch(() => false)) {
    await numero.getByRole('radio', { name: `Mesa ${String(principal)}` }).click();
    await numero.getByRole('button', { name: 'Unir', exact: true }).click();
    await expect(numero).toBeHidden();
  }
  await expect(plano).toBeHidden();
}

/** «Separar mesas»: desde «Unir mesas», toca la principal y separa. Devuelve los avisos que enseñó. */
export async function separarMesas(page: Page, principal: number): Promise<string> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/mesero');
  await page.getByRole('button', { name: 'Unir mesas' }).click();
  const plano = page.getByRole('region', { name: 'Unir mesas' });
  await plano.getByRole('button', { name: `Mesa ${String(principal)}`, exact: true }).click();
  await plano.getByRole('button', { name: 'Separar mesas' }).click();
  const pregunta = page.getByRole('alertdialog', { name: '¿Separar las mesas?' });
  await pregunta.getByRole('button', { name: 'Separar mesas' }).click();
  await expect(pregunta).toBeHidden();
  await expect(plano).toBeHidden();
  return (await page.locator('[data-sonner-toast], [role="status"]').allInnerTexts()).join(' | ');
}
