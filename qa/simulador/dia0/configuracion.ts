/**
 * DÍA 0 · CONFIGURACIÓN: el cupo de 2 cajas, los descuentos con PIN, el PIN en retiros de más de
 * $500, las alertas ámbar y rojo de la cocina, el modo del menú del comensal y la propina del
 * comensal. Todo por Configuración y Portal QR, como lo haría el dueño; cada cambio al libro.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { CONFIGURACION } from './datos.ts';
import { ir, irAConfiguracion, type Dia0 } from './contexto.ts';
import { esperarPost } from '../pantallas/comun.ts';

async function fijarInterruptor(interruptor: Locator, encendido: boolean): Promise<boolean> {
  await expect(interruptor).toBeVisible();
  if (((await interruptor.getAttribute('aria-checked')) === 'true') === encendido) return false;
  await interruptor.click();
  await expect(interruptor).toHaveAttribute('aria-checked', String(encendido));
  return true;
}

async function cajas(d: Dia0): Promise<void> {
  const { pagina } = d;
  await irAConfiguracion(d, 'Caja');
  const dos = pagina.getByRole('button', { name: '2 cajas', exact: true });
  await expect(dos).toBeVisible();
  if ((await dos.getAttribute('aria-pressed')) !== 'true') {
    await dos.click();
    await expect(dos).toHaveAttribute('aria-pressed', 'true');
    d.anotar({
      tipo: 'cambio_en_vivo',
      que: 'cajas abiertas a la vez',
      antes: '1',
      despues: String(CONFIGURACION.cajas),
    });
  }
  const monto = pagina.getByLabel('Monto en pesos');
  const pesos = String(CONFIGURACION.retiroConPinArribaDePesos);
  if ((await monto.inputValue()) !== pesos) {
    await monto.fill(pesos);
    const guardado = esperarPost(pagina, '/api/caja/fijar-umbral-de-retiro');
    await monto.locator('xpath=ancestor::form[1]').getByRole('button', { name: 'Guardar' }).click();
    expect((await guardado).status()).toBe(200);
    d.anotar({
      tipo: 'cambio_en_vivo',
      que: 'PIN en retiros arriba de (pesos)',
      antes: '',
      despues: pesos,
    });
  }
  d.nota('configuracion', `2 cajas y PIN en retiros arriba de $${pesos}`);
}

async function descuentos(d: Dia0): Promise<void> {
  await irAConfiguracion(d, 'Descuentos');
  const cambio = await fijarInterruptor(
    d.pagina.getByRole('switch', { name: 'Permitir descuentos' }),
    true,
  );
  if (cambio)
    d.anotar({ tipo: 'cambio_en_vivo', que: 'permitir descuentos', antes: 'no', despues: 'sí' });
  d.nota('configuracion', 'descuentos permitidos (todo descuento pide PIN de quien autoriza)');
}

async function alertasDeCocina(d: Dia0): Promise<void> {
  const { pagina } = d;
  await irAConfiguracion(d, 'Operación');
  const ambar = pagina.getByLabel('Ámbar desde (minutos)');
  const rojo = pagina.getByLabel('Rojo desde (minutos)');
  // DP-21: la tarjeta guarda sólo si algo cambió (con lo mismo, «Guardar» no hace nada): idempotente.
  const yaEstan =
    (await ambar.inputValue()) === String(CONFIGURACION.alertaAmbarMinutos) &&
    (await rojo.inputValue()) === String(CONFIGURACION.alertaRojoMinutos);
  if (!yaEstan) {
    await ambar.fill(String(CONFIGURACION.alertaAmbarMinutos));
    await rojo.fill(String(CONFIGURACION.alertaRojoMinutos));
    await guardarLaTarjeta(pagina, rojo);
  }
  d.nota(
    'configuracion',
    `alertas de cocina: ámbar ${String(CONFIGURACION.alertaAmbarMinutos)} min, rojo ${String(CONFIGURACION.alertaRojoMinutos)} min`,
  );
}

/** La tarjeta más chica que trae el control y su «Guardar» (cada tarjeta de Configuración guarda lo suyo). */
function tarjetaDe(control: Locator): Locator {
  return control.locator('xpath=ancestor::*[.//button[normalize-space()="Guardar"]][1]');
}

async function guardarLaTarjeta(pagina: Page, control: Locator): Promise<void> {
  const guardado = esperarPost(pagina, '/api/datos/escribir');
  await tarjetaDe(control).getByRole('button', { name: 'Guardar', exact: true }).click();
  expect((await guardado).status()).toBe(200);
}

/**
 * DP-21 · El portal es la sección «Portal de comensales» de Configuración, con una tarjeta por tema
 * y su propio «Guardar»: el modo del menú está en «Activación y menú» y la propina del comensal en
 * «Cuenta y propina desde QR».
 */
async function menuYPropina(d: Dia0): Promise<void> {
  const { pagina } = d;
  await ir(d, '/configuracion?seccion=portal');
  const modo = pagina.getByRole('combobox', { name: 'Cómo se ve el menú' });
  await expect(modo).toBeVisible();
  if (!(await modo.innerText()).includes(CONFIGURACION.modoDelMenu)) {
    await modo.click();
    await pagina.getByRole('option', { name: CONFIGURACION.modoDelMenu, exact: true }).click();
    await guardarLaTarjeta(pagina, modo);
  }
  const propina = filaDe(pagina, 'Propina elegida por comensal desde QR').getByRole('switch');
  if (await fijarInterruptor(propina, true)) await guardarLaTarjeta(pagina, propina);
  d.anotar({
    tipo: 'cambio_en_vivo',
    que: 'modo del menú del comensal',
    antes: '',
    despues: CONFIGURACION.modoDelMenu,
  });
  d.nota(
    'configuracion',
    `menú del comensal «${CONFIGURACION.modoDelMenu}» y propina del comensal encendida`,
  );
}

/** La fila de una opción del Portal QR: el bloque más chico con su texto y su interruptor. */
function filaDe(pagina: Page, texto: string): Locator {
  return pagina
    .getByText(texto, { exact: true })
    .locator('xpath=ancestor::div[.//button[@role="switch"]][1]');
}

export async function pasoConfiguracion(d: Dia0): Promise<void> {
  await cajas(d);
  await descuentos(d);
  await alertasDeCocina(d);
  await menuYPropina(d);
  await d.foto('configuracion');
}
