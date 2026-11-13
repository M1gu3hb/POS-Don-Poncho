/**
 * CAJA → «Movimientos»: retirar (con el PIN de un gerente arriba del umbral), entrada de cambio,
 * gasto del cajón y corte de turno. Cada formulario es una tarjeta con su botón de registrar.
 */
import { expect, type Page } from '@playwright/test';

import { esperarPost, pesos } from './comun.ts';

const RUTA_MOVIMIENTO = '/api/caja/movimiento';

export async function irAMovimientos(pagina: Page): Promise<void> {
  await pagina.getByRole('tab', { name: 'Movimientos', exact: true }).click();
  await expect(pagina.getByRole('heading', { name: 'Retirar' })).toBeVisible();
}

export interface Retiro {
  readonly centavos: number;
  readonly aDondeVa: string;
  /** Si el retiro pasa del umbral: quién autoriza y con qué PIN (se teclea en esta misma pantalla). */
  readonly autoriza?: { readonly nombre: string; readonly pin: string };
}

/** Registra un retiro. Devuelve si la pantalla pidió el PIN (para el libro: `conPin`). */
export async function retirar(pagina: Page, r: Retiro): Promise<{ pidioPin: boolean }> {
  await pagina.getByLabel('Cuánto').nth(0).fill(pesos(r.centavos));
  await pagina.getByLabel('A dónde va').fill(r.aDondeVa);
  const envio = esperarPost(pagina, RUTA_MOVIMIENTO);
  const pin = pagina.getByLabel('PIN de quien autoriza');
  await pagina.getByRole('button', { name: /^(Registrar el retiro|Esperando el PIN)/ }).click();
  // Sin umbral rebasado, el retiro se manda solo; con él, la pantalla pide el PIN de un gerente.
  const pidio = await pin.waitFor({ state: 'visible', timeout: 4_000 }).then(
    () => true,
    () => false,
  );
  if (pidio) {
    if (r.autoriza === undefined)
      throw new Error('El retiro pidió PIN y el guion no trae quién autoriza.');
    await pagina
      .getByRole('group', { name: 'Quién autoriza' })
      .getByRole('button', { name: r.autoriza.nombre })
      .click();
    await pin.fill(r.autoriza.pin);
    await pagina.getByRole('button', { name: 'Autorizar' }).click();
  }
  const respuesta = await envio;
  expect(respuesta.status(), `retiro: ${(await respuesta.text()).slice(0, 200)}`).toBe(200);
  return { pidioPin: pidio };
}

export async function entradaDeCambio(
  pagina: Page,
  centavos: number,
  origen: 'Del banco' | 'De la caja chica' | 'Del dueño' | 'De la otra caja',
  nota: string,
): Promise<void> {
  await pagina.locator('#entrada-importe').fill(pesos(centavos));
  await pagina.locator('#entrada-origen').selectOption({ label: origen });
  await pagina.locator('#entrada-motivo').fill(nota);
  const envio = esperarPost(pagina, '/api/caja/entrada-cambio');
  await pagina.getByRole('button', { name: 'Registrar la entrada' }).click();
  const respuesta = await envio;
  expect(respuesta.status(), `entrada de cambio: ${(await respuesta.text()).slice(0, 200)}`).toBe(
    200,
  );
}

export async function gastoDelCajon(
  pagina: Page,
  centavos: number,
  categoria: 'Servicios' | 'Limpieza' | 'Transporte' | 'Reparación' | 'Otro',
  descripcion: string,
): Promise<void> {
  await pagina.locator('#gasto-monto').fill(pesos(centavos));
  await pagina
    .getByRole('group', { name: 'De qué' })
    .getByRole('button', { name: categoria })
    .click();
  await pagina.locator('#gasto-descripcion').fill(descripcion);
  const envio = esperarPost(pagina, '/api/gastos/registrar');
  await pagina.getByRole('button', { name: 'Registrar el gasto' }).click();
  const respuesta = await envio;
  expect(respuesta.status(), `gasto del cajón: ${(await respuesta.text()).slice(0, 200)}`).toBe(
    200,
  );
}

/** El corte de turno de quien tiene la caja: cuenta lo que hay y lo entrega sin cerrar. */
export async function corteDeTurno(
  pagina: Page,
  contadoCentavos: number,
  notas: string,
): Promise<void> {
  await pagina.locator('#turno-contado').fill(pesos(contadoCentavos));
  await pagina.locator('#turno-notas').fill(notas);
  const envio = esperarPost(pagina, '/api/caja/corte-turno');
  await pagina.getByRole('button', { name: 'Entregar el turno' }).click();
  const respuesta = await envio;
  expect(respuesta.status(), `corte de turno: ${(await respuesta.text()).slice(0, 200)}`).toBe(200);
}
