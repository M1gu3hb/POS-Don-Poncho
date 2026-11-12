/**
 * REGISTROS, TABLERO Y CSV del dueño: cada pestaña de Registros (cortes, ventas, compras,
 * movimientos, gastos, auditoría) con su conteo, la exportación a CSV y el texto del Tablero.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { expect, type Page } from '@playwright/test';

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
  await pagina.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  return pagina
    .locator('main')
    .first()
    .innerText()
    .catch(() => pagina.locator('body').innerText());
}
