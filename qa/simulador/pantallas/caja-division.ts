/**
 * DIVIDIR LA CUENTA EN LA CAJA, por pantalla: dentro del cobro de una mesa, «Dividir» abre una tabla
 * de platillos por cuentas, con su «−» y su «+» en cada celda. Lo que se reparte son UNIDADES (el
 * servidor calcula el importe de cada parte). Aquí sólo se toca y se lee; lo que la cajera espera
 * (cuánto vale cada parte) lo calcula el bot que llama, con lo que sabe del libro.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { cerrado, dialogoCon, esperarPost } from './comun.ts';

/** Un renglón de la tabla de dividir: el platillo y cuántas unidades hay por repartir. */
export interface RenglonPorRepartir {
  readonly nombre: string;
  readonly unidades: number;
}

/** Cuántas unidades de cada renglón (por su posición en la tabla) se lleva cada cuenta. */
export type Reparto = readonly (readonly number[])[];

/** Abre «Dividir la cuenta» desde el cobro que está abierto. */
export async function abrirLaDivision(pagina: Page, cobro: Locator): Promise<Locator> {
  await cobro.getByRole('button', { name: /^Dividir\b/ }).click();
  const dialogo = pagina.getByRole('dialog', { name: 'Dividir la cuenta' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByRole('row').nth(1)).toBeVisible();
  return dialogo;
}

/** Las filas de platillos de la tabla (la del encabezado no lleva « × »). */
const filasDePlatillo = (dialogo: Locator): Locator =>
  dialogo.getByRole('row').filter({ hasText: ' × ' });

/** Los renglones de la tabla: «3 × Taco de prueba» y la columna «Por repartir». */
export async function leerLosRenglones(dialogo: Locator): Promise<readonly RenglonPorRepartir[]> {
  const filas = filasDePlatillo(dialogo);
  const cuantas = await filas.count();
  const renglones: RenglonPorRepartir[] = [];
  for (let i = 0; i < cuantas; i += 1) {
    const celdas = filas.nth(i).getByRole('cell');
    const texto = (await celdas.nth(0).innerText()).replace(/\s+/g, ' ').trim();
    const nombre = /×\s*(.+)$/.exec(texto)?.[1];
    const pendientes = Number((await celdas.nth(1).innerText()).replace(/[^\d.]/g, ''));
    if (nombre === undefined || !Number.isFinite(pendientes))
      throw new Error(`No pude leer el renglón de dividir: «${texto.slice(0, 80)}»`);
    renglones.push({ nombre, unidades: pendientes });
  }
  return renglones;
}

/** Añade cuentas hasta que haya `n` (la tabla empieza con dos). */
async function tenerCuentas(dialogo: Locator, n: number): Promise<void> {
  for (let tiene = 2; tiene < n; tiene += 1) {
    await dialogo.getByRole('button', { name: /^Añadir otra cuenta/ }).click();
    await expect(
      dialogo.getByRole('columnheader', { name: `Cuenta ${String(tiene + 1)}` }),
    ).toBeVisible();
  }
}

/**
 * Reparte con los «+» según `reparto` (cuentas × renglones) y espera a que diga «Todo repartido».
 * El «+» se busca DENTRO de su fila: dos rondas del mismo platillo son dos renglones con botones
 * del mismo nombre (D1-065 y D1-067 del día 1).
 */
export async function repartirUnidades(
  dialogo: Locator,
  renglones: readonly RenglonPorRepartir[],
  reparto: Reparto,
): Promise<void> {
  await tenerCuentas(dialogo, reparto.length);
  const filas = filasDePlatillo(dialogo);
  for (const [cuenta, porRenglon] of reparto.entries()) {
    for (const [i, unidades] of porRenglon.entries()) {
      const nombre = renglones[i]?.nombre;
      if (nombre === undefined)
        throw new Error(`El reparto nombra un renglón (${String(i)}) que no existe.`);
      const mas = filas.nth(i).getByRole('button', {
        name: `Añadir ${nombre} a la cuenta ${String(cuenta + 1)}`,
        exact: true,
      });
      for (let u = 0; u < unidades; u += 1) await mas.click();
    }
  }
  await expect(dialogo.getByText('Todo repartido')).toBeVisible();
}

/** Toca «Dividir en N cuentas» y espera al servidor. Con el cobro madre ya cerrado, vuelve a Pendientes. */
export async function confirmarLaDivision(
  pagina: Page,
  dialogo: Locator,
  cuentas: number,
): Promise<void> {
  const envio = esperarPost(pagina, '/api/restaurante/dividir-cuenta');
  await dialogo
    .getByRole('button', { name: new RegExp(`^Dividir en ${String(cuentas)} cuentas`) })
    .click();
  const r = await envio;
  expect(r.status(), `dividir: ${(await r.text()).slice(0, 200)}`).toBe(200);
  await cerrado(dialogo);
}

/** El nombre con el que Pendientes llama a la parte `n` de `de` de la mesa. */
export const rotuloDeLaParte = (mesa: number, n: number, de: number): RegExp =>
  new RegExp(`Mesa ${String(mesa)} · cuenta ${String(n)} de ${String(de)}(?!\\d)`);

/** El diálogo de cobro de una parte (se busca por su nombre, que el título repite). */
export function cobroDeLaParte(pagina: Page, mesa: number, n: number, de: number): Locator {
  return dialogoCon(pagina, rotuloDeLaParte(mesa, n, de));
}
