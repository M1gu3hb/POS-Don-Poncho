/**
 * EL CIERRE DE LA CAJA («Cierre diario» en /caja) y EL CIERRE DEL DÍA del dueño
 * (`/restaurante/cierre-diario-y-arqueo`). Los dos bajan el PDF del corte; el del día no se deja
 * cerrar con una mesa abierta.
 */
import { readFileSync } from 'node:fs';

import { expect, type Page } from '@playwright/test';

import { dialogoCon, pesos } from './comun.ts';

export interface CierreDeCaja {
  /** El sistema se negó porque hay mesas pendientes (se registra, no se esquiva). */
  readonly bloqueadoPorMesas: boolean;
  readonly nombreDelPdf: string | null;
}

function esPdf(ruta: string): boolean {
  const bytes = readFileSync(ruta);
  return bytes.subarray(0, 4).toString('latin1') === '%PDF' && bytes.length > 10_000;
}

/** «Cierre diario» de ESTA caja: cuenta el efectivo y la cierra. Baja el PDF del corte. */
export async function cierreDeLaCaja(pagina: Page, contadoCentavos: number): Promise<CierreDeCaja> {
  await pagina.getByRole('button', { name: /^(Cierre diario|Cierre)$/ }).click();
  const cierre = dialogoCon(pagina, 'Cierre de caja diario');
  const pendientes = pagina
    .getByRole('dialog')
    .filter({ hasText: /mesas? (abiertas?|pendientes?)/i });
  await expect(cierre.or(pendientes).first()).toBeVisible({ timeout: 30_000 });
  if (!(await cierre.isVisible())) return { bloqueadoPorMesas: true, nombreDelPdf: null };
  // El diálogo termina de cargar su resumen y SE REINICIA: se escribe cuando ya enseña el esperado.
  await expect(cierre.getByText('EFECTIVO ESPERADO EN CAJÓN')).toBeVisible({ timeout: 30_000 });
  const contado = cierre.getByPlaceholder('0.00').nth(0);
  await expect(async () => {
    await contado.fill(pesos(contadoCentavos));
    await expect(contado).toHaveValue(pesos(contadoCentavos));
  }).toPass({ timeout: 20_000 });
  await cierre.getByPlaceholder('0.00').nth(1).fill('0');
  // Con faltante o sobrante el cierre exige explicarlo: sin la nota el botón sigue apagado.
  await cierre.getByPlaceholder(/^Observaciones/).fill('Cierre de la jornada (simulador)');
  const boton = cierre.getByRole('button', { name: /^Cerrar (caja del día|esta caja)/ });
  // Si el botón sigue apagado, el diálogo dice por qué: eso es lo que se reporta.
  if (!(await boton.isEnabled())) {
    const texto = (await cierre.innerText()).replace(/\s+/g, ' ').slice(0, 400);
    throw new Error(`«Cerrar caja» sigue apagado. El diálogo dice: ${texto}`);
  }
  // La descarga, la respuesta del servidor y el clic juntos: si uno falla, ninguna promesa queda
  // sin atender (una espera de descarga suelta tumbaba el proceso entero al vencer).
  const [archivo, respuesta] = await Promise.all([
    pagina.waitForEvent('download', { timeout: 180_000 }),
    pagina.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/caja/cerrar' && r.request().method() === 'POST',
      { timeout: 180_000 },
    ),
    boton.click(),
  ]);
  if (respuesta.status() !== 200) {
    throw new Error(
      `/api/caja/cerrar contestó ${String(respuesta.status())}: ${(await respuesta.text()).slice(0, 300)}`,
    );
  }
  await expect(cierre).toBeHidden({ timeout: 60_000 });
  // Al cerrar sale «Caja cerrada correctamente» (con «Ver PDF»): se despide antes de seguir.
  const listo = pagina.getByRole('dialog').filter({ hasText: 'Caja cerrada correctamente' });
  if (
    await listo.waitFor({ state: 'visible', timeout: 10_000 }).then(
      () => true,
      () => false,
    )
  )
    await pagina.keyboard.press('Escape');
  const ruta = await archivo.path();
  expect(esPdf(ruta), 'Lo que bajó el cierre de la caja no es un PDF de verdad.').toBe(true);
  return { bloqueadoPorMesas: false, nombreDelPdf: archivo.suggestedFilename() };
}

/** El «Cierre del día» del dueño. Con una mesa abierta tiene que negarse; si no, baja su PDF. */
export async function cierreDelDia(
  pagina: Page,
  appUrl: string,
  contadoCentavos: number,
): Promise<{ cerro: boolean; aviso: string }> {
  await pagina.goto(`${appUrl}/restaurante/cierre-diario-y-arqueo`, {
    waitUntil: 'domcontentloaded',
  });
  // La pantalla lee la caja al cargar: si todavía no la ve, una recarga la encuentra.
  const campo = pagina.locator('#contado');
  if (
    !(await campo.waitFor({ state: 'visible', timeout: 20_000 }).then(
      () => true,
      () => false,
    ))
  ) {
    await pagina.reload({ waitUntil: 'domcontentloaded' });
  }
  await expect(campo).toBeVisible({ timeout: 45_000 });
  await pagina.locator('#contado').fill(pesos(contadoCentavos));
  await pagina.locator('#fondo').fill('0');
  await pagina.getByRole('button', { name: 'CERRAR CAJA' }).click();
  const confirmar = pagina.getByRole('button', { name: 'Sí, cerrar el día' });
  const cerrada = pagina.getByRole('heading', { name: 'Caja cerrada' });
  const rechazo = pagina.getByText(
    /mesas? (abiertas?|pendientes?)|no se puede cerrar|antes de cerrar/i,
  );
  await expect(confirmar.or(rechazo).first()).toBeVisible({ timeout: 30_000 });
  if (!(await confirmar.isVisible()))
    return { cerro: false, aviso: (await rechazo.first().innerText()).slice(0, 200) };
  await confirmar.click();
  await expect(cerrada.or(rechazo).first()).toBeVisible({ timeout: 45_000 });
  if (await cerrada.isVisible()) return { cerro: true, aviso: '' };
  return { cerro: false, aviso: (await rechazo.first().innerText()).slice(0, 200) };
}
