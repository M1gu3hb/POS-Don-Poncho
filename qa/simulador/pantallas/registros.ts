/**
 * REGISTROS, TABLERO Y CSV del dueño: cada pestaña de Registros (cortes, ventas, compras,
 * movimientos, gastos, auditoría) con su conteo, la exportación a CSV y el texto del Tablero.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { expect, type Locator, type Page } from '@playwright/test';

export type PestanaDeRegistros =
  | 'Cortes'
  | 'Ventas'
  | 'Cancelaciones'
  | 'Propinas'
  | 'Compras'
  | 'Movimientos'
  | 'Gastos'
  | 'Auditoría';

export async function irARegistros(pagina: Page, appUrl: string): Promise<void> {
  await pagina.goto(`${appUrl}/registros`, { waitUntil: 'domcontentloaded' });
  await expect(pagina.getByRole('tab', { name: /^Ventas/ })).toBeVisible({ timeout: 45_000 });
}

/** Abre una pestaña y devuelve el número que trae en su rótulo («Ventas (12 · 10 cobradas)» → 12). */
export async function abrirPestana(
  pagina: Page,
  nombre: PestanaDeRegistros,
): Promise<{ rotulo: string; cuantas: number | null }> {
  const tab = pagina.getByRole('tab', { name: new RegExp(`^${nombre}`) });
  await tab.click();
  const rotulo = (await tab.innerText()).replace(/\s+/g, ' ');
  const m = /\((\d+)/.exec(rotulo);
  return { rotulo, cuantas: m?.[1] === undefined ? null : Number(m[1]) };
}

/** Exporta la pestaña abierta a CSV y lo guarda en `destino`. */
export async function exportarCsv(pagina: Page, destino: string): Promise<string> {
  const descarga = pagina.waitForEvent('download', { timeout: 30_000 });
  await pagina
    .getByRole('button', { name: /^Exportar/ })
    .first()
    .click();
  await pagina.getByRole('menuitem', { name: /^CSV/ }).click();
  const archivo = await descarga;
  mkdirSync(dirname(destino), { recursive: true });
  await archivo.saveAs(destino);
  return archivo.suggestedFilename();
}

/** El texto del Tablero (la raíz), para que el árbitro lo lea. */
export async function textoDelTablero(pagina: Page, appUrl: string): Promise<string> {
  await pagina.goto(`${appUrl}/`, { waitUntil: 'domcontentloaded' });
  await expect(pagina.getByText(/ventas/i).first()).toBeVisible({ timeout: 45_000 });
  try {
    await pagina.waitForLoadState('networkidle', { timeout: 20_000 });
  } catch (error: unknown) {
    // El Tablero se refresca solo y puede no quedar «quieto»: se lee igual, pero se deja constancia.
    process.stderr.write(`(el Tablero no quedó quieto en 20 s: ${String(error).slice(0, 80)})
`);
  }
  const principal = pagina.locator('main').first();
  return (await principal.count()) > 0 ? principal.innerText() : pagina.locator('body').innerText();
}

export type CanalDeVentas = 'Todas' | 'Mesas' | 'Para llevar';

/** En Registros → Ventas, el filtro por canal («Todas», «Mesas», «Para llevar»). */
export async function filtrarVentas(pagina: Page, canal: CanalDeVentas): Promise<void> {
  const boton = pagina.getByRole('group', { name: 'Filtrar por canal' }).getByRole('button', {
    name: canal,
    exact: true,
  });
  await boton.click();
  await expect(boton).toHaveAttribute('aria-pressed', 'true');
}

/** La tarjeta de una venta en Registros → Ventas (por su folio; la serie puede ir delante: «A-12»). */
export function tarjetaDeVenta(pagina: Page, folio: string): Locator {
  return pagina
    .locator('div')
    .filter({ has: pagina.getByRole('button', { name: /Ver ticket/ }) })
    .filter({ has: pagina.getByText(new RegExp(`^(?:[A-Za-z]+-)?${folio}$`)) })
    .last();
}

/** Lo que dice la tarjeta de la venta (folio, fecha, mesa o pedido, cajera, estado, método y total), o `null` si no está. */
export async function textoDeLaVenta(pagina: Page, folio: string): Promise<string | null> {
  const tarjeta = tarjetaDeVenta(pagina, folio);
  if ((await tarjeta.count()) === 0) return null;
  return (await tarjeta.innerText()).replace(/\s+/g, ' ').trim();
}

/** Abre «Ver ticket» de la venta, lee lo que imprime y lo cierra. */
export async function textoDelTicket(pagina: Page, folio: string): Promise<string> {
  await tarjetaDeVenta(pagina, folio)
    .getByRole('button', { name: /Ver ticket/ })
    .click();
  const dialogo = pagina.getByRole('dialog').filter({ hasText: /^Ticket ·/ });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText('Cargando ticket...')).toBeHidden({ timeout: 30_000 });
  const texto = (await dialogo.innerText()).replace(/\s+/g, ' ').trim();
  await pagina.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  return texto;
}
