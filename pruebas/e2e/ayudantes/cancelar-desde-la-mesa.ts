import { expect, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';

import { sesionDeLaCaja } from './conciliacion.ts';
import { abrirLaCaja, dialogoDeLaMesa } from './mesas-heredadas.ts';
import { Equipo } from './roles.ts';
import { cabecerasDeEscrituraDePrueba, vigilarFallos } from './sesion.ts';

/**
 * CANCELAR DESDE LA MESA (DP-12.4), para la prueba de navegador: el día con caja abierta, el
 * toque (tacto real donde lo hay), quitar un platillo y cancelar la cuenta desde el diálogo de
 * la mesa, y lo que el corte del servidor dice de las cancelaciones.
 */

export const SLUG = 'prueba-restaurante';
export const FONDO_CENTAVOS = 150_000;
/** Como lo dice el corte (la etiqueta del motivo) y como lo dice la tesela de quien anula. */
export const ERROR_DEL_MESERO = 'Error del mesero al tomar la orden';
export const ERROR_DEL_MESERO_TESELA = 'Me equivoqué al tomar la orden';

let reseteado = false;

export interface Dia {
  readonly duena: Page;
  readonly rosa: Page;
  readonly lupita: Page;
  readonly tono: Page;
  readonly exigirSinFallos: () => void;
}

export function conTecho(page: Page): Page {
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(30_000);
  return page;
}

export async function empezarElDia(browser: Browser, info: TestInfo): Promise<Dia> {
  const equipo = new Equipo(browser, SLUG);
  const duena = conTecho(await equipo.pagina(info, 'dueno'));
  if (!reseteado) {
    const respuesta = await duena.request.post('/api/pruebas/resetear', {
      headers: cabecerasDeEscrituraDePrueba(),
      data: { confirmacion: 'RESETEAR' },
    });
    expect(respuesta.status(), `resetear_demo: ${await respuesta.text()}`).toBe(200);
    reseteado = true;
  }
  const rosa = conTecho(await equipo.pagina(info, 'cajero'));
  const lupita = conTecho(await equipo.pagina(info, 'mesero'));
  const tono = conTecho(await equipo.pagina(info, 'cocina'));
  const vigilantes = [duena, rosa, lupita, tono].map((p) => vigilarFallos(p));
  await rosa.goto('/');
  await rosa.waitForURL(/\/caja$/);
  await lupita.goto('/');
  await lupita.waitForURL(/\/mesero$/);
  await tono.goto('/');
  await tono.waitForURL(/\/cocina$/);
  if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, FONDO_CENTAVOS);
  return {
    duena,
    rosa,
    lupita,
    tono,
    exigirSinFallos: () => {
      for (const exigir of vigilantes) exigir();
    },
  };
}

/** Tacto real donde el aparato lo tiene (tableta y teléfono); clic en la PC. */
export async function tocar(objetivo: Locator, info: TestInfo): Promise<void> {
  if (info.project.use.hasTouch === true) await objetivo.tap();
  else await objetivo.click();
}

export interface CancelacionDelServidor {
  readonly tipo: string;
  readonly mesa: string | null;
  readonly producto: string | null;
  readonly usuario: string | null;
  readonly motivo: string | null;
  readonly montoCentavos: string;
  readonly perdida: boolean;
}

export async function cancelacionesDelCorte(lector: Page, sesionCajaId: string) {
  const respuesta = await lector.request.post('/api/caja/cancelaciones-del-corte', {
    headers: cabecerasDeEscrituraDePrueba(),
    data: { sesionCajaId },
  });
  expect(respuesta.status(), `cancelaciones-del-corte: ${await respuesta.text()}`).toBe(200);
  const cuerpo = (await respuesta.json()) as {
    readonly datos: { readonly cancelaciones: readonly CancelacionDelServidor[] };
  };
  return cuerpo.datos.cancelaciones;
}

/** Quita un platillo desde el diálogo de la mesa: lista, platillo, motivo y confirmar. */
export async function quitarUnPlatillo(
  lupita: Page,
  info: TestInfo,
  mesa: number,
  platillo: string,
  yaSalio: boolean,
): Promise<void> {
  const enLaMesa = dialogoDeLaMesa(lupita, mesa);
  await tocar(enLaMesa.getByRole('button', { name: 'Quitar un platillo' }), info);
  const lista = lupita.getByRole('dialog', { name: 'Quitar un platillo' });
  await expect(lista).toBeVisible();
  const elegido = lista.getByRole('button', { name: `Quitar ${platillo}` });
  // Lo que cocina ya dejó listo lo dice la lista, antes de elegir.
  if (yaSalio) await expect(elegido).toContainText('Ya salió de cocina');
  else await expect(elegido).not.toContainText('Ya salió de cocina');
  await tocar(elegido, info);
  const anular = lupita.getByRole('dialog', { name: `Quitar ${platillo}` });
  await expect(anular).toBeVisible();
  if (yaSalio) await expect(anular.getByText(/ya salió de/i)).toBeVisible();
  // Sin motivo no se quita: el botón espera.
  await expect(anular.getByRole('button', { name: 'Quitar de la cuenta' })).toBeDisabled();
  await tocar(anular.getByRole('radio', { name: ERROR_DEL_MESERO_TESELA }), info);
  const respuesta = lupita.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/restaurante/anular-linea' &&
      r.request().method() === 'POST',
  );
  await tocar(anular.getByRole('button', { name: 'Quitar de la cuenta' }), info);
  expect((await respuesta).status()).toBe(200);
  await expect(lupita.getByText('Platillo quitado de la cuenta').first()).toBeVisible();
  await expect(anular).toBeHidden();
}

/** Cancela la cuenta desde el diálogo de la mesa, con su motivo, y exige (o no) el aviso de pérdida. */
export async function cancelarLaCuenta(
  lupita: Page,
  info: TestInfo,
  mesa: number,
  motivo: string,
  avisaDePerdida: boolean,
): Promise<void> {
  const enLaMesa = dialogoDeLaMesa(lupita, mesa);
  await tocar(enLaMesa.getByRole('button', { name: 'Cancelar la cuenta', exact: true }), info);
  const dialogo = lupita.getByRole('dialog', { name: 'Cancelar la cuenta' });
  await expect(dialogo).toBeVisible();
  const aviso = dialogo.getByText(/La cocina ya preparó/);
  if (avisaDePerdida) await expect(aviso).toBeVisible();
  else await expect(aviso).toHaveCount(0);
  const confirmar = dialogo.getByRole('button', { name: 'Cancelar la cuenta sin cobrar' });
  // Sin motivo no se cancela: una venta que desaparece sin motivo parece un robo.
  await expect(confirmar).toBeDisabled();
  await dialogo.locator('#cancelar-cuenta-motivo').fill(motivo);
  const respuesta = lupita.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/restaurante/cancelar-orden' &&
      r.request().method() === 'POST',
  );
  await tocar(confirmar, info);
  expect((await respuesta).status()).toBe(200);
  await expect(lupita.getByText('Cuenta cancelada').first()).toBeVisible();
  // La mesa vuelve al mapa: el diálogo se cierra.
  await expect(enLaMesa).toHaveCount(0);
}
