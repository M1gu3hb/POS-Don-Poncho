import { readFileSync } from 'node:fs';

import { expect, type Page } from '@playwright/test';

import { exigirElPdfDelCorte } from '../ayudantes/corte.ts';

import { consultarPuente } from '../ayudantes/sesion.ts';

import { anotar, escribir, pesos } from './ayudantes-qa.ts';
import { COBRADOS, consumoDe, INSUMOS } from './carta-qa.ts';

/**
 * QA-1 · LOS CORTES Y LA CONCILIACIÓN: el corte de turno, los dos cierres (el botón «Cierre diario» de
 * Caja y la entrada «Cierre del día» del menú), la hoja del servidor y `comparar`, que deja cada
 * comparación en el libro y junta las diferencias.
 */

export interface Cobro {
  readonly mesa: number;
  readonly caja: string;
  readonly venta: number;
  readonly propina: number;
  readonly efectivo: number;
  readonly tarjeta: number;
  readonly transferencia: number;
}

export const diferencias: string[] = [];
export function comparar(concepto: string, esperado: number | string, real: number | string): void {
  const igual = String(esperado) === String(real);
  if (!igual) diferencias.push(`${concepto}: esperado ${String(esperado)}, real ${String(real)}`);
  anotar({
    aparato: 'servidor',
    quien: 'Conciliación',
    accion: concepto,
    esperado: String(esperado),
    detalle: `real: ${String(real)} · ${igual ? 'IGUAL' : 'DIFERENCIA'}`,
    datos: {
      tipo: 'comparacion',
      concepto,
      esperado: String(esperado),
      real: String(real),
      igual: igual ? 1 : 0,
    },
  });
}

export const suma = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
export const de = (datos: Record<string, unknown>, k: string): number => Number(datos[k] ?? 0);

export interface Hoja {
  readonly metodos: readonly {
    metodo: string;
    ventasCentavos: string;
    propinasCentavos: string;
    pagos: number;
  }[];
  readonly resumen: { tickets: number; totalCentavos: string };
  readonly sesion: {
    esperadoCentavos: string | null;
    diferenciaCentavos: string | null;
    contadoCentavos: string | null;
  };
  readonly alcanceDeCancelaciones: string;
}

export async function hojaDe(duena: Page, sesionCajaId: string): Promise<Hoja> {
  return (await escribir(duena, '/api/caja/hoja-del-corte', { sesionCajaId })) as unknown as Hoja;
}

export const porMetodo = (h: Hoja, m: string): number =>
  suma(
    h.metodos
      .filter((x) => x.metodo === m)
      .map((x) => Number(x.ventasCentavos) + Number(x.propinasCentavos)),
  );

export async function corteDeTurno(page: Page, contadoCentavos: number): Promise<void> {
  await page.goto('/caja');
  await page.getByRole('button', { name: /^(Corte de turno|Turno)$/ }).click();
  const corte = page.getByRole('dialog').filter({ hasText: 'Corte de turno' });
  await corte.getByPlaceholder('0.00').nth(0).fill(pesos(contadoCentavos));
  await corte.getByRole('button', { name: 'Registrar corte de turno' }).click();
  await expect(corte).toBeHidden({ timeout: 30_000 });
}

export async function cerrarLaCaja(page: Page, contadoCentavos: number): Promise<string> {
  await page.goto('/caja');
  await page.getByRole('button', { name: /^(Cierre diario|Cierre)$/ }).click();
  const cierre = page.getByRole('dialog').filter({ hasText: 'Cierre de caja diario' });
  await expect(cierre).toBeVisible();
  await page.screenshot({ path: 'docs/qa/evidencia/cierre-diario-dialogo.png' });
  const propinas = cierre.getByText('PROPINAS DEL DÍA (PENDIENTES DE LIQUIDAR)');
  if (!(await propinas.isVisible())) {
    anotar({
      aparato: 'pc',
      quien: 'Caja',
      accion: 'El diálogo del cierre no trae «PROPINAS DEL DÍA (PENDIENTES DE LIQUIDAR)»',
      detalle: (await cierre.innerText()).replace(/\s+/g, ' ').slice(0, 600),
    });
  }
  await cierre.getByPlaceholder('0.00').nth(0).fill(pesos(contadoCentavos));
  await cierre.getByPlaceholder('0.00').nth(1).fill('0');
  const pdf = page.waitForEvent('download', { timeout: 60_000 });
  await cierre.getByRole('button', { name: 'Cerrar caja del día' }).click();
  await expect(cierre).toBeHidden({ timeout: 60_000 });
  const archivo = await pdf;
  expect(archivo.suggestedFilename()).toMatch(/^Corte_.+\.pdf$/);
  const ruta = await archivo.path();
  const bytes = readFileSync(ruta);
  expect(bytes.subarray(0, 4).toString('latin1'), 'Lo que bajó no es un PDF.').toBe('%PDF');
  expect(bytes.length, 'El PDF del corte pesa como una hoja en blanco.').toBeGreaterThan(20_000);
  return archivo.suggestedFilename();
}

