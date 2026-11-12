/**
 * LO QUE HACE LA GERENCIA POR PANTALLA: gastos operativos (Compras), agotados del día (Platillos),
 * cambiar el precio de un platillo (Recetas → Editar receta) y el modo del menú del comensal
 * (Portal QR → Configuración). Cada uno devuelve cuando el servidor contestó 200.
 */
import { expect, type Page } from '@playwright/test';

import { cerrado, dialogoCon, elegir, esperarPost } from './comun.ts';

export async function registrarGastoOperativo(
  pagina: Page,
  appUrl: string,
  pesosDelGasto: number,
  descripcion: string,
  metodo: 'Efectivo' | 'Tarjeta' | 'Transferencia',
): Promise<void> {
  await pagina.goto(`${appUrl}/compras`, { waitUntil: 'domcontentloaded' });
  await pagina
    .getByRole('button', { name: /^Registrar gasto/ })
    .first()
    .click();
  const dialogo = dialogoCon(pagina, 'Registrar gasto operativo');
  await dialogo.getByPlaceholder('Ej: Recibo CFE de mayo').fill(descripcion);
  await dialogo.getByPlaceholder('$0.00').fill(String(pesosDelGasto));
  if (metodo !== 'Efectivo') await elegir(pagina, dialogo, 'Método de pago', metodo);
  const envio = esperarPost(pagina, '/api/gastos/registrar');
  await dialogo.getByRole('button', { name: 'Guardar gasto' }).click();
  const r = await envio;
  expect(r.status(), `gasto: ${(await r.text()).slice(0, 200)}`).toBe(200);
  await cerrado(dialogo);
}

/** Marca o desmarca un platillo como agotado hoy (Platillos → Agotados). */
export async function marcarAgotado(
  pagina: Page,
  appUrl: string,
  platillo: string,
  agotado: boolean,
): Promise<void> {
  await pagina.goto(`${appUrl}/productos`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('button', { name: 'Agotados', exact: true }).click();
  const dialogo = dialogoCon(pagina, 'Agotados del día');
  await dialogo.getByLabel(/^Buscar /).fill(platillo);
  const interruptor = dialogo.getByRole('switch', { name: `${platillo}: agotado hoy` });
  await expect(interruptor).toBeVisible();
  if (((await interruptor.getAttribute('aria-checked')) === 'true') !== agotado) {
    const envio = esperarPost(pagina, '/api/catalogo/marcar-agotado');
    await interruptor.click();
    expect((await envio).status()).toBe(200);
  }
  await pagina.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
}

/** Cambia el precio de venta de un platillo por Recetas → «Editar receta». */
export async function cambiarPrecio(
  pagina: Page,
  appUrl: string,
  platillo: string,
  pesos: number,
): Promise<void> {
  await pagina.goto(`${appUrl}/recetas`, { waitUntil: 'domcontentloaded' });
  await expect(pagina.getByText(platillo, { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  });
  const tarjeta = pagina
    .getByText(platillo, { exact: true })
    .locator('xpath=ancestor::div[.//button[normalize-space()="Editar receta"]][1]');
  const editar = tarjeta.first().getByRole('button', { name: 'Editar receta' });
  // Cada platillo es un acordeón: «Editar receta» sólo se toca con el renglón abierto (el chevron).
  if (!(await editar.isVisible())) await tarjeta.first().getByRole('button').first().click();
  await editar.click();
  const dialogo = dialogoCon(pagina, 'Editar receta');
  await dialogo.getByPlaceholder('0.00').first().fill(String(pesos));
  await dialogo.getByRole('button', { name: 'Guardar cambios' }).click();
  await cerrado(dialogo, 45_000);
}

/** El modo del menú del comensal (Portal QR → Configuración → «Cómo se ve el menú»). */
export async function cambiarElModoDelMenu(
  pagina: Page,
  appUrl: string,
  modo: 'Menú digital' | 'A la carta',
): Promise<void> {
  await pagina.goto(`${appUrl}/portal-qr`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('tab', { name: 'Configuración', exact: true }).click();
  const selector = pagina.getByRole('combobox', { name: 'Cómo se ve el menú' });
  await expect(selector).toBeVisible();
  if ((await selector.innerText()).includes(modo)) return;
  await selector.click();
  await pagina.getByRole('option', { name: modo, exact: true }).click();
  const envio = esperarPost(pagina, '/api/datos/escribir');
  await pagina.getByRole('button', { name: 'Guardar configuración' }).click();
  expect((await envio).status()).toBe(200);
}
