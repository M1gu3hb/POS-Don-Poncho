import { expect, type Locator, type Page, type Response } from '@playwright/test';

import { toque } from './toque.ts';

/**
 * CONFIGURACIÓN CON EL DEDO (DP-22, ajustes). Lo que comparten las specs `ajustes.*.spec.ts`: ir a
 * una sección, encontrar una tarjeta por su título, cambiar un campo con TOQUE de verdad (el
 * arnés, no `click()`) y guardar esa tarjeta. Cada tarjeta guarda sólo lo suyo y su «Guardar» se
 * apaga mientras no haya nada que guardar: eso es lo que se espera aquí para saber que el
 * servidor ya contestó.
 */

/** Configuración en una sección (`/configuracion?seccion=ticket-y-folios`). */
export async function irASeccion(page: Page, seccion: string): Promise<void> {
  await page.goto(`/configuracion?seccion=${seccion}`, { waitUntil: 'domcontentloaded' });
}

/** La tarjeta (región) con ese título. */
export function tarjeta(page: Page, titulo: string): Locator {
  return page.getByRole('region', { name: titulo, exact: true });
}

/** El interruptor de una fila «etiqueta ……… [switch]» (las tarjetas del portal y de la cocina). */
export function interruptorDeFila(region: Locator, etiqueta: string): Locator {
  return region
    .getByText(etiqueta, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"flex items-start")][1]')
    .getByRole('switch');
}

/** Pone un interruptor en el estado pedido, tocándolo sólo si hace falta. */
export async function fijarInterruptor(
  page: Page,
  interruptor: Locator,
  encendido: boolean,
): Promise<void> {
  await expect(interruptor).toBeVisible();
  if ((await interruptor.getAttribute('aria-checked')) !== String(encendido)) {
    await toque(page, interruptor);
  }
  await expect(interruptor).toHaveAttribute('aria-checked', String(encendido));
}

/** Escribe en un campo de texto (toca para dar foco y escribe): reemplaza lo que hubiera. */
export async function escribirEnCampo(page: Page, campo: Locator, texto: string): Promise<void> {
  await expect(campo).toBeVisible();
  await toque(page, campo);
  await campo.fill(texto);
  await expect(campo).toHaveValue(texto);
}

/** Toca «Guardar» de la tarjeta (si hay algo que guardar) y espera a que el servidor conteste. */
export async function guardarTarjeta(page: Page, region: Locator): Promise<void> {
  const guardar = region.getByRole('button', { name: 'Guardar', exact: true });
  await expect(guardar).toBeVisible();
  if (!(await guardar.isEnabled())) return;
  const esLaEscritura = (r: Response): boolean =>
    r.request().method() === 'POST' &&
    /\/api\//.test(r.url()) &&
    !/\/(consultar|estado|sesion)(\?|$)/.test(r.url());
  // Un toque que cae mientras la pantalla se vuelve a pintar se pierde: se repite una vez.
  for (let vez = 0; vez < 2; vez += 1) {
    const respuesta = page.waitForResponse(esLaEscritura, { timeout: 12_000 });
    await toque(page, guardar);
    const llego = await respuesta.then(
      (r) => r,
      () => null,
    );
    if (llego === null) continue;
    expect(llego.ok()).toBe(true);
    return;
  }
  const lo = (await region.innerText()).replaceAll('\n', ' | ').slice(0, 400);
  throw new Error(
    `«Guardar» no mandó nada al servidor después de dos toques. La tarjeta dice: ${lo}`,
  );
}