/**
 * El CIERRE DEL DÍA por la entrada del menú («Cierre del día», `/restaurante/cierre-diario-y-arqueo`): es la
 * pantalla que arma el PDF con la hoja del servidor (cancelaciones y su pérdida). Devuelve el PDF bajado.
 */
export async function cerrarElDia(page: Page, contadoCentavos: number): Promise<void> {
  await page.goto('/restaurante/cierre-diario-y-arqueo');
  await expect(page.getByRole('heading', { name: /Cierre diario/ }).first()).toBeVisible();
  await page.locator('#contado').fill(pesos(contadoCentavos));
  await page.locator('#fondo').fill('0');
  await page.getByRole('button', { name: 'CERRAR CAJA' }).click();
  await page.getByRole('button', { name: 'Sí, cerrar el día' }).click({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Caja cerrada' })).toBeVisible({
    timeout: 30_000,
  });
  await exigirElPdfDelCorte(page, {
    titulo: 'CORTE DE CAJA',
    textos: [
      'Pérdidas por cancelación · ya preparado o entregado',
      'Cancelaciones antes de prepararse',
      'Mesero 1',
      'Se fueron sin pagar',
      'Capturé la mesa equivocada',
      'Se arrepintieron',
    ],
  });
}

/** El almacén: existencia inicial − lo cobrado (recetas) − lo cancelado que ya estaba hecho (mermas). */
export async function elAlmacenCuadra(
  duena: Page,
  mermas: readonly Record<string, unknown>[],
): Promise<void> {
  const gasto: Record<string, number> = {};
  for (const pedido of Object.values(COBRADOS)) {
    for (const [k, v] of Object.entries(consumoDe(pedido))) gasto[k] = (gasto[k] ?? 0) + v;
  }
  for (const m of mermas)
    gasto[String(m['insumo'])] = (gasto[String(m['insumo'])] ?? 0) + de(m, 'cantidad');
  const reales = await consultarPuente<{
    nombre?: string;
    stock_actual?: number | string | null;
  }>(duena, 'Ingrediente', { limite: 100 });
  for (const i of INSUMOS) {
    const esperado = Math.round((Number(i.existencia) - (gasto[i.nombre] ?? 0)) * 1e4) / 1e4;
    const real = Number(reales.find((r) => r.nombre === i.nombre)?.stock_actual ?? Number.NaN);
    comparar(`Almacén: ${i.nombre}`, esperado, Math.round(real * 1e4) / 1e4);
  }
}

/** «Ver PDF» de cada corte de Registros: el del Cierre del día tiene que traer las cancelaciones. */
export async function verPdfDeLosCortes(duena: Page): Promise<void> {
  await duena.goto('/registros');
  const verPdf = duena.getByRole('button', { name: 'Ver PDF' });
  await expect(verPdf.first()).toBeVisible();
  let conPerdidas = 0;
  for (let i = 0; i < (await verPdf.count()); i += 1) {
    await verPdf.nth(i).click();
    const visor = duena.getByRole('dialog');
    await expect(visor.first()).toBeVisible({ timeout: 30_000 });
    await duena.screenshot({
      path: `docs/qa/evidencia/visor-del-corte-${String(i + 1)}.png`,
    });
    // `innerText` devuelve el texto como se ve: los títulos de sección van en mayúsculas por CSS
    // («PÉRDIDAS POR CANCELACIÓN»). Se compara sin distinguir mayúsculas (ronda 2: QA1-9 era esto).
    const texto = (await visor.first().innerText()).replace(/\s+/g, ' ').toLocaleLowerCase('es');
    if (texto.includes('pérdidas por cancelación')) {
      conPerdidas += 1;
      for (const t of [
        'Cancelaciones antes de prepararse',
        'Se fueron sin pagar',
        'Capturé la mesa equivocada',
        'Se arrepintieron',
        'Por cancelación',
      ]) {
        comparar(
          `PDF del corte del día dice «${t}»`,
          'sí',
          texto.includes(t.toLocaleLowerCase('es')) ? 'sí' : 'no',
        );
      }
    }
    await duena.keyboard.press('Escape');
    await expect(visor).toHaveCount(0);
  }
  comparar('Cortes con la sección «Pérdidas por cancelación»', 1, conPerdidas);
}
